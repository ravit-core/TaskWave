"""
Voice agent tool declarations + dispatcher.

The Gemini Live model is given five function declarations. When the
model decides to act on the user's request, it emits a `tool_call` with
a function name + JSON arguments. We dispatch to `features.tasks.service`,
execute against Supabase scoped to the authenticated user_id, and return
a `FunctionResponse` for the model to fold into its next utterance.

We also broadcast a side-channel `tool_result` event to the frontend so
the dashboard task list can update in real-time without polling.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Callable

from google.genai import types as genai_types

from features.tasks import service as tasks_service
from features.tasks.schemas import TaskCreate, TaskPatch

log = logging.getLogger(__name__)


# ─── Function declarations ────────────────────────────────────────────
# Schema follows the OpenAPI-3-ish dialect Gemini Live expects. Keep
# descriptions tight — the model reads them to pick the right tool.

_TASK_ID_DESC = "UUID of the task. Obtain from a prior list_tasks call."
_ISO_DESC = (
    "ISO 8601 timestamp with timezone offset (e.g. '2026-05-26T18:00:00+05:30'). "
    "Convert the user's natural-language time into this format using their timezone."
)

FUNCTION_DECLARATIONS: list[genai_types.FunctionDeclaration] = [
    genai_types.FunctionDeclaration(
        name="create_task",
        description="Create a single task for the user.",
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "title": genai_types.Schema(type=genai_types.Type.STRING, description="Short task title, plain text."),
                "scheduled_at_iso": genai_types.Schema(type=genai_types.Type.STRING, description=_ISO_DESC + " Omit for unscheduled tasks."),
                "notes": genai_types.Schema(type=genai_types.Type.STRING, description="Optional longer description."),
            },
            required=["title"],
        ),
    ),
    genai_types.FunctionDeclaration(
        name="create_tasks",
        description="Create multiple tasks at once. Use for batched requests like 'create three tasks: ...'.",
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "items": genai_types.Schema(
                    type=genai_types.Type.ARRAY,
                    description="List of tasks to create.",
                    items=genai_types.Schema(
                        type=genai_types.Type.OBJECT,
                        properties={
                            "title": genai_types.Schema(type=genai_types.Type.STRING),
                            "scheduled_at_iso": genai_types.Schema(type=genai_types.Type.STRING, description=_ISO_DESC),
                            "notes": genai_types.Schema(type=genai_types.Type.STRING),
                        },
                        required=["title"],
                    ),
                ),
            },
            required=["items"],
        ),
    ),
    genai_types.FunctionDeclaration(
        name="list_tasks",
        description=(
            "Look up the user's tasks. Use a named `range` when the user asks colloquially "
            "('today', 'evening', 'tomorrow morning', 'this week'). Use this any time you "
            "need to reference a specific task before updating or deleting it."
        ),
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "range": genai_types.Schema(
                    type=genai_types.Type.STRING,
                    description=(
                        "One of: today, tomorrow, today_morning, today_afternoon, today_evening, "
                        "tomorrow_morning, tomorrow_afternoon, tomorrow_evening, this_week, "
                        "next_week, upcoming, overdue, unscheduled, all. Default: today."
                    ),
                ),
                "include_done": genai_types.Schema(type=genai_types.Type.BOOLEAN, description="Default true."),
            },
        ),
    ),
    genai_types.FunctionDeclaration(
        name="update_task",
        description="Modify an existing task. Pass only the fields the user wants to change.",
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "task_id": genai_types.Schema(type=genai_types.Type.STRING, description=_TASK_ID_DESC),
                "title": genai_types.Schema(type=genai_types.Type.STRING),
                "scheduled_at_iso": genai_types.Schema(type=genai_types.Type.STRING, description=_ISO_DESC),
                "notes": genai_types.Schema(type=genai_types.Type.STRING),
                "status": genai_types.Schema(
                    type=genai_types.Type.STRING,
                    description="One of: pending, done, cancelled. Set 'done' when user says they finished it.",
                ),
                "clear_scheduled_at": genai_types.Schema(type=genai_types.Type.BOOLEAN, description="True to remove the existing schedule."),
            },
            required=["task_id"],
        ),
    ),
    genai_types.FunctionDeclaration(
        name="delete_task",
        description=(
            "Delete a task permanently. MUST verbally confirm with the user first; "
            "only call this with `confirmed=true` after they explicitly say yes."
        ),
        parameters=genai_types.Schema(
            type=genai_types.Type.OBJECT,
            properties={
                "task_id": genai_types.Schema(type=genai_types.Type.STRING, description=_TASK_ID_DESC),
                "confirmed": genai_types.Schema(type=genai_types.Type.BOOLEAN, description="Must be true. Reject otherwise."),
            },
            required=["task_id", "confirmed"],
        ),
    ),
]

TOOLS: list[genai_types.Tool] = [genai_types.Tool(function_declarations=FUNCTION_DECLARATIONS)]


# ─── Dispatcher ───────────────────────────────────────────────────────
def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        # Python 3.11+ accepts the "Z" suffix; we normalize anyway.
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _task_to_dict(t) -> dict[str, Any]:
    """Compact projection sent to the model + frontend."""
    return {
        "id": t.id,
        "title": t.title,
        "scheduled_at": t.scheduled_at.isoformat() if t.scheduled_at else None,
        "status": t.status,
        "notes": t.notes,
    }


def _do_create_task(user_id: str, args: dict) -> dict[str, Any]:
    title = (args.get("title") or "").strip()
    if not title:
        return {"ok": False, "error": "title is required"}
    task = tasks_service.create_task(
        user_id=user_id,
        data=TaskCreate(
            title=title,
            notes=args.get("notes"),
            scheduled_at=_parse_iso(args.get("scheduled_at_iso")),
        ),
    )
    return {"ok": True, "task": _task_to_dict(task)}


def _do_create_tasks(user_id: str, args: dict) -> dict[str, Any]:
    raw_items = args.get("items") or []
    if not isinstance(raw_items, list) or not raw_items:
        return {"ok": False, "error": "items must be a non-empty list"}
    payload: list[TaskCreate] = []
    for it in raw_items:
        title = (it.get("title") or "").strip()
        if not title:
            continue
        payload.append(TaskCreate(
            title=title,
            notes=it.get("notes"),
            scheduled_at=_parse_iso(it.get("scheduled_at_iso")),
        ))
    if not payload:
        return {"ok": False, "error": "no valid tasks in items"}
    created = tasks_service.create_tasks(user_id=user_id, items=payload)
    return {"ok": True, "tasks": [_task_to_dict(t) for t in created], "count": len(created)}


def _do_list_tasks(user_id: str, args: dict) -> dict[str, Any]:
    range_name = args.get("range") or "today"
    include_done = bool(args.get("include_done", True))
    tasks = tasks_service.list_tasks(
        user_id=user_id,
        range_name=range_name,
        include_done=include_done,
    )
    return {
        "ok": True,
        "range": range_name,
        "count": len(tasks),
        "tasks": [_task_to_dict(t) for t in tasks],
    }


def _do_update_task(user_id: str, args: dict) -> dict[str, Any]:
    task_id = args.get("task_id")
    if not task_id:
        return {"ok": False, "error": "task_id is required"}
    patch = TaskPatch(
        title=args.get("title"),
        notes=args.get("notes"),
        scheduled_at=_parse_iso(args.get("scheduled_at_iso")),
        status=args.get("status"),
        clear_scheduled_at=bool(args.get("clear_scheduled_at", False)),
    )
    task = tasks_service.update_task(user_id=user_id, task_id=task_id, patch=patch)
    if not task:
        return {"ok": False, "error": "task not found"}
    return {"ok": True, "task": _task_to_dict(task)}


def _do_delete_task(user_id: str, args: dict) -> dict[str, Any]:
    if not args.get("confirmed"):
        return {
            "ok": False,
            "requires_confirmation": True,
            "error": "Verbal confirmation from the user is required. Ask them, then retry with confirmed=true.",
        }
    task_id = args.get("task_id")
    if not task_id:
        return {"ok": False, "error": "task_id is required"}
    deleted = tasks_service.delete_task(user_id=user_id, task_id=task_id)
    if not deleted:
        return {"ok": False, "error": "task not found"}
    return {"ok": True, "deleted_task_id": task_id}


_HANDLERS: dict[str, Callable[[str, dict], dict[str, Any]]] = {
    "create_task": _do_create_task,
    "create_tasks": _do_create_tasks,
    "list_tasks": _do_list_tasks,
    "update_task": _do_update_task,
    "delete_task": _do_delete_task,
}


def dispatch(user_id: str, name: str, args: dict | None) -> dict[str, Any]:
    """Run a tool call and return the response payload."""
    log.info("tool_call %s args=%s", name, args)
    handler = _HANDLERS.get(name)
    if not handler:
        log.warning("unknown tool: %s", name)
        return {"ok": False, "error": f"unknown tool: {name}"}
    try:
        result = handler(user_id, args or {})
        log.info("tool_result %s ok=%s", name, result.get("ok"))
        return result
    except Exception as exc:  # noqa: BLE001
        log.exception("tool %s failed", name)
        return {"ok": False, "error": f"tool execution failed: {exc}"}
