create table if not exists public.games (
 room_code text primary key,
 fen text not null,
 turn text not null check (turn in ('white','black')),
 status text not null default 'waiting',
 white_id text,
 black_id text,
 updated_at timestamptz not null default now()
);
alter table public.games enable row level security;
create policy "public read games" on public.games for select using (true);
create policy "public insert games" on public.games for insert with check (true);
create policy "public update games" on public.games for update using (true) with check (true);
alter publication supabase_realtime add table public.games;
