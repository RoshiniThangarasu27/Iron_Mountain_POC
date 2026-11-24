from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "doc_ingestion",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.celery_result_backend,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_extended=True,
    result_expires=None,
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_time_limit=settings.CELERY_TASK_TIME_LIMIT,
    task_soft_time_limit=max(settings.CELERY_TASK_TIME_LIMIT - 30, 10),
    broker_connection_retry_on_startup=True,
    database_engine_options={"pool_pre_ping": True},
    database_short_lived_sessions=True,
    timezone="UTC",
    enable_utc=True,
)
