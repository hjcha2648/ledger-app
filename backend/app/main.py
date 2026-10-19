from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.routers import auth, categories, dashboard, subscriptions, transactions

# CloudFront는 /api/* 만 EC2로 전달하므로 문서 경로도 /api 아래에 둔다
app = FastAPI(
    title="Ledger API",
    docs_url="/api/docs" if settings.enable_docs else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.enable_docs else None,
)

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(subscriptions.router)
app.include_router(dashboard.router)


@app.get("/api/health", tags=["health"])
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "error", "db": "error"})
    return {"status": "ok", "db": "ok"}
