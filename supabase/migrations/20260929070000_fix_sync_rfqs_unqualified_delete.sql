-- pg-safeupdate rejects an unqualified DELETE from PostgREST sessions, which rolled back every subbie_rfqs_by_user write.
CREATE OR REPLACE FUNCTION public.sync_rfqs_from_kv()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  incoming jsonb;
begin
  if new.key <> 'subbie_rfqs_by_user' or jsonb_typeof(new.value) <> 'object' then
    return new;
  end if;

  incoming := new.value;

  insert into public.rfqs (
    id, buyer_key, buyer_email, buyer_kind, buyer_name, buyer_phone, company_name,
    review_status, status, quote_delivery, channel, project,
    submitted_at, quoted_at, accepted_at,
    tms_id, tms_document_no, tms_url, line_count, priced_subtotal, payload, updated_at
  )
  select distinct on (src.id)
    src.id,
    src.buyer_key,
    src.buyer_email,
    src.buyer_kind,
    src.buyer_name,
    src.buyer_phone,
    coalesce(nullif(src.company_name, ''), ua.company_name, ''),
    src.review_status,
    src.status,
    src.quote_delivery,
    src.channel,
    src.project,
    src.submitted_at,
    src.quoted_at,
    src.accepted_at,
    src.tms_id,
    src.tms_document_no,
    src.tms_url,
    src.line_count,
    src.priced_subtotal,
    src.payload,
    now()
  from (
    select
      r->>'id' as id,
      e.key as buyer_key,
      lower(trim(coalesce(r->>'buyerEmail', case when e.key like '%@%' then e.key else '' end))) as buyer_email,
      case when coalesce(r->>'buyerKind', '') = 'guest' or e.key = '__guest__' then 'guest' else 'member' end as buyer_kind,
      coalesce(r->>'buyerName', '') as buyer_name,
      coalesce(r->>'buyerPhone', '') as buyer_phone,
      coalesce(r->>'companyName', r->>'company', '') as company_name,
      coalesce(r->>'reviewStatus', r->>'status', '') as review_status,
      coalesce(r->>'status', '') as status,
      coalesce(r->>'quoteDelivery', '') as quote_delivery,
      coalesce(r->>'channel', '') as channel,
      coalesce(r->>'project', '') as project,
      nullif(r->>'submittedAt', '')::timestamptz as submitted_at,
      nullif(r->>'quotedAt', '')::timestamptz as quoted_at,
      nullif(r->>'acceptedAt', '')::timestamptz as accepted_at,
      coalesce(r->>'tmsId', '') as tms_id,
      coalesce(r->>'tmsDocumentNo', '') as tms_document_no,
      coalesce(r->>'tmsUrl', '') as tms_url,
      coalesce(jsonb_array_length(case when jsonb_typeof(r->'lines') = 'array' then r->'lines' else '[]'::jsonb end), 0) as line_count,
      nullif(r->>'pricedSubtotal', '')::numeric as priced_subtotal,
      r as payload
    from jsonb_each(incoming) e
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(e.value) = 'array' then e.value else '[]'::jsonb end
    ) r
    where coalesce(r->>'id', '') <> ''
  ) src
  left join public.user_accounts ua on ua.email = src.buyer_email
  order by src.id, src.submitted_at desc nulls last
  on conflict (id) do update set
    buyer_key = excluded.buyer_key,
    buyer_email = excluded.buyer_email,
    buyer_kind = excluded.buyer_kind,
    buyer_name = excluded.buyer_name,
    buyer_phone = excluded.buyer_phone,
    company_name = excluded.company_name,
    review_status = excluded.review_status,
    status = excluded.status,
    quote_delivery = excluded.quote_delivery,
    channel = excluded.channel,
    project = excluded.project,
    submitted_at = excluded.submitted_at,
    quoted_at = excluded.quoted_at,
    accepted_at = excluded.accepted_at,
    tms_id = excluded.tms_id,
    tms_document_no = excluded.tms_document_no,
    tms_url = excluded.tms_url,
    line_count = excluded.line_count,
    priced_subtotal = excluded.priced_subtotal,
    payload = excluded.payload,
    updated_at = now();

  delete from public.rfqs r
  where r.id not in (
    select distinct x->>'id'
    from jsonb_each(incoming) e
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(e.value) = 'array' then e.value else '[]'::jsonb end
    ) x
    where coalesce(x->>'id', '') <> ''
  );

  delete from public.rfq_lines where rfq_id is not null;

  insert into public.rfq_lines (
    rfq_id, sort_order, product_id, product_no, name, qty, unit,
    unit_price, quoted_unit_price, supplier, tailor_made, payload, updated_at
  )
  select
    r.id,
    (ord.ord - 1),
    coalesce(line->>'productId', ''),
    coalesce(line->>'productNo', ''),
    coalesce(line->>'name', ''),
    nullif(line->>'qty', '')::numeric,
    coalesce(line->>'unit', ''),
    coalesce(nullif(line->>'quotedUnitPrice', '')::numeric, nullif(line->>'unitPrice', '')::numeric),
    nullif(line->>'quotedUnitPrice', '')::numeric,
    coalesce(line->>'supplier', ''),
    coalesce((line->>'tailorMade')::boolean, false),
    line,
    now()
  from public.rfqs r
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(r.payload->'lines') = 'array' then r.payload->'lines' else '[]'::jsonb end
  ) with ordinality as ord(line, ord);

  return new;
end;
$function$;
