from fastapi import FastAPI

from app.routers.claims import (
    router as claims_router
)

app = FastAPI(
    title="837 Repository API"
)

app.include_router(
    claims_router
)