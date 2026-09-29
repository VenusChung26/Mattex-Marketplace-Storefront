-- Server-side auth, step 1: server-only token store and password RPCs; kv sync stops carrying secrets.

create table if not exists public.auth_tokens (
  token_hash text primary key,
  email text not null,
  kind text not null check (kind in ('buyer', 'staff')),
  purpose text not null check (purpose in ('reset', 'invite')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.auth_tokens enable row level security;
revoke all on public.auth_tokens from anon, authenticated;

create or replace function public.auth_verify_password(p_email text, p_kind text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored text;
begin
  select password into stored from user_accounts
  where email = lower(trim(p_email)) and kind = p_kind and enabled;
  if coalesce(stored, '') = '' or coalesce(p_password, '') = '' then
    return false;
  end if;
  if stored like '$2%' then
    return stored = crypt(p_password, stored);
  end if;
  if stored = p_password then
    update user_accounts set password = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
    where email = lower(trim(p_email)) and kind = p_kind;
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.auth_set_password(p_email text, p_kind text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update user_accounts set password = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
  where email = lower(trim(p_email)) and kind = p_kind;
  return found;
end;
$$;

revoke all on function public.auth_verify_password(text, text, text) from public, anon, authenticated;
revoke all on function public.auth_set_password(text, text, text) from public, anon, authenticated;
grant execute on function public.auth_verify_password(text, text, text) to service_role;
grant execute on function public.auth_set_password(text, text, text) to service_role;

create or replace function public.sync_user_accounts_from_kv()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.key = 'subbie_accounts' and jsonb_typeof(new.value) = 'object' then
    insert into public.user_accounts (
      email, kind, name, phone, phone_whatsapp, job_title,
      company_name, company_reg, company_phone, company_address,
      project, projects, enabled, approval_status, needs_review,
      created_at, approved_at, reviewed_at, extra, updated_at
    )
    select
      lower(trim(coalesce(e.value->>'email', e.key))),
      'buyer',
      coalesce(e.value->>'name', ''),
      coalesce(e.value->>'phone', ''),
      coalesce((e.value->>'phoneWhatsapp')::boolean, false),
      coalesce(e.value->>'jobTitle', ''),
      coalesce(e.value->>'companyName', ''),
      coalesce(e.value->>'companyReg', ''),
      coalesce(e.value->>'companyPhone', ''),
      coalesce(e.value->>'companyAddress', ''),
      coalesce(e.value->>'project', ''),
      case when jsonb_typeof(e.value->'projects') = 'array' then e.value->'projects' else '[]'::jsonb end,
      coalesce((e.value->>'enabled')::boolean, true),
      coalesce(e.value->>'approvalStatus', 'approved'),
      coalesce((e.value->>'needsReview')::boolean, false),
      nullif(e.value->>'createdAt', '')::timestamptz,
      nullif(e.value->>'approvedAt', '')::timestamptz,
      nullif(e.value->>'reviewedAt', '')::timestamptz,
      e.value - 'password' - 'resetToken' - 'resetExpiresAt' - 'inviteToken' - 'inviteExpiresAt',
      now()
    from jsonb_each(new.value) e
    where lower(trim(coalesce(e.value->>'email', e.key))) like '%@%'
    on conflict (email) do update set
      kind = 'buyer',
      name = excluded.name,
      phone = excluded.phone,
      phone_whatsapp = excluded.phone_whatsapp,
      job_title = excluded.job_title,
      company_name = excluded.company_name,
      company_reg = excluded.company_reg,
      company_phone = excluded.company_phone,
      company_address = excluded.company_address,
      project = excluded.project,
      projects = excluded.projects,
      enabled = excluded.enabled,
      approval_status = excluded.approval_status,
      needs_review = excluded.needs_review,
      created_at = coalesce(excluded.created_at, public.user_accounts.created_at),
      approved_at = excluded.approved_at,
      reviewed_at = excluded.reviewed_at,
      extra = excluded.extra,
      updated_at = now()
    where public.user_accounts.kind = 'buyer';
  elsif new.key = 'subbie_staff' and jsonb_typeof(new.value) = 'array' then
    insert into public.user_accounts (
      email, kind, name, enabled, bootstrap, invited_at, created_at, extra, updated_at
    )
    select
      lower(trim(s->>'email')),
      'staff',
      coalesce(s->>'name', ''),
      coalesce((s->>'enabled')::boolean, true),
      coalesce((s->>'bootstrap')::boolean, false),
      nullif(s->>'invitedAt', '')::timestamptz,
      nullif(s->>'createdAt', '')::timestamptz,
      s - 'password' - 'resetToken' - 'resetExpiresAt' - 'inviteToken' - 'inviteExpiresAt',
      now()
    from jsonb_array_elements(new.value) s
    where lower(trim(s->>'email')) like '%@%'
    on conflict (email) do update set
      name = excluded.name,
      enabled = excluded.enabled,
      invited_at = excluded.invited_at,
      created_at = coalesce(excluded.created_at, public.user_accounts.created_at),
      extra = excluded.extra,
      updated_at = now()
    where public.user_accounts.kind = 'staff';

    delete from public.user_accounts ua
    where ua.kind = 'staff'
      and ua.email not in (
        select lower(trim(s->>'email'))
        from jsonb_array_elements(new.value) s
        where lower(trim(s->>'email')) like '%@%'
      );
  elsif new.key = 'subbie_deleted_buyers' and jsonb_typeof(new.value) = 'array' then
    delete from public.user_accounts
    where kind = 'buyer'
      and email in (
        select lower(trim(x))
        from jsonb_array_elements_text(new.value) x
      );
  end if;
  return new;
end;
$function$;
