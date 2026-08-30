import { useCallback, useRef, useState } from 'react';

type ScopedStateUpdater<TState> = TState | ((current: TState) => TState);

/**
 * Keeps independent local UI state for each Mine / Library segment. Switching
 * scopes therefore does not leak search text or filters into the other scope.
 */
export function useScopedLibraryState<TScope extends string, TState>(initialState: Record<TScope, TState>) {
  const initialStateRef = useRef(initialState);
  const [stateByScope, setStateByScope] = useState<Record<TScope, TState>>(initialState);

  const setScopeState = useCallback((scope: TScope, updater: ScopedStateUpdater<TState>) => {
    setStateByScope((current) => ({
      ...current,
      [scope]: typeof updater === 'function'
        ? (updater as (state: TState) => TState)(current[scope])
        : updater,
    }));
  }, []);

  const resetScopeState = useCallback((scope: TScope) => {
    setStateByScope((current) => ({
      ...current,
      [scope]: initialStateRef.current[scope],
    }));
  }, []);

  return {
    stateByScope,
    setScopeState,
    resetScopeState,
  };
}
