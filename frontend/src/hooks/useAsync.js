import { useCallback, useEffect, useRef, useState } from 'react';

/** Runs an async loader whenever deps change; exposes data/loading/error and reload(). */
export function useAsync(loader, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const seq = useRef(0);
  const run = useCallback(
    async (silent = false) => {
      if (!enabled) return;
      const id = ++seq.current;
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await loader();
        if (id === seq.current) setState({ data, loading: false, error: null });
      } catch (error) {
        if (id === seq.current) setState((s) => ({ ...s, loading: false, error }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, ...deps]
  );
  useEffect(() => {
    run();
  }, [run]);
  return { ...state, reload: run, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}

export function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setMatch(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return match;
}
