-- Browsers read only the public catalog with the publishable key; every other read and all writes go through /api/data.

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

revoke all on public.user_accounts, public.rfqs, public.rfq_lines, public.auth_tokens from anon, authenticated;

drop policy if exists "kv_all" on public.app_kv;
drop policy if exists kv_public_read on public.app_kv;
create policy kv_public_read on public.app_kv for select using (
  key in (
    'subbie_custom_categories',
    'subbie_admin_categories',
    'subbie_product_patches',
    'subbie_rfq_seq',
    'subbie_report_seq',
    'subbie_tmp_sku_seq',
    'subbie_tms_seq'
  )
);

drop policy if exists "products_all" on public.products;
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (true);

drop policy if exists suppliers_all on public.suppliers;
drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers for select using (true);

drop policy if exists product_images_all on public.product_images;
drop policy if exists product_images_read on public.product_images;
create policy product_images_read on public.product_images for select using (true);

drop policy if exists "metrics_all" on public.supplier_metrics;
drop policy if exists metrics_read on public.supplier_metrics;
create policy metrics_read on public.supplier_metrics for select using (true);

drop policy if exists product_images_public_insert on storage.objects;
drop policy if exists product_images_public_update on storage.objects;
drop policy if exists product_images_public_delete on storage.objects;

drop policy if exists user_accounts_all on public.user_accounts;
drop policy if exists rfqs_all on public.rfqs;
drop policy if exists rfq_lines_all on public.rfq_lines;
