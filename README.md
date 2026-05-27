# TaskWave AI — Voice Controlled Task Manager

> Manage your tasks **entirely** by voice. No buttons. No forms. Just talk.

TaskWave is a real-time voice agent: you speak, it understands, and your
tasks appear on a live kanban board. Create, list, update, move, mark
done, and delete — all through natural conversation.

**Stack:** Google **Gemini Live** (bidi audio + native tool calling) ·
**FastAPI** WebSocket bridge · **Supabase** (Postgres + email auth) ·
**Next.js 16** UI with AudioWorklet capture and gap-free PCM playback.

---

## Table of contents

1. [How it satisfies the brief](#how-it-satisfies-the-brief)
2. [Voice commands you can try](#voice-commands-you-can-try)
3. [Tech stack](#tech-stack)
4. [Architecture](#architecture)
5. [Setup (10 minutes)](#setup-10-minutes)
6. [First use](#first-use)
7. [Agent design](#agent-design)
8. [Failure handling](#failure-handling)
9. [Project structure](#project-structure)
10. [Troubleshooting](#troubleshooting)
11. [Security notes](#security-notes)

---

## How it satisfies the brief

| Brief requirement | How TaskWave implements it |
|---|---|
| **Voice CRUD** (create / read / update / delete) | 5 Gemini Live function tools: `create_task`, `create_tasks` (batch), `list_tasks`, `update_task`, `delete_task` |
| **No typing, no edit/delete buttons** | Dashboard is read-only. Cards display tasks; **every mutation flows through voice** |
| **STT** (speech-to-text) | Gemini Live native input audio transcription (16 kHz PCM) |
| **TTS** (text-to-speech) | Gemini Live native audio output (24 kHz PCM, Aoede voice) |
| **Real-time voice interaction** | Single bidirectional WebSocket — audio streams in both directions simultaneously |
| **Conversational AI workflows** | Single Gemini Live session retains turn history, uses tools, asks clarifying questions |
| **Context-aware responses** | Session memory handles "the previous one", "my evening workout", "move the second one" |
| **Storage** | Supabase Postgres (`tasks` table with RLS) |
| **Auth: signup / login / session** | Supabase email-and-password, session via Next.js middleware (`proxy.ts`) |
| **Interruption / barge-in** | Gemini Live VAD detects user speech mid-response → server emits `interrupted` event → client clears the audio queue |
| **Multiple-task batching** | `create_tasks` tool: *"Create three tasks for tomorrow morning…"* lands all three in one round trip |
| **Confirm before delete** | `delete_task` requires `confirmed=true`; system prompt mandates verbal confirmation first |
| **Time understanding** (today, tomorrow, evening, morning, afternoon) | `compute_range()` maps named ranges to UTC windows in the user's IANA timezone (`profiles.timezone`, auto-synced from browser) |
| **Semantic matching** ("my evening workout") | Agent lists tasks in the relevant window, picks by content match |
| **WebSocket disconnect recovery** | Auto-reconnect with exponential backoff (1s → 2s → 4s → 8s, 4 attempts) |
| **LLM timeout** | Backend watchdog: 30s without a Gemini message → emit error + close → frontend auto-reconnects |
| **Validate before execute** | Tool dispatcher validates args, returns `{ok: false, error}` for the model to recover from |
| **Low-latency conversational flow** | AudioWorklet for capture (50ms frames), AudioBufferSourceNode chain for gap-free playback |

---

## Voice commands you can try

These are the example flows from the brief — all work end-to-end.

### Create
- *"Create a task for syncing with the product manager at 10 AM."*
- *"Create a task for posting on LinkedIn at 5 PM."*

### Read / agenda
- *"What are today's evening tasks?"*
- *"Give me a brief about today's agenda."*
- *"What's coming up tomorrow morning?"*

### Update / move
- *"Change the LinkedIn task to 6 PM."*
- *"Actually change the previous one to 7 PM."* — resolved via session context
- *"Move the second one to tomorrow."* — resolved via context after `list_tasks`

### Semantic
- *"Move my evening workout to 7."* — agent finds the matching task by content

### Multi-task batch
- *"Create three tasks for tomorrow morning. Gym at 7 AM, team sync at 9 AM, and post on LinkedIn at 11 AM."*

### Delete (with confirmation)
- *"Delete the 9:15 task."*
- Agent: *"You have a 9:30 task and a 9:15 task. Delete the 9:15 one — is that right?"*
- *"Yes."*

### Interruption
While the agent is speaking, just talk. It stops mid-sentence, listens to you, and continues the conversation.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router · Turbopack) · React 19 · TypeScript · Tailwind v4 · framer-motion · lucide-react |
| Voice (STT + TTS + tool calling) | Google **Gemini Live** — `gemini-2.5-flash-native-audio-latest` over WebSocket |
| Audio capture | `AudioWorkletProcessor` — float32 mic → 16 kHz PCM16 mono → base64 over WS |
| Audio playback | `AudioBufferSourceNode` chain at 24 kHz, queue-cleared on barge-in |
| Backend | **FastAPI** + WebSocket bridge to Gemini Live; pure-function task service reused by the tool dispatcher |
| DB + Auth | **Supabase** — Postgres (RLS) + email auth, JWT verified server-side |
| Design system | Graphite & Coral palette · Instrument Serif wordmark · light + dark glass surfaces |

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │            Browser (Next.js)        │
                    │                                     │
   user voice ─┐    │  mic ─► AudioWorklet                │
               │    │   (downsample 48k → 16k PCM16)      │
               │    │              │                      │
               └────┼──────────────┼──► WebSocket ──┐     │
                    │                                │     │
   agent voice ◄────┼── AudioBufferSourceNode ◄──────┤     │
                    │   (24 kHz, gap-free, interruptible)  │
                    │                                │     │
                    │  Dashboard ◄── tool_result ────┘     │
                    │  (Today / Upcoming / Done cards)     │
                    └──────────────────┬───────────────────┘
                                       │
                                       │  WS  /api/voice/stream
                                       │  (JSON hello + audio frames)
                                       ▼
                    ┌─────────────────────────────────────┐
                    │            FastAPI Backend          │
                    │                                     │
                    │  Voice router:                      │
                    │   • JWT handshake via Supabase      │
                    │   • Opens Gemini Live session       │
                    │   • Pumps audio both ways           │
                    │   • 30 s watchdog on Gemini idle    │
                    │                                     │
                    │  Tool dispatcher ─► tasks.service:  │
                    │   • create_task / create_tasks      │
                    │   • list_tasks(range)               │
                    │   • update_task / delete_task       │
                    │                                     │
                    └──────┬───────────────────┬──────────┘
                           │                   │
                           ▼                   ▼
              ┌──────────────────┐   ┌────────────────────┐
              │  Gemini Live API │   │  Supabase Postgres │
              │  (audio + tools) │   │  profiles · tasks  │
              └──────────────────┘   └────────────────────┘
```

**One sentence:** the browser streams 16 kHz mic PCM over a WebSocket;
the backend pipes it into Gemini Live; Gemini emits either speech (24 kHz
PCM, fanned back to the browser) or tool calls (dispatched to the tasks
service against Supabase, scoped by `user_id`); tool results also go
back to the browser so the kanban board re-renders without polling.

---

## Setup (10 minutes)

### Prerequisites

| Tool | Min version |
|---|---|
| Node.js | 18 (tested on 20+) |
| Python | 3.11+ (tested on 3.14) |
| Git | any recent |

Free accounts:
- **Supabase** — https://supabase.com
- **Google AI Studio** — https://ai.google.dev

---

### STEP 1 — Clone

```bash
git clone <repo-url> TaskWave
cd TaskWave
```

---

### STEP 2 — Create a Supabase project

1. https://supabase.com → **New project** → pick a name (e.g. `taskwave-dev`), set a DB password, pick the nearest region. Wait ~1 minute.
2. **Authentication → Email Auth** — leave Email on. **Toggle "Confirm email" OFF** for local dev so signup gives you an immediate session (no SMTP setup needed).

---

### STEP 3 — Run the schema

Open **SQL Editor → New query**, paste this block, click **Run**. Idempotent (safe to re-run).

```sql
-- ─── profiles + auto-create trigger + RLS ────────────────────────────
create table if not exists public.profiles (
    id            uuid primary key references auth.users(id) on delete cascade,
    email         text,
    full_name     text,
    avatar_url    text,
    timezone      text not null default 'UTC',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.profiles (id, email, full_name, avatar_url)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
        coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
drop policy if exists "self read"   on public.profiles;
drop policy if exists "self update" on public.profiles;
create policy "self read"   on public.profiles for select using (auth.uid() = id);
create policy "self update" on public.profiles for update using (auth.uid() = id);

-- ─── tasks ───────────────────────────────────────────────────────────
create table if not exists public.tasks (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    title         text not null,
    notes         text,
    scheduled_at  timestamptz,
    status        text not null default 'pending'
        check (status in ('pending', 'done', 'cancelled')),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists tasks_user_scheduled_idx on public.tasks (user_id, scheduled_at);
create index if not exists tasks_user_created_idx   on public.tasks (user_id, created_at desc);

create or replace function public.tasks_touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
    before update on public.tasks
    for each row execute function public.tasks_touch_updated_at();

alter table public.tasks enable row level security;
drop policy if exists "tasks self read"   on public.tasks;
drop policy if exists "tasks self write"  on public.tasks;
drop policy if exists "tasks self update" on public.tasks;
drop policy if exists "tasks self delete" on public.tasks;
create policy "tasks self read"   on public.tasks for select using (auth.uid() = user_id);
create policy "tasks self write"  on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks self update" on public.tasks for update using (auth.uid() = user_id);
create policy "tasks self delete" on public.tasks for delete using (auth.uid() = user_id);
```

Verify under **Table Editor** that `profiles` and `tasks` both exist.

---

### STEP 4 — Grab your keys

**Supabase → Project Settings → API:**

| On screen | Save as |
|---|---|
| `Project URL` | `SUPABASE_URL` |
| `anon public` | `SUPABASE_ANON_KEY` |
| `service_role` (reveal) | `SUPABASE_SERVICE_ROLE_KEY` |

> `service_role` bypasses RLS — keep it backend-only, never in the browser.

**Google AI Studio → Get API key →** save as `GOOGLE_API_KEY`. Free tier = 1,500 req/day.

---

### STEP 5 — Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
# Server
PORT=8000
HOST=0.0.0.0
DEBUG=True
CORS_ORIGINS=http://localhost:3000

# Google Gemini
GOOGLE_API_KEY=<your key from STEP 4>
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-latest

# Supabase
SUPABASE_URL=<from STEP 4>
SUPABASE_KEY=<anon public from STEP 4>
SUPABASE_SERVICE_ROLE_KEY=<service_role from STEP 4>
```

Boot:

```bash
uvicorn main:app --reload
```

Verify: `curl http://localhost:8000/health` → `{"status":"healthy"}`.

---

### STEP 6 — Frontend

```bash
cd ../frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=<same Project URL from STEP 4>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same anon public from STEP 4>
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Boot:

```bash
npm run dev
```

Open **http://localhost:3000**.

---

## First use

1. Land on `/` → click **Get started** (or **Sign in →**).
2. **Create account** with email + password. (If email confirmation is ON in Supabase, check your inbox; otherwise you're signed in immediately.)
3. You arrive at `/dashboard`. The board has three columns — **Today**, **Upcoming**, **Done** — and a voice panel on the right.
4. Click the big mic button. Browser asks for microphone permission — allow it.
5. The agent greets you. Try the commands from [§ Voice commands](#voice-commands-you-can-try) above.
6. Tap the mic again to end the session.

**Watch the board move.** When the agent updates or completes a task, the card slides between columns (powered by framer-motion `LayoutGroup`).

---

## Agent design

The brief allows multi-agent designs (planner, conversation, execution, scheduling) but doesn't require them. TaskWave uses a **single Gemini Live agent with five function tools** — same capability surface, less moving parts.

### System prompt (excerpt)

```
You are TaskWave, a calm, focused voice assistant that helps the user
manage their personal task list entirely by voice. You speak naturally —
like a thoughtful colleague, never robotic. Keep responses short.

HARD RULES:
 1. You manage tasks ONLY through the provided function tools.
 2. Before DELETING anything, you must verbally confirm with the user
    and only call `delete_task` with `confirmed=true` after they
    explicitly say yes.
 3. Resolve "it", "that one", "the previous one", "the second one",
    "my evening workout" from recent conversation context.
 4. TIME IS ALWAYS CAPTURED. Any date or time hint → set scheduled_at_iso
    in the user's timezone. Never drop the time.
 5. When listing tasks, summarize conversationally — not as a flat list.
 6. The user cannot click anything. Never tell them to tap/click/open.
```

Full prompt in `backend/features/voice/prompts.py`.

### Tools

| Tool | Purpose |
|---|---|
| `create_task` | Single task with optional `scheduled_at_iso` and `notes` |
| `create_tasks` | Batch — for *"create three tasks: …"* |
| `list_tasks` | Named ranges (`today`, `tomorrow`, `today_evening`, `this_week`, `upcoming`, `overdue`, `unscheduled`, …) |
| `update_task` | Partial: title, notes, scheduled_at_iso, status, with `clear_*` flags |
| `delete_task` | Requires `confirmed=true` — protected by the system prompt rule + dispatcher check |

Implementations: `backend/features/voice/tools.py` (declarations + dispatcher) and `backend/features/tasks/service.py` (the actual Supabase queries).

---

## Failure handling

| Failure | How TaskWave responds |
|---|---|
| **Unclear command** | Agent asks one short clarifying question |
| **STT noise / mishears** | Handled inside Gemini Live |
| **TTS hiccup** | Handled inside Gemini Live |
| **WebSocket disconnect** | Frontend distinguishes user-stop from server-drop. On drop, retries 4 times with exponential backoff (1s → 2s → 4s → 8s). Mic shows an ochre "Reconnecting…" state. |
| **LLM timeout / Gemini stall** | Backend watchdog fires after 30s of silence from Gemini → sends `{type:"error"}` to client → closes WS → frontend auto-reconnect kicks in. The user sees the agent recover within ~1s. |
| **Invalid tool args / row not found** | Dispatcher returns `{ok: false, error}`. Model recovers verbally ("I couldn't find that task — could you describe it differently?"). |
| **Microphone permission denied** | Error displayed in voice panel; mic flips to disconnected state. |
| **Auth token expired** | API returns 401 → `lib/api.ts` signs the user out and redirects to `/auth?redirect=…`. |

The conversation thread does **not** survive a Gemini reconnect (Live sessions are stateful), but tasks in the database do — so a reconnect picks up cleanly even if it can't recall what you were just talking about.

---

## Project structure

```
TaskWave/
├── backend/
│   ├── main.py                  FastAPI entry; mounts /api/auth, /api/tasks, /api/voice
│   ├── core/
│   │   ├── config.py            Pydantic settings (.env)
│   │   ├── supabase.py          service-role admin client (cached)
│   │   └── dependencies.py      get_current_user() bearer-token guard
│   ├── features/
│   │   ├── auth/                GET /api/auth/me
│   │   ├── tasks/
│   │   │   ├── schemas.py       Task, TaskCreate, TaskPatch, TaskRange
│   │   │   ├── service.py       pure CRUD funcs reused by HTTP + voice
│   │   │   └── router.py        GET /api/tasks?range=…  (read-only)
│   │   └── voice/
│   │       ├── prompts.py       agent identity + hard rules
│   │       ├── tools.py         5 function declarations + dispatcher
│   │       └── router.py        WS /api/voice/stream + 30s Gemini watchdog
│   ├── migrations/  001_profiles.sql · 002_tasks.sql
│   ├── requirements.txt
│   └── .env                     ← you create
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx           root, loads Geist + Instrument Serif
│   │   ├── page.tsx             landing
│   │   ├── auth/page.tsx        email+password sign in / sign up
│   │   └── dashboard/
│   │       ├── layout.tsx
│   │       └── page.tsx         Today / Upcoming / Done + voice panel
│   ├── components/
│   │   ├── dashboard/           mic-button · agent-status · board-column ·
│   │   │                        task-card · transcript-overlay · voice-wave
│   │   └── ui/button.tsx        Graphite & Coral primitive
│   ├── lib/
│   │   ├── voice-client.ts      WS + AudioWorklet + PCM playback queue + auto-reconnect
│   │   ├── tasks-api.ts         typed listTasks()
│   │   ├── api.ts               auth-aware fetch (Bearer token + 401 handling)
│   │   ├── supabase.ts          browser client
│   │   ├── useUser.ts           profile hook + sign-out
│   │   └── utils.ts             cn(...)
│   ├── public/
│   │   ├── dashboard.png        screenshot used on landing
│   │   └── worklets/voice-recorder.js   mic → 16 kHz PCM16 worklet
│   ├── proxy.ts                 Next middleware: /dashboard auth guard
│   └── .env.local               ← you create
│
└── README.md
```

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Mic flips to error on click | `GOOGLE_API_KEY` missing or invalid (rotated/leaked keys get auto-revoked by Google). Get a fresh one at https://aistudio.google.com/apikey |
| `WebSocket 4001` close | JWT expired or Supabase keys mismatched between backend `.env` and frontend `.env.local`. Sign out and back in. |
| Mic connects but agent never speaks | Browser blocked mic — check the URL-bar permission icon |
| Signup completes but `/dashboard` redirects to `/auth` | Email confirmation is on in Supabase. Either click the confirmation link or toggle confirmation off (STEP 2) |
| Tool calls succeed but tasks don't appear | Frontend refreshes the list on every `tool_result`. If they're created but invisible, check the bucket logic — unscheduled tasks land in **Today**, overdue scheduled tasks also in **Today**. |
| Agent gets "tomorrow morning" wrong | Set `profiles.timezone` for your user (it auto-syncs from the browser on dashboard mount). Default is `UTC`. |
| Backend `ModuleNotFoundError` | Forgot `source venv/bin/activate` before `pip install` |
| Frontend type errors | Run `npm install` again to refresh `node_modules` |
| Reconnecting state never clears | After 4 attempts you'll see "Connection lost — tap the mic to try again." Check the backend is actually running (`curl localhost:8000/health`) |

---

## Security notes

- The `service_role` Supabase key bypasses RLS. **Backend-only.** Never in `NEXT_PUBLIC_*` env vars, never committed.
- The voice agent uses the service-role client on the backend, but every query against `tasks` is scoped by `user_id` in `features/tasks/service.py`. That scope is the only thing preventing cross-tenant reads — every new query *must* preserve it.
- The Gemini API key in `backend/.env` is sensitive. **If this repo goes public, rotate any key that has ever touched git history.** Google's secret scanner notices and revokes leaked keys automatically.
- WebSocket auth happens in the first frame: the client sends `{type:"hello", token}` and the server validates the Supabase JWT before opening the Gemini session. A bad/expired token closes the WS with code `4001`.

---

## License

Private. All rights reserved.
