from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import signal
import socket
import ssl
import time
import urllib.error
import urllib.request
import uuid
from typing import Any

import redis.asyncio as redis


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [context-worker] %(message)s",
)

logger = logging.getLogger("context_worker.main")
_running = True

CONTEXT_QUEUE_NAME = os.getenv("CONTEXT_QUEUE_NAME", "queue:context")
QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333").rstrip("/")
QDRANT_API_KEY = ""
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "minuet_context_v1")
BACKEND_INTERNAL_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000").rstrip("/")
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
INDEXING_BATCH_SIZE = int(os.getenv("CONTEXT_INDEXING_BATCH_SIZE", "32"))
MAX_CHARS_PER_CHUNK = int(os.getenv("CONTEXT_CHUNK_MAX_CHARS", "1400"))
OVERLAP_CHARS = int(os.getenv("CONTEXT_CHUNK_OVERLAP_CHARS", "180"))
BACKEND_TIMEOUT = int(os.getenv("BACKEND_TIMEOUT", "60"))
MAX_RETRIES = int(os.getenv("CONTEXT_WORKER_MAX_RETRIES", "3"))
RETRY_BACKOFF_BASE = int(os.getenv("CONTEXT_WORKER_RETRY_BACKOFF_BASE", "2"))

JOB_TYPES = {
    "index_minute_context",
    "reindex_minute_context",
    "reindex_project_context",
    "reindex_client_context",
    "reindex_all_context",
    "sync_context_status",
    "cleanup_minute_context",
    "rebuild_qdrant_collection",
    "answer_context_query",
}


