-- Kanigiri secure online orders setup
-- Run in Supabase SQL Editor.

create table if not exists public.orders (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  order_data jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists order_data jsonb;
alter table public.orders add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.orders add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_user_id_idx on public.orders (user_id);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

alter table public.orders enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Orders owner or admin can select" on public.orders;
create policy "Orders owner or admin can select"
on public.orders
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Orders owner can insert" on public.orders;
create policy "Orders owner can insert"
on public.orders
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
on public.orders
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete orders" on public.orders;
create policy "Admins can delete orders"
on public.orders
for delete
to authenticated
using (public.is_admin());

-- Keep admin membership private.
drop policy if exists "No read access to admin users" on public.admin_users;
create policy "No read access to admin users"
on public.admin_users
for select
to authenticated
using (false);

drop policy if exists "No write access to admin users" on public.admin_users;
create policy "No write access to admin users"
on public.admin_users
for all
to authenticated
using (false)
with check (false);

-- Add an admin user after creating/signing up that user in Supabase Auth.
-- Example:
-- insert into public.admin_users (user_id)
-- select id
-- from auth.users
-- where email = 'you-admin@example.com'
-- on conflict (user_id) do nothing;
