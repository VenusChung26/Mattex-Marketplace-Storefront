export const PUBLIC_KV_KEYS = [
  "subbie_custom_categories",
  "subbie_admin_categories",
  "subbie_product_patches",
  "subbie_rfq_seq",
  "subbie_report_seq",
  "subbie_tmp_sku_seq",
  "subbie_tms_seq",
];

export const isPublicKvKey = (key) => PUBLIC_KV_KEYS.includes(String(key || ""));
