import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readSession } from "./auth.js";

const FILE = path.join(process.cwd(), "data", "catalog-groups.json");

let chain = Promise.resolve();

function cleanGroups(raw) {
  const groups = [];
  const seenIds = new Set();
  const seenProducts = new Set();
  for (const group of Array.isArray(raw) ? raw : []) {
    const id = String(group?.id || "").trim();
    const name = String(group?.name || "").trim();
    if (!id || !name || seenIds.has(id)) continue;
    const members = [];
    for (const member of Array.isArray(group?.members) ? group.members : []) {
      const productId = String(member?.productId || "").trim();
      const option = String(member?.option || "").trim();
      if (!productId || !option || seenProducts.has(productId)) continue;
      seenProducts.add(productId);
      members.push({
        productId,
        productNo: String(member?.productNo || ""),
        option,
      });
    }
    if (members.length < 2) continue;
    seenIds.add(id);
    groups.push({ id, name, members });
  }
  return groups;
}

async function readGroups() {
  try {
    const text = await readFile(FILE, "utf8");
    const data = JSON.parse(text);
    return cleanGroups(data?.groups);
  } catch {
    return [];
  }
}

async function saveNow(body) {
  const groups = cleanGroups(body?.groups);
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify({ groups }, null, 2)}\n`);
  return { status: 200, body: { ok: true, groups } };
}

export function handleCatalogGroupsGet() {
  return readGroups().then((groups) => ({ status: 200, body: { ok: true, groups } }));
}

export function handleCatalogGroupsSave(body, request) {
  const staff = readSession(request, "staff");
  if (!staff) return Promise.resolve({ status: 401, body: { ok: false, error: "auth" } });
  const run = chain.then(() => saveNow(body));
  chain = run.then(() => {}).catch(() => {});
  return run;
}
