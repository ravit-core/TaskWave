"""
Tasks service — pure functions used by both the HTTP read endpoint and
the voice agent's tool calls.

All queries scope by `user_id` explicitly because we use the service-role
Supabase client (which bypasses RLS). Forgetting the filter would expose
cross-tenant data, so every method takes user_id as the first argument.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from core.supabase import get_supabase_admin
from features.tasks.schemas import Task, TaskCreate, TaskPatch, TaskRange


# ─── Timezone resolution ──────────────────────────────────────────────
def get_user_timezone(user_id: str) -> ZoneInfo:
    """Look up the user's IANA timezone from profiles. Falls back to UTC."""
    admin = get_supabase_admin()
    res = (
        admin.table("profiles")
        .select("timezone")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    tz_name = (res.data or {}).get("timezone") or "UTC"
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


# ─── Time-range → UTC window ──────────────────────────────────────────
_PART_HOURS = {
    "morning":   (6, 12),
    "afternoon": (12, 17),
    "evening":   (17, 22),
}


def compute_range(range_name: TaskRange, tz: ZoneInfo) -> tuple[Optional[datetime], Optional[datetime]]:
    """
    Translate a named range into a UTC (start, end) window.

    Returns (None, None) for `all` and `unscheduled` — those need
    different query shapes handled by `list_tasks`.
    Returns (None, end_utc) for `overdue`.
    """
    now_local = datetime.now(tz)
    midnight_today = now_local.replace(hour=0, minute=0, second=0, microsecond=0)

    if range_name == "all" or range_name == "unscheduled":
        return None, None

    if range_name == "overdue":
        return None, now_local.astimezone(timezone.utc)

    if range_name == "today":
        start, end = midnight_today, midnight_today + timedelta(days=1)
    elif range_name == "tomorrow":
        start = midnight_today + timedelta(days=1)
        end = start + timedelta(days=1)
    elif range_name == "this_week":
        start = midnight_today - timedelta(days=midnight_today.weekday())
        end = start + timedelta(days=7)
    elif range_name == "next_week":
        this_monday = midnight_today - timedelta(days=midnight_today.weekday())
        start = this_monday + timedelta(days=7)
        end = start + timedelta(days=7)
    elif range_name == "upcoming":
        start, end = now_local, midnight_today + timedelta(days=7)
    elif range_name.startswith("today_") or range_name.startswith("tomorrow_"):
        day, part = range_name.split("_", 1)
        base = midnight_today if day == "today" else midnight_today + timedelta(days=1)
        h_start, h_end = _PART_HOURS[part]
        start = base.replace(hour=h_start)
        end = base.replace(hour=h_end)
    else:
        raise ValueError(f"Unknown range: {range_name}")

    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


# ─── CRUD ─────────────────────────────────────────────────────────────
def list_tasks(
    user_id: str,
    *,
    range_name: Optional[TaskRange] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    include_cancelled: bool = False,
    include_done: bool = True,
) -> list[Task]:
    """
    List a user's tasks. Either pass `range_name` (resolved against the
    user's timezone) OR explicit `start`/`end` UTC datetimes. Both
    optional → returns all tasks.
    """
    admin = get_supabase_admin()
    q = admin.table("tasks").select("*").eq("user_id", user_id)

    if range_name == "unscheduled":
        q = q.is_("scheduled_at", "null")
    elif range_name == "overdue":
        # status = pending AND scheduled_at < now
        tz = get_user_timezone(user_id)
        now_utc = datetime.now(tz).astimezone(timezone.utc)
        q = q.lt("scheduled_at", now_utc.isoformat()).eq("status", "pending")
    elif range_name and range_name != "all":
        tz = get_user_timezone(user_id)
        rs, re_ = compute_range(range_name, tz)
        if rs is not None:
            q = q.gte("scheduled_at", rs.isoformat())
        if re_ is not None:
            q = q.lt("scheduled_at", re_.isoformat())
    else:
        if start is not None:
            q = q.gte("scheduled_at", start.isoformat())
        if end is not None:
            q = q.lt("scheduled_at", end.isoformat())

    if not include_cancelled:
        q = q.neq("status", "cancelled")
    if not include_done and range_name != "overdue":
        q = q.neq("status", "done")

    # Pending first, then by scheduled_at asc (nulls last), then created.
    q = q.order("scheduled_at", desc=False, nullsfirst=False).order("created_at", desc=False)

    res = q.execute()
    return [Task(**row) for row in (res.data or [])]


def get_task(user_id: str, task_id: str) -> Optional[Task]:
    admin = get_supabase_admin()
    res = (
        admin.table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("id", task_id)
        .maybe_single()
        .execute()
    )
    return Task(**res.data) if res.data else None


def create_task(user_id: str, data: TaskCreate) -> Task:
    admin = get_supabase_admin()
    payload = {
        "user_id": user_id,
        "title": data.title.strip(),
        "notes": data.notes,
        "scheduled_at": data.scheduled_at.isoformat() if data.scheduled_at else None,
    }
    res = admin.table("tasks").insert(payload).execute()
    if not res.data:
        raise RuntimeError("insert returned no row")
    return Task(**res.data[0])


def create_tasks(user_id: str, items: list[TaskCreate]) -> list[Task]:
    if not items:
        return []
    admin = get_supabase_admin()
    payload = [
        {
            "user_id": user_id,
            "title": item.title.strip(),
            "notes": item.notes,
            "scheduled_at": item.scheduled_at.isoformat() if item.scheduled_at else None,
        }
        for item in items
    ]
    res = admin.table("tasks").insert(payload).execute()
    return [Task(**row) for row in (res.data or [])]


def update_task(user_id: str, task_id: str, patch: TaskPatch) -> Optional[Task]:
    changes: dict = {}
    if patch.title is not None:
        changes["title"] = patch.title.strip()

    if patch.clear_notes:
        changes["notes"] = None
    elif patch.notes is not None:
        changes["notes"] = patch.notes

    if patch.clear_scheduled_at:
        changes["scheduled_at"] = None
    elif patch.scheduled_at is not None:
        changes["scheduled_at"] = patch.scheduled_at.isoformat()

    if patch.status is not None:
        changes["status"] = patch.status

    if not changes:
        return get_task(user_id, task_id)

    admin = get_supabase_admin()
    res = (
        admin.table("tasks")
        .update(changes)
        .eq("user_id", user_id)
        .eq("id", task_id)
        .execute()
    )
    return Task(**res.data[0]) if res.data else None


def delete_task(user_id: str, task_id: str) -> bool:
    """Hard delete. Returns True if a row was removed."""
    admin = get_supabase_admin()
    res = (
        admin.table("tasks")
        .delete()
        .eq("user_id", user_id)
        .eq("id", task_id)
        .execute()
    )
    return bool(res.data)


def count_user_tasks(user_id: str) -> int:
    """Returns 0 if the user has no tasks, 1+ if they have any. Cheap
    proxy for 'has this user used TaskWave before?' — used by the voice
    agent to pick a first-time vs returning greeting. We only need the
    'any vs none' bit, so we limit(1)."""
    admin = get_supabase_admin()
    res = (
        admin.table("tasks")  # type: ignore[attr-defined]
        .select("id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return len(res.data or [])
