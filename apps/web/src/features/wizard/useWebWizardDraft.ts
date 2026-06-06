'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseWizardDraft, serializeWizardDraft } from './wizardState';

type UseWebWizardDraftOptions<TDraft> = {
  storageKey: string;
  draft: TDraft;
  enabled?: boolean;
  saveDelayMs?: number;
  warnOnUnload?: boolean;
  hasContent: (draft: TDraft) => boolean;
  onRestore: (draft: TDraft) => void;
};

export function useWebWizardDraft<TDraft>({
  storageKey,
  draft,
  enabled = true,
  saveDelayMs = 500,
  warnOnUnload = true,
  hasContent,
  onRestore,
}: UseWebWizardDraftOptions<TDraft>) {
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const onRestoreRef = useRef(onRestore);
  const hasContentRef = useRef(hasContent);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    hasContentRef.current = hasContent;
  }, [hasContent]);

  useEffect(() => {
    setHydrated(false);
    setRestored(false);

    try {
      const envelope = parseWizardDraft<TDraft>(window.localStorage.getItem(storageKey));
      if (envelope?.data && hasContentRef.current(envelope.data)) {
        onRestoreRef.current(envelope.data);
        setRestored(true);
      }
    } catch {
      // Ignore storage failures. The wizard can still be completed without persistence.
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || !enabled) return undefined;

    const timeout = window.setTimeout(() => {
      try {
        if (hasContentRef.current(draft)) {
          window.localStorage.setItem(storageKey, serializeWizardDraft(draft));
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch {
        // Ignore storage failures. The wizard can still be completed without persistence.
      }
    }, saveDelayMs);

    return () => window.clearTimeout(timeout);
  }, [draft, enabled, hydrated, saveDelayMs, storageKey]);

  useEffect(() => {
    if (!warnOnUnload || !enabled || !hasContent(draft)) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draft, enabled, hasContent, warnOnUnload]);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage failures.
    }
  }, [storageKey]);

  return { hydrated, restored, clearDraft };
}
