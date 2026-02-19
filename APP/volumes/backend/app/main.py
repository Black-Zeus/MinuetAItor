# main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.middleware import ResponseContractMiddleware, GeoBlockMiddleware, register_exception_handlers
from db.redis import close_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_redis()


app = FastAPI(
    title="MinuetAItor API",
    version="1.0.0",
    docs_url="/docs" if settings.env_name != "prod" else None,
    redoc_url="/redoc" if settings.env_name != "prod" else None,
    lifespan=lifespan,
)

# ── Middlewares ───────────────────────────────────────
# Orden importante: se apilan de abajo hacia arriba
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.env_name == "dev" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GeoBlockMiddleware)
app.add_middleware(ResponseContractMiddleware)

register_exception_handlers(app)

# ── Routers ───────────────────────────────────────────
from routers.v1.auth import router as auth_router
app.include_router(auth_router, prefix="/v1")


@app.get("/", tags=["System"])
def root():
    return {"response":"consulte el endpoint correcto"}


@app.get("/health", tags=["System"])
def health():
    return {"env": settings.env_name, "status": "running"}