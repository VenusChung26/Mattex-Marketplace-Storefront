const CODE_RE = /^[A-Z]{1,3}\d{2,4}$/;

function optionFromProduct(product) {
  const size = String(product?.sizeDesc || product?.primarySpec || "").split("\n")[0].trim();
  const head = size.split(/[,;]/)[0].trim();
  return head || String(product?.unit || product?.productNo || product?.id || "");
}

function exactNameParts(product) {
  const name = String(product?.name || "").replace(/\s+/g, " ").trim();
  if (!name) return null;
  return {
    key: `${product.category || ""} :: ${name}`,
    name,
    option: optionFromProduct(product),
  };
}

function groupsFromBuckets(buckets) {
  const groups = [];
  for (const [key, bucket] of buckets) {
    if (bucket.members.length < 2) continue;
    groups.push({
      id: slug(key),
      name: bucket.name,
      members: withUniqueOptions(bucket.members),
    });
  }
  return groups;
}

function seriesParts(product) {
  const name = String(product?.name || "");
  const bits = name.split(/\s*[—–]\s*/);
  if (bits.length < 2) return null;
  const left = bits[0].trim();
  const right = bits.slice(1).join(" ").trim();
  if (!left || !right) return null;
  const code = CODE_RE.test(left);
  const size = String(product.sizeDesc || product.primarySpec || "").split("\n")[0].trim();
  return {
    key: `${product.category || ""} :: ${code ? right : left}`,
    name: code ? right : left,
    option: code ? left : size || left,
  };
}

function slug(value) {
  const text = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return text || "group";
}

function withUniqueOptions(members) {
  const counts = new Map();
  for (const member of members) counts.set(member.option, (counts.get(member.option) || 0) + 1);
  return members.map((member) =>
    counts.get(member.option) > 1 ? { ...member, option: `${member.option} · ${member.productNo || member.productId}` } : member
  );
}

function pushMember(buckets, parts, product) {
  const bucket = buckets.get(parts.key) || { name: parts.name, members: [] };
  bucket.members.push({
    productId: String(product.id),
    productNo: String(product.productNo || ""),
    option: parts.option,
  });
  buckets.set(parts.key, bucket);
}

export function buildExactNameGroups(products) {
  const buckets = new Map();
  for (const product of products || []) {
    if (!product?.id || product.deleted) continue;
    const parts = exactNameParts(product);
    if (!parts) continue;
    pushMember(buckets, parts, product);
  }
  return groupsFromBuckets(buckets);
}

export function buildAutoGroups(products) {
  const buckets = new Map();
  const listed = new Set();
  for (const product of products || []) {
    if (!product?.id || product.deleted) continue;
    const parts = seriesParts(product);
    if (!parts) continue;
    pushMember(buckets, parts, product);
  }
  const groups = [];
  for (const [key, bucket] of buckets) {
    if (bucket.members.length < 2 || bucket.members.length > 12) continue;
    for (const member of bucket.members) listed.add(member.productId);
    groups.push({
      id: slug(key),
      name: bucket.name,
      members: withUniqueOptions(bucket.members),
    });
  }
  const exact = buildExactNameGroups((products || []).filter((product) => product?.id && !listed.has(String(product.id))));
  return [...groups, ...exact];
}

export function indexGroups(groups) {
  const byProduct = new Map();
  for (const group of groups || []) {
    const members = Array.isArray(group?.members) ? group.members : [];
    if (members.length < 2) continue;
    const next = { id: String(group.id), name: String(group.name || ""), members };
    for (const member of members) byProduct.set(String(member.productId), next);
  }
  return byProduct;
}

export function collapseCatalog(products, byProduct) {
  const seen = new Set();
  const out = [];
  for (const product of products || []) {
    const group = byProduct?.get?.(product.id);
    if (!group) {
      out.push({ product, grouped: false, groupName: "" });
      continue;
    }
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    out.push({ product, grouped: true, groupName: group.name });
  }
  return out;
}

function withoutIds(groups, ids) {
  const drop = new Set(ids.map(String));
  return (groups || [])
    .map((group) => ({
      ...group,
      members: group.members.filter((member) => !drop.has(String(member.productId))),
    }))
    .filter((group) => group.members.length >= 2);
}

export function assignProducts(groups, products) {
  const rows = (products || []).filter((product) => product?.id);
  if (rows.length < 2) return groups || [];
  const parts = rows.map(seriesParts).filter(Boolean);
  const shared = parts.length === rows.length && parts.every((part) => part.name === parts[0].name) ? parts[0].name : "";
  const name = shared || String(rows[0].category || rows[0].name || "Product");
  const members = withUniqueOptions(
    rows.map((product) => {
      const part = seriesParts(product);
      return {
        productId: String(product.id),
        productNo: String(product.productNo || ""),
        option: part?.option || String(product.sizeDesc || product.productNo || product.name || product.id),
      };
    })
  );
  return [
    ...withoutIds(groups, rows.map((product) => product.id)),
    { id: `g-${Date.now().toString(36)}`, name, members },
  ];
}

export function releaseProducts(groups, productIds) {
  return withoutIds(groups, productIds || []);
}
