"""
Tasks HTTP router — READ-ONLY by design.

The TaskWave spec is voice-only CRUD. The dashboard renders the user's
current tasks via this endpoint; all writes flow through the voice agent
tool dispatcher (Phase 5). Exposing create/update/delete over HTTP would
contradict the product brief.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.dependencies import get_current_user
from features.tasks.schemas import Task, TaskRange
from features.tasks.service import list_tasks

router = APIRouter()


@router.get("", response_model=list[Task])
def list_my_tasks(
    range: Optional[TaskRange] = Query(default=None, description="Named time window"),
    include_done: bool = Query(default=True),
    include_cancelled: bool = Query(default=False),
    user=Depends(get_current_user),
) -> list[Task]:
    return list_tasks(
        user_id=str(user.id),
        range_name=range,
        include_done=include_done,
        include_cancelled=include_cancelled,
    )
