const isBrowser = typeof globalThis.document !== "undefined";

if (!isBrowser) {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (key) => (mem.has(key) ? mem.get(key) : null),
    setItem: (key, value) => mem.set(key, String(value)),
    removeItem: (key) => mem.delete(key),
    clear: () => mem.clear(),
    get length() {
      return mem.size;
    },
    key: (i) => [...mem.keys()][i] ?? null,
  };
}

if (!isBrowser || !globalThis.window || typeof globalThis.window.addEventListener !== "function") {
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
    setInterval: globalThis.setInterval?.bind(globalThis),
    clearInterval: globalThis.clearInterval?.bind(globalThis),
    location: globalThis.window?.location || { origin: "", href: "/" },
  };
}
