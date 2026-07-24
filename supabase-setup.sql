-- Run this once in your Supabase project's SQL Editor.
-- It creates a simple per-user key/value table that Tikrar uses
-- to store your entries, phase, settings, etc.

create table if not exists public.tikrar_kv (
  user_id uuid references auth.users(id) not null,
  key text not null,
  value text,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

alter table public.tikrar_kv enable row level security;

create policy "Users manage their own data"
on public.tikrar_kv
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
