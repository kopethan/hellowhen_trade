import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseWizardDraft, serializeWizardDraft } from './wizardState';

type UseMobileWizardDraftOptions<TDraft> = {
  storageKey: string;
  draft: TDraft;
  enabled?: boolean;
  saveDelayMs?: number;
  hasContent: (draft: TDraft) => boolean;
  onRestore: (draft: TDraft) => void;
};

export function useMobileWizardDraft<TDraft>({
  storageKey,
  draft,
  enabled = true,
  saveDelayMs = 500,
  hasContent,
  onRestore,
}: UseMobileWizardDraftOptions<TDraft>) {
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
    let mounted = true;
    setHydrated(false);
    setRestored(false);

    async function hydrate() {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        const envelope = parseWizardDraft<TDraft>(raw);
        if (!mounted) return;
        if (envelope?.data && hasContentRef.current(envelope.data)) {
          onRestoreRef.current(envelope.data);
          setRestored(true);
        }
      } catch {
        // Ignore storage failures. The wizard can still be completed without persistence.
      } finally {
        if (mounted) setHydrated(true);
      }
    }

    void hydrate();
    return () => { mounted = false; };
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || !enabled) return undefined;

    const timeout = setTimeout(() => {
      const persist = async () => {
        if (hasContentRef.current(draft)) {
          await AsyncStorage.setItem(storageKey, serializeWizardDraft(draft));
        } else {
          await AsyncStorage.removeItem(storageKey);
        }
      };
      void persist().catch(() => undefined);
    }, saveDelayMs);

    return () => clearTimeout(timeout);
  }, [draft, enabled, hydrated, saveDelayMs, storageKey]);

  const clearDraft = useCallback(async () => {
    await AsyncStorage.removeItem(storageKey).catch(() => undefined);
  }, [storageKey]);

  return { hydrated, restored, clearDraft };
}
