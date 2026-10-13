import { useLayoutEffect, useRef, useState } from "react";
import { scrollNodeIntoView } from "./scrollInto";

export function revealFormIssue(root) {
  if (typeof document === "undefined") return;
  const scope = root && typeof root.querySelector === "function" ? root : document;
  const invalid = scope.querySelector("[aria-invalid='true']");
  const alert = scope.querySelector("[data-form-alert]");
  const target = invalid || alert;
  if (!target) return;
  scrollNodeIntoView(target, { block: "center" });
  const focusable = invalid && typeof invalid.focus === "function" ? invalid : alert;
  if (focusable && typeof focusable.focus === "function") {
    try {
      focusable.focus({ preventScroll: true });
    } catch {
      focusable.focus();
    }
  }
}

export function scheduleRevealFormIssue(root) {
  if (typeof window === "undefined") return;
  const run = () => revealFormIssue(root);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(run);
  });
}

/** Call `revealIssue()` in the same submit handler after setting error state. */
export function useRevealFormIssue() {
  const formRef = useRef(null);
  const [tick, setTick] = useState(0);
  useLayoutEffect(() => {
    if (!tick) return;
    scheduleRevealFormIssue(formRef.current);
  }, [tick]);
  return {
    formRef,
    revealIssue() {
      setTick((n) => n + 1);
    },
  };
}
