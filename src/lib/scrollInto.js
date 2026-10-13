const DURATION_MS = 280;

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function scrollParent(node) {
  let parent = node.parentElement;
  while (parent && parent !== document.body) {
    const overflow = getComputedStyle(parent).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && parent.scrollHeight > parent.clientHeight + 1) return parent;
    parent = parent.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function animate(from, delta, apply) {
  if (Math.abs(delta) < 2) return;
  if (reducedMotion()) {
    apply(from + delta);
    return;
  }
  const started = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - started) / DURATION_MS);
    const eased = 1 - (1 - t) ** 3;
    apply(from + delta * eased);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function headerClearance() {
  const header = document.getElementById("siteNav");
  if (!header) return 0;
  const rect = header.getBoundingClientRect();
  if (rect.bottom <= 0) return 0;
  return rect.bottom + 12;
}

export function scrollNodeIntoView(node, { block = "start", clearHeader = false, extra = 0 } = {}) {
  if (!node || typeof window === "undefined") return;
  const scroller = scrollParent(node);
  const page = scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body;
  const nodeRect = node.getBoundingClientRect();
  const viewTop = page ? 0 : scroller.getBoundingClientRect().top;
  const viewHeight = page ? window.innerHeight : scroller.clientHeight;
  const margin = Number.parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
  const cover = (clearHeader && page ? headerClearance() : 0) + extra;
  let delta = nodeRect.top - viewTop - margin - cover;
  if (block === "center") delta = nodeRect.top - viewTop - (viewHeight - nodeRect.height) / 2;
  if (block === "end") delta = nodeRect.bottom - viewTop - viewHeight;
  if (block === "nearest") {
    if (nodeRect.top >= viewTop && nodeRect.bottom <= viewTop + viewHeight) return;
    delta = nodeRect.top < viewTop ? nodeRect.top - viewTop : nodeRect.bottom - (viewTop + viewHeight);
  }
  const start = page ? window.scrollY : scroller.scrollTop;
  animate(start, delta, (y) => {
    if (page) {
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, y);
      root.style.scrollBehavior = previous;
    } else scroller.scrollTop = y;
  });
}

export function scrollLeftSoon(node, left) {
  if (!node) return;
  animate(node.scrollLeft, left - node.scrollLeft, (x) => {
    node.scrollLeft = x;
  });
}
