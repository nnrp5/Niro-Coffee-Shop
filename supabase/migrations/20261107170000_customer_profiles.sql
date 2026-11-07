create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists private.noir_admin_allowlist (
  email text primary key check (email = lower(email))
);
revoke all on table private.noir_admin_allowlist from public, anon, authenticated;

create table if not exists public.customer_profiles (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  customer_name text check (char_length(customer_name) <= 120),
  email text not null unique,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
revoke all on table public.customer_profiles from public, anon, authenticated;
grant select on table public.customer_profiles to authenticated;
grant update (customer_name) on table public.customer_profiles to authenticated;

create or replace function private.is_noir_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.customer_profiles p
    where p.customer_id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function private.is_noir_admin() from public, anon;
grant execute on function private.is_noir_admin() to authenticated;

drop policy if exists customer_profiles_read_self_or_admin on public.customer_profiles;
create policy customer_profiles_read_self_or_admin
  on public.customer_profiles for select to authenticated
  using (customer_id = (select auth.uid()) or (select private.is_noir_admin()));
drop policy if exists customer_profiles_update_own_name on public.customer_profiles;
create policy customer_profiles_update_own_name
  on public.customer_profiles for update to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create or replace function private.sync_customer_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
begin
  if new.email is null then
    return new;
  end if;
  select exists (
    select 1 from private.noir_admin_allowlist a
    where a.email = lower(new.email) and new.email_confirmed_at is not null
  ) into v_is_admin;

  insert into public.customer_profiles (customer_id, customer_name, email, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'customer_name', ''),
    new.email,
    case when v_is_admin then 'admin' else 'customer' end
  )
  on conflict (customer_id) do update
  set email = excluded.email,
      role = case
        when v_is_admin then 'admin'
        when public.customer_profiles.role = 'admin' then 'customer'
        else public.customer_profiles.role
      end;
  return new;
end;
$$;
revoke all on function private.sync_customer_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_customer_profile on auth.users;
create trigger on_auth_user_customer_profile
after insert or update of email, email_confirmed_at on auth.users
for each row execute function private.sync_customer_auth_user();

insert into public.customer_profiles (customer_id, customer_name, email, role)
select
  u.id,
  nullif(u.raw_user_meta_data ->> 'customer_name', ''),
  u.email,
  case when u.email_confirmed_at is not null and exists (
    select 1 from private.noir_admin_allowlist a where a.email = lower(u.email)
  ) then 'admin' else 'customer' end
from auth.users u
where u.email is not null
on conflict (customer_id) do nothing;
