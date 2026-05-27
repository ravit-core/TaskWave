-- Migration 001: profiles table + auto-creation trigger + RLS
-- Apply via Supabase SQL Editor (QwIF.Co project)

create table if not exists public.profiles (
    id            uuid primary key references auth.users(id) on delete cascade,
    email         text,
    full_name     text,
    avatar_url    text,
    target_role   text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth.users row is inserted
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

-- Row-level security: each user can only read/update their own row
alter table public.profiles enable row level security;

drop policy if exists "self read"   on public.profiles;
drop policy if exists "self update" on public.profiles;

create policy "self read"
    on public.profiles for select
    using (auth.uid() = id);

create policy "self update"
    on public.profiles for update
    using (auth.uid() = id);

-- Backfill profile rows for any users that already exist
insert into public.profiles (id, email, full_name, avatar_url)
select
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
from auth.users u
on conflict (id) do nothing;