class ContextWorkerError(Exception):
    def __init__(self, message: str, *, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


def _read_secret_file(path: str | None) -> str:
    if not path:
        return ""
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    except OSError:
        return ""


QDRANT_API_KEY = _read_secret_file(os.getenv("QDRANT_API_KEY_FILE"))


def _internal_secret() -> str:
    return os.getenv("INTERNAL_API_SECRET") or _read_secret_file(os.getenv("INTERNAL_API_SECRET_FILE")) or "-"


def _handle_stop(signum, frame) -> None:
    global _running
    _running = False
    logger.info("Señal de detención recibida | signal=%s", signum)


def _json_request(
    url: str,
    *,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = BACKEND_TIMEOUT,
) -> dict[str, Any]:
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    request_headers = {"Accept": "application/json", "Content-Type": "application/json"}
    request_headers.update(headers or {})
    request = urllib.request.Request(url, data=payload, headers=request_headers, method=method)
    context = ssl.create_default_context() if url.startswith("https://") else None
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        retryable = exc.code in {408, 429} or exc.code >= 500
        raise ContextWorkerError(f"HTTP {exc.code} en {url}: {raw[:300]}", retryable=retryable) from exc
    except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
        raise ContextWorkerError(f"No se pudo conectar a {url}: {exc}", retryable=True) from exc


def _backend_request(path: str, *, method: str = "GET", body: dict[str, Any] | None = None) -> dict[str, Any]:
    return _json_request(
        f"{BACKEND_INTERNAL_URL}{path}",
        method=method,
        body=body,
        headers={"x-internal-secret": _internal_secret()},
    )


def _provider_headers(provider: dict[str, Any]) -> dict[str, str]:
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    custom_headers = provider.get("custom_headers") or {}
    if isinstance(custom_headers, dict):
        headers.update({str(k): str(v) for k, v in custom_headers.items() if k and v})
    auth_type = str(provider.get("auth_type") or "none")
    token = str(provider.get("token") or "").strip()
    if auth_type == "api_key" and token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _get_provider(purpose: str) -> dict[str, Any]:
    provider = _backend_request(f"/internal/v1/context/active-provider/{purpose}")
    if not provider.get("id") or not provider.get("model_name"):
        raise ContextWorkerError(f"Provider incompleto para {purpose}", retryable=False)
    provider["base_url"] = str(provider.get("base_url") or "").rstrip("/")
    return provider


def _embed_texts(provider: dict[str, Any], texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    family = str(provider.get("provider_family") or provider.get("execution_adapter") or "openai_compatible")
    base_url = str(provider.get("base_url") or "").rstrip("/")
    model = str(provider.get("model_name") or "")
    timeout = int(provider.get("timeout_seconds") or BACKEND_TIMEOUT)
    if family == "ollama":
        embeddings: list[list[float]] = []
        for text in texts:
            response = _json_request(
                f"{base_url}/api/embeddings",
                method="POST",
                body={"model": model, "prompt": text},
                headers=_provider_headers(provider),
                timeout=timeout,
            )
            vector = response.get("embedding")
            if not isinstance(vector, list):
                raise ContextWorkerError("Ollama no retornó embedding válido", retryable=True)
            embeddings.append([float(value) for value in vector])
        return embeddings

    response = _json_request(
        f"{base_url}/embeddings",
        method="POST",
        body={"model": model, "input": texts},
        headers=_provider_headers(provider),
        timeout=timeout,
    )
    data = response.get("data") or []
    vectors = [item.get("embedding") for item in sorted(data, key=lambda item: int(item.get("index", 0)))]
    if len(vectors) != len(texts) or not all(isinstance(vector, list) for vector in vectors):
        raise ContextWorkerError("Provider no retornó todos los embeddings esperados", retryable=True)
    return [[float(value) for value in vector] for vector in vectors]


def _qdrant_headers() -> dict[str, str]:
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if QDRANT_API_KEY:
        headers["api-key"] = QDRANT_API_KEY
    return headers


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug[:60] or "model"


def _collection_name(provider: dict[str, Any], actual_dimensions: int | None = None) -> str:
    model = _slug(str(provider.get("model_name") or "model"))
    dimensions = int(provider.get("embedding_dimensions") or actual_dimensions or 0)
    return f"{QDRANT_COLLECTION}_{model}_{dimensions}" if dimensions else f"{QDRANT_COLLECTION}_{model}"


def _ensure_collection(collection: str, dimensions: int) -> None:
    try:
        response = _json_request(f"{QDRANT_URL}/collections/{collection}", headers=_qdrant_headers(), timeout=20)
        vectors = (((response.get("result") or {}).get("config") or {}).get("params") or {}).get("vectors")
        existing_size = None
        if isinstance(vectors, dict) and "size" in vectors:
            existing_size = int(vectors.get("size") or 0)
        if existing_size and existing_size != dimensions:
            raise ContextWorkerError(
                f"Colección Qdrant con dimensión {existing_size}, pero embeddings requieren {dimensions}",
                retryable=False,
            )
        return
    except ContextWorkerError as exc:
        if "HTTP 404" not in str(exc):
            raise
    _json_request(
        f"{QDRANT_URL}/collections/{collection}",
        method="PUT",
        body={"vectors": {"size": dimensions, "distance": "Cosine"}},
        headers=_qdrant_headers(),
        timeout=30,
    )


def _upsert_points(collection: str, points: list[dict[str, Any]]) -> None:
    if not points:
        return
    _json_request(
        f"{QDRANT_URL}/collections/{collection}/points?wait=true",
        method="PUT",
        body={"points": points},
        headers=_qdrant_headers(),
        timeout=60,
    )


def _deactivate_existing_points(collection: str, minute_id: str, version_id: str) -> None:
    if not minute_id or not version_id:
        return
    _json_request(
        f"{QDRANT_URL}/collections/{collection}/points/payload?wait=true",
        method="POST",
        body={
            "payload": {"active": False},
            "filter": {
                "must": [
                    {"key": "minute_id", "match": {"value": minute_id}},
                    {"key": "version_id", "match": {"value": version_id}},
                ]
            },
        },
        headers=_qdrant_headers(),
        timeout=60,
    )


def _delete_minute_points(collection: str, minute_id: str, version_id: str) -> None:
    if not collection or not minute_id:
        return
    must = [{"key": "minute_id", "match": {"value": minute_id}}]
    if version_id:
        must.append({"key": "version_id", "match": {"value": version_id}})
    _json_request(
        f"{QDRANT_URL}/collections/{collection}/points/delete?wait=true",
        method="POST",
        body={"filter": {"must": must}},
        headers=_qdrant_headers(),
        timeout=60,
    )


def _normalize_text(value: str | None) -> str:
    return " ".join(str(value or "").replace("\r\n", "\n").split())


def _chunk_text(text: str) -> list[str]:
    clean = _normalize_text(text)
    if not clean:
        return []
    if len(clean) <= MAX_CHARS_PER_CHUNK:
        return [clean]
    chunks: list[str] = []
    start = 0
    while start < len(clean):
        end = min(len(clean), start + MAX_CHARS_PER_CHUNK)
        chunks.append(clean[start:end].strip())
        if end >= len(clean):
            break
        start = max(0, end - OVERLAP_CHARS)
    return [chunk for chunk in chunks if chunk]


def _estimate_input_tokens(texts: list[str]) -> int:
    total_chars = sum(len(text or "") for text in texts)
    return max(1, int(total_chars / 4)) if total_chars else 0


def _canonical_chunks(canonical: dict[str, Any]) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    source_hash = str(canonical.get("sourceHash") or "")
    minute = canonical.get("minute") or {}
    version = canonical.get("version") or {}
    client = canonical.get("client") or {}
    project = canonical.get("project") or {}
    prefix = " | ".join(
        part for part in [
            f"Cliente: {client.get('name')}" if client.get("name") else None,
            f"Proyecto: {project.get('name')}" if project and project.get("name") else None,
            f"Minuta: {minute.get('title')}" if minute.get("title") else None,
        ] if part
    )
    for item in canonical.get("items") or []:
        item_id = str(item.get("id") or "")
        item_type = str(item.get("type") or "unknown")
        title = str(item.get("title") or "")
        text = str(item.get("canonicalText") or item.get("text") or "")
        for index, chunk_text in enumerate(_chunk_text(text)):
            full_text = f"{prefix}\n{title}\n{chunk_text}".strip()
            chunk_hash = hashlib.sha256(full_text.encode("utf-8")).hexdigest()
            stable_key = f"{source_hash}:{item_id}:{index}:{chunk_hash}"
            point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, stable_key))
            chunks.append(
                {
                    "id": point_id,
                    "sourceItemId": item_id,
                    "itemType": item_type,
                    "chunkIndex": index,
                    "chunkHash": chunk_hash,
                    "qdrantPointId": point_id,
                    "text": full_text,
                    "title": title,
                    "payload": {
                        "active": True,
                        "source_system": canonical.get("sourceSystem") or "minuetaitor",
                        "source_hash": source_hash,
                        "client_id": minute.get("clientId"),
                        "project_id": minute.get("projectId"),
                        "minute_id": minute.get("id"),
                        "version_id": version.get("id"),
                        "version_num": version.get("versionNum"),
                        "source_item_id": item_id,
                        "item_type": item_type,
                        "chunk_index": index,
                        "chunk_hash": chunk_hash,
                        "title": title,
                        "text": full_text,
                    },
                }
            )
    return chunks


