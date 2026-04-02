import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.parse import router as parse_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Statement Parser Service",
    description="Parsea resúmenes de tarjetas de crédito argentinas (BBVA, Galicia)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

app.include_router(parse_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
