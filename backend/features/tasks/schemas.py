from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

TaskStatus = Literal["pending", "done", "cancelled"]

# Named time ranges the voice agent and dashboard can ask for. The agent
# can also pass explicit (start, end) windows when it needs precision.
TaskRange = Literal[
    "today",
    "tomorrow",
    "today_morning",
    "today_afternoon",
    "today_evening",
    "tomorrow_morning",
    "tomorrow_afternoon",
    "tomorrow_evening",
    "this_week",
    "next_week",
    "upcoming",      # now → +7 days
    "overdue",       # scheduled_at < now AND status = pending
    "unscheduled",   # scheduled_at is null
    "all",
]


class Task(BaseModel):
    id: str
    user_id: str
    title: str
    notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    status: TaskStatus = "pending"
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=2000)
    scheduled_at: Optional[datetime] = None


class TaskPatch(BaseModel):
    """Partial update. None means 'leave unchanged'.
    To clear a nullable field, pass an explicit `clear_*` flag below."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=2000)
    scheduled_at: Optional[datetime] = None
    status: Optional[TaskStatus] = None
    clear_scheduled_at: bool = False
    clear_notes: bool = False