def _index_minute(job: dict[str, Any]) -> None:
    job_id = str(job.get("jobId") or "")
    record_id = str(job.get("recordId") or "")
    if not job_id or not record_id:
        raise ContextWorkerError("Job de indexación sin jobId o recordId", retryable=False)

    _backend_request(f"/internal/v1/context/index-jobs/{job_id}/start", method="POST", body={})
    canonical_response = _backend_request(job.get("canonicalEndpoint") or f"/internal/v1/context/minutes/{record_id}/canonical")
    canonical = canonical_response.get("canonical") or {}
    source_hash = str(canonical.get("sourceHash") or canonical_response.get("sourceHash") or "")
    document_id = str(job.get("documentId") or "")
    chunks = _canonical_chunks(canonical)
    if not chunks:
        raise ContextWorkerError("El JSON canónico no generó chunks indexables", retryable=False)

    provider = _get_provider("context_embeddings")
    dimensions = int(provider.get("embedding_dimensions") or 0)
    texts = [chunk["text"] for chunk in chunks]
    vectors: list[list[float]] = []
    for start in range(0, len(texts), max(1, INDEXING_BATCH_SIZE)):
        vectors.extend(_embed_texts(provider, texts[start:start + INDEXING_BATCH_SIZE]))
    actual_dimensions = len(vectors[0]) if vectors else 0
    if dimensions and actual_dimensions != dimensions:
        raise ContextWorkerError(
            f"Dimensiones incompatibles: binding={dimensions}, provider={actual_dimensions}",
            retryable=False,
        )
    dimensions = dimensions or actual_dimensions
    collection = _collection_name(provider, dimensions)
    _ensure_collection(collection, dimensions)
    _deactivate_existing_points(collection, str(job.get("recordId") or ""), str(job.get("versionId") or ""))

    points = []
    for chunk, vector in zip(chunks, vectors):
        points.append({"id": chunk["qdrantPointId"], "vector": vector, "payload": chunk["payload"]})
    _upsert_points(collection, points)

    complete_body = {
        "documentId": document_id,
        "sourceHash": source_hash,
        "embeddingProviderConfigId": provider["id"],
        "embeddingBindingId": provider.get("binding_id"),
        "embeddingModel": provider["model_name"],
        "embeddingDimensions": dimensions,
        "qdrantCollection": collection,
        "inputTokens": _estimate_input_tokens(texts),
        "outputTokens": 0,
        "providerUsageRawJson": {
            "estimated": True,
            "input_texts": len(texts),
            "input_characters": sum(len(text or "") for text in texts),
        },
        "providerMetaJson": {
            "job_type": job.get("type"),
            "parent_job_id": job.get("parentJobId"),
            "collection": collection,
        },
        "chunks": [
            {
                "id": chunk["id"],
                "sourceItemId": chunk["sourceItemId"],
                "itemType": chunk["itemType"],
                "chunkIndex": chunk["chunkIndex"],
                "chunkHash": chunk["chunkHash"],
                "qdrantPointId": chunk["qdrantPointId"],
            }
            for chunk in chunks
        ],
    }
    _backend_request(f"/internal/v1/context/index-jobs/{job_id}/complete", method="POST", body=complete_body)
    logger.info("Indexación completada | record=%s job=%s chunks=%d", record_id, job_id, len(chunks))


