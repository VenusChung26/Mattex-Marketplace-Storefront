import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { jumpToId } from "../lib/jumpTo";
import { stripLocale } from "../lib/locale";

function isCategoryPage(pathname) {
  return /^\/catalog\/[^/]+$/.test(stripLocale(pathname));
}

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace(/^#/, "");
      jumpToId(id);
      const retry = window.setTimeout(() => jumpToId(id), 200);
      return () => window.clearTimeout(retry);
    }

    if (isCategoryPage(pathname)) {
      const id = document.getElementById("catalog-top")
        ? "catalog-top"
        : document.getElementById("catalog-results")
          ? "catalog-results"
          : "";
      if (id) {
        jumpToId(id);
        return undefined;
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return undefined;
  }, [pathname, search, hash]);

  return null;
}
