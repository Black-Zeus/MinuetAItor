# services/openai_client.py
import logging
import asyncio
from openai import AsyncOpenAI
from core.config import settings

logger = logging.getLogger(__name__)
_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def upload_file_to_openai(content: bytes, filename: str) -> str:
    """Sube un archivo a OpenAI Files API y retorna el file_id."""
    client = get_openai_client()
    response = await client.files.create(
        file=(filename, content),
        purpose="assistants",
    )
    logger.info(f"Archivo subido a OpenAI: {filename} → {response.id}")
    return response.id


async def create_thread_and_run(
    system_prompt: str,
    user_message_text: str,
    file_ids: list[str],
) -> str:
    """
    Crea un thread en OpenAI con los archivos adjuntos y envía el mensaje.
    Retorna el thread_id para hacer polling posterior.
    """
    client = get_openai_client()
    
    # Construir el contenido del mensaje con archivos
    content = [{"type": "text", "text": user_message_text}]
    attachments = [
        {"file_id": fid, "tools": [{"type": "file_search"}]}
        for fid in file_ids
    ]
    
    thread = await client.beta.threads.create(
        messages=[{
            "role": "user",
            "content": content,
            "attachments": attachments,
        }]
    )
    
    # Iniciar run con el system prompt
    run = await client.beta.threads.runs.create(
        thread_id=thread.id,
        assistant_id=settings.openai_assistant_id,
        additional_instructions=system_prompt,
    )
    
    logger.info(f"Thread creado: {thread.id}, Run: {run.id}")
    return thread.id, run.id


async def poll_run_until_complete(thread_id: str, run_id: str) -> str:
    """
    Hace polling al run hasta completar. Retorna el texto de la respuesta.
    Lanza TimeoutError si supera el límite de intentos.
    """
    client = get_openai_client()
    attempts = 0
    max_attempts = settings.minutes_max_polling_attempts
    interval = settings.minutes_polling_interval_seconds

    while attempts < max_attempts:
        run = await client.beta.threads.runs.retrieve(
            thread_id=thread_id, run_id=run_id
        )
        
        if run.status == "completed":
            # Obtener mensajes del thread
            messages = await client.beta.threads.messages.list(thread_id=thread_id)
            for msg in messages.data:
                if msg.role == "assistant":
                    for block in msg.content:
                        if block.type == "text":
                            return block.text.value
            raise ValueError("Run completado pero sin respuesta de texto")
        
        elif run.status in ("failed", "cancelled", "expired"):
            raise ValueError(f"Run terminó con status: {run.status}")
        
        # Estados: queued, in_progress → seguir esperando
        await asyncio.sleep(interval)
        attempts += 1

    raise TimeoutError(f"Polling superó {max_attempts} intentos sin completar")


async def delete_thread(thread_id: str) -> None:
    """Cierra el thread de OpenAI para liberar recursos."""
    try:
        client = get_openai_client()
        await client.beta.threads.delete(thread_id)
        logger.info(f"Thread eliminado: {thread_id}")
    except Exception as e:
        logger.warning(f"No se pudo eliminar thread {thread_id}: {e}")