def _rebuild_collection() -> None:
    provider = _get_provider("context_embeddings")
    collection = _collection_name(provider)
    try:
        _json_request(
            f"{QDRANT_URL}/collections/{collection}",
            method="DELETE",
            headers=_qdrant_headers(),
            timeout=60,
        )
    except ContextWorkerError as exc:
        if "HTTP 404" not in str(exc):
            raise


def _answer_context_query(job: dict[str, Any]) -> None:
    query_id = str(job.get("queryId") or "")
    if not query_id:
        raise ContextWorkerError("Job de consulta contextual sin queryId", retryable=False)
    _backend_request(f"/internal/v1/context/query-runs/{query_id}/run", method="POST", body={})


def _expand_reindex_scope(job: dict[str, Any]) -> None:
    job_id = str(job.get("jobId") or "")
    if not job_id:
        raise ContextWorkerError("Job padre de reindexación sin jobId", retryable=False)
    result = _backend_request(f"/internal/v1/context/reindex-jobs/{job_id}/expand", method="POST", body={})
    logger.info(
        "Job padre de reindexación expandido | type=%s job=%s queued=%s skipped=%s",
        job.get("type"),
        job_id,
        result.get("queued"),
        result.get("skipped"),
    )


def _sync_context_status(job: dict[str, Any]) -> None:
    job_id = str(job.get("jobId") or "")
    result = _backend_request(
        "/internal/v1/context/sync/status",
        method="POST",
        body={"jobId": job_id} if job_id else {},
    )
    logger.info(
        "Sincronización de estados de contexto completada | job=%s stale=%s documents=%s",
        job_id or "-",
        result.get("staleJobsFailed"),
        result.get("documentsReconciled"),
    )


