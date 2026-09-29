import { useEffect, useState } from "react";

export function useAsyncValue(load, key) {
  const [state, setState] = useState({ loading: true, value: null });
  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, value: null });
    Promise.resolve(load(key))
      .catch(() => null)
      .then((value) => {
        if (!cancelled) setState({ loading: false, value });
      });
    return () => {
      cancelled = true;
    };
  }, [load, key]);
  return state;
}
