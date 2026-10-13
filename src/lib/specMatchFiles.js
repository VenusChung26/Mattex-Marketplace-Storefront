const DB_NAME = "mm_spec_match_files";
const STORE = "files";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function keyFor(owner, id) {
  return `${owner || "guest"}:${id}`;
}

export async function saveSpecFile(owner, id, file) {
  if (!id || !file) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, keyFor(owner, id));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadSpecFiles(owner, ids) {
  const found = new Map();
  const list = (Array.isArray(ids) ? ids : []).filter(Boolean);
  if (!list.length) return found;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    let left = list.length;
    list.forEach((id) => {
      const request = store.get(keyFor(owner, id));
      request.onsuccess = () => {
        if (request.result) found.set(id, request.result);
        left -= 1;
        if (!left) resolve();
      };
      request.onerror = () => reject(request.error);
    });
  });
  db.close();
  return found;
}

export async function clearSpecFiles(owner) {
  const db = await openDb();
  const prefix = `${owner || "guest"}:`;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result || []) {
        if (String(key).startsWith(prefix)) store.delete(key);
      }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