def _cleanup_minute_context(job: dict[str, Any]) -> None:
    job_id = str(job.get("jobId") or "")
    record_id = str(job.get("recordId") or "")
    version_id = str(job.get("versionId") or "")
    collections = [str(value) for value in (job.get("collections") or []) if value]
    if not job_id or not record_id:
        raise ContextWorkerError("Job de limpieza por minuta sin jobId o recordId", retryable=False)

    _backend_request(f"/internal/v1/context/index-jobs/{job_id}/start", method="POST", body={})
    deleted_collections: list[str] = []
    for collection in sorted(set(collections)):
        try:
            _delete_minute_points(collection, record_id, version_id)
            deleted_collections.append(collection)
        except ContextWorkerError as exc:
            if "HTTP 404" not in str(exc):
                raise
            logger.info("Colección Qdrant ausente durante limpieza por minuta | collection=%s", collection)

    _backend_request(
        f"/internal/v1/context/index-jobs/{job_id}/cleanup-complete",
        method="POST",
        body={
            "documentId": job.get("documentId"),
            "recordId": record_id,
            "versionId": version_id or None,
            "collections": deleted_collections,
        },
    )
    logger.info(
        "Limpieza por minuta completada | record=%s version=%s job=%s collections=%d",
        record_id,
        version_id or "-",
        job_id,
        len(deleted_collections),
    )


async def _handle_job(job: dict[str, Any]) -> None:
    job_type = str(job.get("type") or "")
    if job_type not in JOB_TYPES:
        logger.warning("Tipo de job no soportado | type=%s", job_type)
        return
    try:
        if job_type in {"index_minute_context", "reindex_minute_context"}:
            await asyncio.to_thread(_index_minute, job)
        elif job_type == "rebuild_qdrant_collection":
            await asyncio.to_thread(_rebuild_collection)
        elif job_type == "answer_context_query":
            await asyncio.to_thread(_answer_context_query, job)
        elif job_type in {"reindex_project_context", "reindex_client_context", "reindex_all_context"}:
            await asyncio.to_thread(_expand_reindex_scope, job)
        elif job_type == "sync_context_status":
            await asyncio.to_thread(_sync_context_status, job)
        elif job_type == "cleanup_minute_context":
            await asyncio.to_thread(_cleanup_minute_context, job)
        else:
            logger.info("Handler registrado sin expansión de alcance aún | type=%s payload=%s", job_type, job)
    except ContextWorkerError as exc:
        job_id = str(job.get("jobId") or "")
        attempt = int(job.get("attempt") or 0)
        will_retry = bool(exc.retryable and attempt < MAX_RETRIES)
        if job_id:
            try:
                _backend_request(
                    f"/internal/v1/context/index-jobs/{job_id}/fail",
                    method="POST",
                    body={"documentId": job.get("documentId"), "error": str(exc), "retryable": will_retry},
                )
            except Exception as report_exc:
                logger.warning("No se pudo reportar fallo de contexto | job=%s err=%s", job_id, report_exc)
        raise


async def main_loop() -> None:
    client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    logger.info("Context worker listo | queue=%s qdrant=%s", CONTEXT_QUEUE_NAME, QDRANT_URL)
    while _running:
        result = await client.blpop(CONTEXT_QUEUE_NAME, timeout=5)
        if not result:
            continue
        _, raw = result
        try:
            job = json.loads(raw)
            await _handle_job(job)
        except ContextWorkerError as exc:
            logger.exception("Job de contexto falló | retryable=%s error=%s raw=%s", exc.retryable, exc, str(raw)[:500])
            attempt = int((job if isinstance(job, dict) else {}).get("attempt") or 0)
            if exc.retryable and attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_BACKOFF_BASE ** attempt)
                next_job = dict(job)
                next_job["attempt"] = attempt + 1
                await client.rpush(CONTEXT_QUEUE_NAME, json.dumps(next_job, ensure_ascii=False))
                logger.info("Job de contexto reencolado | attempt=%d/%d job=%s", attempt + 1, MAX_RETRIES, next_job.get("jobId"))
            else:
                await asyncio.sleep(2)
        except Exception as exc:
            logger.exception("Job de contexto falló | error=%s raw=%s", exc, str(raw)[:500])
            await asyncio.sleep(2)
    await client.aclose()


def main() -> None:
    signal.signal(signal.SIGTERM, _handle_stop)
    signal.signal(signal.SIGINT, _handle_stop)
    while _running:
        try:
            asyncio.run(main_loop())
        except KeyboardInterrupt:
            break
        except Exception as exc:
            logger.exception("Loop del context-worker falló; reintentando | error=%s", exc)
            time.sleep(3)
    logger.info("Context worker detenido.")


if __name__ == "__main__":
    main()
