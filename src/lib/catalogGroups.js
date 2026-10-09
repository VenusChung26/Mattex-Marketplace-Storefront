import { useEffect, useState } from "react";
import { useStore } from "../hooks/useStore";
import { searchProducts } from "./store";
import { assignProducts, buildAutoGroups, collapseCatalog, indexGroups, releaseProducts } from "./catalogGroup";

export { collapseCatalog };

let groups = [];
let byProduct = new Map();
let source = "auto";
const listeners = new Set();

function publish(next, nextSource) {
  groups = Array.isArray(next) ? next : [];
  byProduct = indexGroups(groups);
  source = nextSource;
  listeners.forEach((fn) => fn());
}

export function getCatalogGroups() {
  return groups;
}

export function groupOf(productId) {
  return byProduct.get(String(productId || "")) || null;
}

export function catalogGroupIndex() {
  return byProduct;
}

export function useCatalogGroups() {
  const { catalogEpoch } = useStore();
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const onChange = () => setEpoch((value) => value + 1);
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  }, []);

  useEffect(() => {
    if (source === "saved") return;
    publish(buildAutoGroups(searchProducts("")), "auto");
  }, [catalogEpoch]);

  useEffect(() => {
    let cancel = false;
    fetch("/api/catalog-groups", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancel || !Array.isArray(data?.groups)) return;
        publish(data.groups, "saved");
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  return epoch;
}

export async function saveCatalogGroups(next) {
  const response = await fetch("/api/catalog-groups", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ groups: next }),
  });
  const data = await response.json().catch(() => ({ ok: false, error: "Unable to save groups" }));
  if (!response.ok || data?.ok === false) return { ok: false, error: data?.error || "Unable to save groups" };
  publish(data.groups || next, "saved");
  return { ok: true, groups: data.groups || next };
}

export function groupSelectedProducts(products) {
  return assignProducts(groups, products);
}

export function releaseSelectedProducts(productIds) {
  return releaseProducts(groups, productIds);
}
