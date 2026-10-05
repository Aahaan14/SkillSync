import { useCallback, useEffect, useState } from 'react';
import { ApiError, isApiError } from './api';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: ApiError };

function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  return new ApiError('unknown', 0, error instanceof Error ? error.message : 'Something went wrong.');
}

/**
 * Runs `loader` on mount and whenever `reload()` is called.
 * `loader` must be referentially stable (a module-level function).
 */
export function useAsync<T>(loader: () => Promise<T>): { state: AsyncState<T>; reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loader()
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', error: toApiError(error) });
      });
    return () => {
      active = false;
    };
  }, [loader, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
