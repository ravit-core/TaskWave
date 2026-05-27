-- Migration 002: TaskWave AI — tasks table + user timezone
-- Apply via Supabase SQL Editor.
--
-- TaskWave persistence model:
--   public.profiles.timezone  — IANA tz string; voice agent uses it to resolve
--                                "today evening", "tomorrow morning", etc.
--   public.tasks              — single source of truth for user tasks.
--
-- RLS: every row scoped to its owner. Service-role bypasses RLS (backend
-- voice agent uses service role since user_id is server-known after JWT
-- verification in the WebSocket setup handshake).

-- ─── profiles.timezone ────────────────────────────────────────────────
alter table public.profiles
    add column if not exists timezone text not null default 'UTC';

comment on column public.profiles.timezone is
    'IANA timezone string (e.g. "Asia/Kolkata"). Used by the voice agent to resolve relative time phrases.';


-- ─── tasks ────────────────────────────────────────────────────────────
create table if not exists public.tasks (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,

    title         text not null,
    notes         text,

    -- nullable: a task can be "unscheduled" until the user gives a time
    scheduled_at  timestamptz,

    status        text not null default 'pending'
        check (status in ('pending', 'done', 'cancelled')),

    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Filter pattern: "my tasks today" / "evening" → user_id + scheduled_at window.
create index if not exists tasks_user_scheduled_idx
    on public.tasks (user_id, scheduled_at);

-- Recently-touched index for "what did I just create" lookups.
create index if not exists tasks_user_created_idx
    on public.tasks (user_id, created_at desc);


-- ─── updated_at auto-touch ────────────────────────────────────────────
create or replace function public.tasks_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
    before update on public.tasks
    for each row execute function public.tasks_touch_updated_at();


-- ─── RLS ──────────────────────────────────────────────────────────────
alter table public.tasks enable row level security;

drop policy if exists "tasks self read"   on public.tasks;
drop policy if exists "tasks self write"  on public.tasks;
drop policy if exists "tasks self update" on public.tasks;
drop policy if exists "tasks self delete" on public.tasks;

create policy "tasks self read"   on public.tasks
    for select using (auth.uid() = user_id);

create policy "tasks self write"  on public.tasks
    for insert with check (auth.uid() = user_id);

create policy "tasks self update" on public.tasks
    for update using (auth.uid() = user_id);

create policy "tasks self delete" on public.tasks
    for delete using (auth.uid() = user_id);
