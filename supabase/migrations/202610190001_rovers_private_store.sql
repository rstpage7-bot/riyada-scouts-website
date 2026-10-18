-- All data is private. Only the server-side service role can use these functions.
create table if not exists public.rst_records (
  key text primary key check (length(key) between 1 and 200),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  revision uuid not null default gen_random_uuid(),
  expires_at timestamptz
);
create index if not exists rst_records_expiry on public.rst_records(expires_at) where expires_at is not null;
alter table public.rst_records enable row level security;
alter table public.rst_records force row level security;
revoke all on public.rst_records from public, anon, authenticated;
grant all on public.rst_records to service_role;

create or replace function public.rst_get(p_key text)
returns table(value jsonb, revision uuid)
language sql stable security invoker set search_path = '' as $$
  select r.value, r.revision from public.rst_records r
  where r.key = p_key and (r.expires_at is null or r.expires_at > now());
$$;

create or replace function public.rst_put(p_key text, p_value jsonb, p_new boolean default false, p_revision uuid default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer; expiry timestamptz;
begin
  if starts_with(p_key, 'session/') then
    expiry := to_timestamp((p_value->>'expires')::double precision / 1000);
  elsif starts_with(p_key, 'limit/') then
    expiry := to_timestamp((split_part(p_key, '/', 2)::double precision + 1) * 900);
  end if;
  delete from public.rst_records where expires_at <= now();
  if p_new then
    insert into public.rst_records(key,value,expires_at) values(p_key,p_value,expiry)
    on conflict(key) do nothing;
  elsif p_revision is not null then
    update public.rst_records set value=p_value, revision=gen_random_uuid(), expires_at=expiry
    where key=p_key and revision=p_revision;
  else
    insert into public.rst_records(key,value,expires_at) values(p_key,p_value,expiry)
    on conflict(key) do update set value=excluded.value, revision=gen_random_uuid(), expires_at=excluded.expires_at;
  end if;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.rst_list(p_prefix text, p_omit_data boolean default false, p_after text default '', p_limit integer default 250)
returns table(key text, value jsonb)
language sql stable security invoker set search_path = '' as $$
  select r.key, case when p_omit_data then r.value - 'data' else r.value end
  from public.rst_records r
  where starts_with(r.key,p_prefix) and r.key > p_after
  and (r.expires_at is null or r.expires_at > now())
  order by r.key limit least(greatest(p_limit,1),250);
$$;

create or replace function public.rst_delete(p_key text)
returns void language sql security invoker set search_path = '' as $$
  delete from public.rst_records where key=p_key;
$$;

revoke all on function public.rst_get(text) from public, anon, authenticated;
revoke all on function public.rst_put(text,jsonb,boolean,uuid) from public, anon, authenticated;
revoke all on function public.rst_list(text,boolean,text,integer) from public, anon, authenticated;
revoke all on function public.rst_delete(text) from public, anon, authenticated;
grant execute on function public.rst_get(text) to service_role;
grant execute on function public.rst_put(text,jsonb,boolean,uuid) to service_role;
grant execute on function public.rst_list(text,boolean,text,integer) to service_role;
grant execute on function public.rst_delete(text) to service_role;

insert into public.rst_records(key,value) values('system/ready','{"version":1}'::jsonb) on conflict do nothing;
