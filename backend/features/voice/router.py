"""
Voice agent WebSocket router — `/api/voice/stream`.

Bidi audio + tool calling with Gemini Live. Auth happens in a setup
handshake (first client message must carry a Supabase bearer token).
Once verified we open a Live session, stream audio both ways, and
dispatch any tool calls the model emits to the tasks service.

Protocol (JSON text frames over the same WS):

  Client → Server:
    {type: "hello",  token: <supabase_jwt>}            -- setup, first frame
    {type: "audio",  data: <base64 pcm16 16kHz mono>}  -- mic chunk
    {type: "end"}                                       -- graceful close

  Server → Client:
    {type: "ready"}                                     -- after auth + Gemini connected
    {type: "audio",      data: <base64 pcm 24kHz mono>} -- model speech
    {type: "transcript", role: "user"|"agent", text}    -- live transcription
    {type: "tool_result", tool, result}                 -- dashboard sync hint
    {type: "turn_complete"}
    {type: "interrupted"}                               -- barge-in detected
    {type: "error", message}
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from google import genai
from google.genai import types as genai_types

from core.config import settings
from core.supabase import get_supabase_admin
from features.tasks.service import count_user_tasks, get_user_timezone
from features.voice.prompts import build_system_prompt
from features.voice.tools import TOOLS, dispatch

log = logging.getLogger(__name__)

router = APIRouter()


# ─── Auth handshake ───────────────────────────────────────────────────
async def _authenticate(websocket: WebSocket) -> str | None:
    """Wait for the {type:'hello', token} frame and validate the JWT."""
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
    except asyncio.TimeoutError:
        await websocket.close(code=4002, reason="auth timeout")
        return None

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        await websocket.close(code=4002, reason="malformed hello")
        return None

    if payload.get("type") != "hello" or not payload.get("token"):
        await websocket.close(code=4002, reason="hello frame missing token")
        return None

    try:
        result = get_supabase_admin().auth.get_user(payload["token"])
        if not result.user:
            raise ValueError("no user")
        return str(result.user.id)
    except Exception:
        await websocket.close(code=4001, reason="invalid token")
        return None


# ─── WebSocket endpoint ───────────────────────────────────────────────
@router.websocket("/stream")
async def voice_stream(websocket: WebSocket) -> None:
    await websocket.accept()

    user_id = await _authenticate(websocket)
    if not user_id:
        return

    if not settings.google_api_key:
        await websocket.send_json({"type": "error", "message": "GOOGLE_API_KEY not configured on the server"})
        await websocket.close(code=1011, reason="missing GOOGLE_API_KEY")
        return

    tz = get_user_timezone(user_id)
    system_prompt = build_system_prompt(tz=tz)
    is_first_session = count_user_tasks(user_id) == 0

    live_config = genai_types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=genai_types.Content(
            parts=[genai_types.Part(text=system_prompt)]
        ),
        speech_config=genai_types.SpeechConfig(
            voice_config=genai_types.VoiceConfig(
                prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(voice_name="Aoede")
            )
        ),
        input_audio_transcription=genai_types.AudioTranscriptionConfig(),
        output_audio_transcription=genai_types.AudioTranscriptionConfig(),
        tools=TOOLS,
    )

    client = genai.Client(api_key=settings.google_api_key)

    try:
        async with client.aio.live.connect(
            model=settings.gemini_live_model,
            config=live_config,
        ) as session:
            # Tell the client whether a verbal greeting is coming. The
            # client uses this to decide whether to gate the mic for the
            # first turn (preventing the speaker→mic feedback loop on
            # the greeting). Returning users get NO greeting — the agent
            # stays silent until the user speaks first.
            await websocket.send_json({
                "type": "ready",
                "will_greet": is_first_session,
            })

            if is_first_session:
                opener = (
                    "Greet the user in ONE very short sentence — under 12 words. "
                    "Something like: \"Welcome to TaskWave, I'm your voice agent — tell me a task.\""
                )
                await session.send_client_content(
                    turns=genai_types.Content(
                        role="user",
                        parts=[genai_types.Part(text=opener)],
                    ),
                    turn_complete=True,
                )

            from_client_task = asyncio.create_task(_pump_client_to_gemini(websocket, session))
            from_gemini_task = asyncio.create_task(_pump_gemini_to_client(websocket, session, user_id))

            done, pending = await asyncio.wait(
                {from_client_task, from_gemini_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending:
                t.cancel()

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        log.exception("voice session crashed")
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
            await websocket.close(code=1011)
        except Exception:
            pass


# ─── Pump: frontend → Gemini ──────────────────────────────────────────
async def _pump_client_to_gemini(websocket: WebSocket, session) -> None:
    try:
        async for raw in websocket.iter_text():
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue
            kind = payload.get("type")
            if kind == "audio":
                data_b64 = payload.get("data") or ""
                try:
                    audio_bytes = base64.b64decode(data_b64)
                except Exception:
                    continue
                await session.send_realtime_input(
                    audio=genai_types.Blob(
                        data=audio_bytes,
                        mime_type="audio/pcm;rate=16000",
                    )
                )
            elif kind == "end":
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.debug("client pump ended: %s", exc)


# Gemini watchdog: if no message arrives within this window, treat the
# upstream session as stalled, send an error to the client, and exit.
# This is the SAFETY NET — the frontend has its own 60s idle timeout
# that should fire first during normal silent waits. We keep this
# longer (120s) so user-thinking pauses don't kill valid sessions.
GEMINI_IDLE_TIMEOUT = 120.0


# ─── Pump: Gemini → frontend (+ tool dispatch) ────────────────────────
async def _pump_gemini_to_client(websocket: WebSocket, session, user_id: str) -> None:
    """
    Forward Gemini Live messages to the client for the entire session.

    Gemini Live's `session.receive()` returns a stream that yields the
    messages for ONE turn and then ends (StopAsyncIteration). We need
    to re-subscribe in an outer loop to keep processing subsequent
    turns — otherwise the WS would close after the first agent reply.
    """
    audio_chunks = 0
    try:
        while True:
            stream = session.receive().__aiter__()
            got_message = False
            while True:
                try:
                    message = await asyncio.wait_for(
                        stream.__anext__(), timeout=GEMINI_IDLE_TIMEOUT
                    )
                except asyncio.TimeoutError:
                    log.warning("gemini idle for %.0fs — closing session", GEMINI_IDLE_TIMEOUT)
                    await _safe_send(websocket, {
                        "type": "error",
                        "message": f"Voice agent stopped responding for {int(GEMINI_IDLE_TIMEOUT)}s.",
                    })
                    return
                except StopAsyncIteration:
                    # End of this turn's stream; outer loop re-subscribes
                    # for the next turn.
                    break

                got_message = True

                # ── Tool calls ──
                if message.tool_call:
                    responses: list[genai_types.FunctionResponse] = []
                    for call in message.tool_call.function_calls or []:
                        result = await asyncio.to_thread(
                            dispatch, user_id, call.name, dict(call.args or {})
                        )
                        # Broadcast to frontend so dashboard updates in real-time
                        await _safe_send(websocket, {
                            "type": "tool_result",
                            "tool": call.name,
                            "args": dict(call.args or {}),
                            "result": result,
                        })
                        responses.append(genai_types.FunctionResponse(
                            id=call.id,
                            name=call.name,
                            response=result,
                        ))
                    if responses:
                        await session.send_tool_response(function_responses=responses)
                    continue

                sc = message.server_content
                if not sc:
                    continue

                # ── Audio output ──
                if sc.model_turn:
                    for part in sc.model_turn.parts or []:
                        if part.inline_data and (part.inline_data.mime_type or "").startswith("audio/pcm"):
                            audio_chunks += 1
                            audio_b64 = base64.b64encode(part.inline_data.data).decode()
                            await _safe_send(websocket, {"type": "audio", "data": audio_b64})

                # ── Transcripts ──
                if sc.output_transcription and sc.output_transcription.text:
                    txt = sc.output_transcription.text
                    if not _is_non_english_script(txt):
                        await _safe_send(websocket, {
                            "type": "transcript",
                            "role": "agent",
                            "text": txt,
                        })
                if sc.input_transcription and sc.input_transcription.text:
                    txt = sc.input_transcription.text
                    if not _is_non_english_script(txt):
                        await _safe_send(websocket, {
                            "type": "transcript",
                            "role": "user",
                            "text": txt,
                        })

                # ── Lifecycle ──
                if sc.interrupted:
                    await _safe_send(websocket, {"type": "interrupted"})
                if sc.turn_complete:
                    await _safe_send(websocket, {"type": "turn_complete"})

            if not got_message:
                # session.receive() returned an empty iterator → session
                # was closed by Gemini (not a turn boundary). Stop.
                log.info("gemini session ended (%d audio chunks forwarded)", audio_chunks)
                break
    except asyncio.CancelledError:
        # Normal: peer task ended first and cancelled us.
        raise
    except Exception as exc:
        log.debug("gemini pump ended: %s", exc)
        await _safe_send(websocket, {"type": "error", "message": str(exc)})


async def _safe_send(websocket: WebSocket, payload: dict[str, Any]) -> None:
    try:
        await websocket.send_json(payload)
    except Exception:
        pass


# Unicode ranges for non-Latin scripts we want to suppress in transcripts.
# Gemini Live STT can hallucinate Telugu/Devanagari/CJK/Arabic spellings
# when the speaker has an accent, even though the prompt forces English.
# When that happens we drop the transcript line instead of showing
# garbage to the user.
def _is_non_english_script(text: str) -> bool:
    foreign = 0
    for ch in text:
        cp = ord(ch)
        if (
            0x0590 <= cp <= 0x07FF       # Hebrew, Arabic, Syriac
            or 0x0900 <= cp <= 0x0DFF    # Devanagari, Bengali, Tamil, Telugu, Kannada, Malayalam
            or 0x0E00 <= cp <= 0x0FFF    # Thai, Lao, Tibetan
            or 0x3040 <= cp <= 0x9FFF    # Hiragana, Katakana, CJK
            or 0xA000 <= cp <= 0xA4CF    # Yi
            or 0xAC00 <= cp <= 0xD7AF    # Hangul
        ):
            foreign += 1
    # Allow a couple of stray glyphs (e.g. punctuation oddities) but
    # drop anything clearly non-Latin.
    return foreign >= 2
