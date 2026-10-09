export function jumpToId(id) {
  const go = () => {
    const el = document.getElementById(id);
    if (!el) return;
    const nav = document.getElementById("siteNav");
    const bar = document.getElementById("catalog-toolbar");
    const navH = nav ? Math.round(nav.getBoundingClientRect().height) : 0;
    const elTop = el.getBoundingClientRect().top;
    const barH = bar && elTop > bar.getBoundingClientRect().top
      ? Math.round(bar.getBoundingClientRect().height)
      : 0;
    const top = Math.max(0, window.scrollY + elTop - navH - barH - 8);
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, top);
    root.style.scrollBehavior = previous;
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      go();
      window.setTimeout(go, 60);
    });
  });
}
