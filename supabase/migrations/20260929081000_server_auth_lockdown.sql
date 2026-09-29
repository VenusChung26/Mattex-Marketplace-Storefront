-- Server-side auth, step 2 (run right after the server-auth client ships):
-- hash every remaining plain-text password, drop secrets from anon-readable copies, and stop anon touching user_accounts.

update public.user_accounts
set password = extensions.crypt(password, extensions.gen_salt('bf', 10)), updated_at = now()
where password <> '' and password not like '$2%';

update public.user_accounts
set invite_token = null,
    invite_expires_at = null,
    extra = extra - 'password' - 'resetToken' - 'resetExpiresAt' - 'inviteToken' - 'inviteExpiresAt';

update public.app_kv
set value = (
  select coalesce(jsonb_object_agg(
    e.key,
    (e.value - 'password' - 'resetToken' - 'resetExpiresAt' - 'inviteToken' - 'inviteExpiresAt')
      || case when coalesce(e.value->>'inviteToken', '') <> '' then '{"invitePending": true}'::jsonb else '{}'::jsonb end
  ), '{}'::jsonb)
  from jsonb_each(value) e
), updated_at = now()
where key = 'subbie_accounts' and jsonb_typeof(value) = 'object';

update public.app_kv
set value = (
  select coalesce(jsonb_agg(
    (s - 'password' - 'resetToken' - 'resetExpiresAt' - 'inviteToken' - 'inviteExpiresAt')
      || case when coalesce(s->>'inviteToken', '') <> '' then '{"invitePending": true}'::jsonb else '{}'::jsonb end
  ), '[]'::jsonb)
  from jsonb_array_elements(value) s
), updated_at = now()
where key = 'subbie_staff' and jsonb_typeof(value) = 'array';

revoke all on public.user_accounts from anon, authenticated;
grant select (
  email, kind, name, phone, phone_whatsapp, job_title, company_name, company_reg, company_phone,
  company_address, project, projects, enabled, approval_status, needs_review, bootstrap,
  invited_at, created_at, approved_at, reviewed_at, extra, updated_at
) on public.user_accounts to anon, authenticated;
