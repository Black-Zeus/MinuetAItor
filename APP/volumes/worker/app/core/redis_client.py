# core/redis_client.py
"""
Cliente Redis async compartido por todo el worker.
Una sola conexión, inicializada al arranque.
"""
import asyncio
import redis.asyncio as aioredis
from redis.exceptions import TimeoutError, ConnectionError

from core.config import settings
from core.logging_config import get_logger

logger = get_logger("worker.redis")

_client: aioredis.Redis | None = None
_connection_lock = asyncio.Lock()  # Evita condiciones de carrera en reconexión


async def get_redis() -> aioredis.Redis:
    """
    Retorna el cliente Redis global con manejo robusto de timeouts.
    Si no existe o está caído, lo (re)crea con reintentos.
    """
    global _client
    
    async with _connection_lock:  # Solo una corrutina intenta reconectar a la vez
        # Si el cliente existe, verificar que esté vivo
        if _client is not None:
            try:
                # Ping con timeout corto para verificar conexión
                await _client.ping()
                return _client
            except (ConnectionError, TimeoutError, OSError) as e:
                logger.warning("Conexión Redis perdida | error=%s | reconectando...", e)
                try:
                    await _client.aclose()
                except:
                    pass
                _client = None
        
        # Reconectar con reintentos exponenciales
        retry_count = 0
        max_retries = 5
        base_delay = 1
        
        while retry_count < max_retries:
            try:
                logger.info(
                    "Conectando a Redis | host=%s port=%s db=%s intento=%d/%d",
                    settings.REDIS_HOST, settings.REDIS_PORT, settings.REDIS_DB,
                    retry_count + 1, max_retries
                )
                
                _client = aioredis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    db=settings.REDIS_DB,
                    decode_responses=True,
                    socket_connect_timeout=5,      # Timeout para conexión inicial
                    socket_timeout=10,              # Timeout para operaciones (aumentado)
                    socket_keepalive=True,          # Mantener conexión viva
                    health_check_interval=30,       # Verificar salud cada 30 segundos
                    retry_on_timeout=True,
                    retry_on_error=[ConnectionError, TimeoutError],
                )
                
                # Verificar conexión
                await _client.ping()
                logger.info("Conexión Redis establecida exitosamente")
                return _client
                
            except (ConnectionError, TimeoutError, OSError) as e:
                retry_count += 1
                if retry_count < max_retries:
                    delay = base_delay * (2 ** (retry_count - 1))  # Backoff exponencial
                    logger.error(
                        "Error conectando a Redis | error=%s | reintentando en %.1fs...",
                        e, delay
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.critical(
                        "No se pudo conectar a Redis después de %d intentos",
                        max_retries
                    )
                    raise


async def close_redis() -> None:
    """Cierra la conexión Redis de forma segura."""
    global _client
    if _client:
        try:
            await _client.aclose()
            logger.info("Conexión Redis cerrada correctamente.")
        except Exception as e:
            logger.error("Error cerrando conexión Redis: %s", e)
        finally:
            _client = None