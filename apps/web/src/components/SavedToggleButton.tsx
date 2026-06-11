'use client';

import type { SavedItemType } from '@hellowhen/contracts';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { betaFeatures } from '../lib/betaFeatures';
import { getFriendlyApiErrorMessage } from '../lib/webErrors';
import { useWebAuth } from '../providers/WebAuthProvider';
import { useWebTranslation } from '../providers/WebI18nProvider';
import { WebIcon } from './WebIcon';

type SavedToggleButtonProps = {
  itemType: SavedItemType;
  itemId: string;
  className?: string;
  iconSize?: number;
  showLabel?: boolean;
  disabled?: boolean;
  hidden?: boolean;
};

export function SavedToggleButton({
  itemType,
  itemId,
  className = 'button secondary saved-toggle-button',
  iconSize = 16,
  showLabel = true,
  disabled = false,
  hidden = false,
}: SavedToggleButtonProps) {
  const auth = useWebAuth();
  const router = useRouter();
  const { t } = useWebTranslation();
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadSavedStatus() {
      if (!auth.isAuthenticated || !itemId || hidden || !betaFeatures.savedLibraryEnabled) {
        setSavedItemId(null);
        return;
      }

      try {
        const result = await api.saved.status({ itemType, itemId });
        if (!mounted) return;
        setSavedItemId(result.isSaved ? result.savedItem?.id ?? null : null);
      } catch {
        if (mounted) setSavedItemId(null);
      }
    }

    void loadSavedStatus();
    return () => { mounted = false; };
  }, [auth.isAuthenticated, hidden, itemId, itemType]);

  async function toggleSaved() {
    if (busy || disabled || hidden || !betaFeatures.savedLibraryEnabled) return;
    if (!auth.isAuthenticated) {
      router.push('/auth');
      return;
    }

    setBusy(true);
    setUpgradePrompt(null);
    try {
      if (savedItemId) {
        const currentSavedItemId = savedItemId;
        setSavedItemId(null);
        await api.saved.remove(currentSavedItemId);
      } else {
        const result = await api.saved.create({ itemType, itemId });
        setSavedItemId(result.item.id);
      }
    } catch (err) {
      setUpgradePrompt(getFriendlyApiErrorMessage(err, t('account.saved.plus.savePrompt')));
      try {
        const result = await api.saved.status({ itemType, itemId });
        setSavedItemId(result.isSaved ? result.savedItem?.id ?? null : null);
      } catch {
        // Keep the button usable even if the status refresh fails.
      }
    } finally {
      setBusy(false);
    }
  }

  if (hidden || !betaFeatures.savedLibraryEnabled) return null;

  const isSaved = Boolean(savedItemId);
  const label = busy ? t('common.states.saving') : isSaved ? t('common.states.saved') : t('common.actions.save');

  return (
    <>
      <button
        type="button"
        className={className}
        aria-pressed={isSaved}
        aria-label={label}
        title={label}
        disabled={disabled || busy}
        onClick={() => { void toggleSaved(); }}
      >
        <WebIcon name="save" size={iconSize} decorative />
        {showLabel ? <span>{label}</span> : null}
      </button>
      {upgradePrompt ? <span className="saved-toggle-upgrade-prompt">{upgradePrompt}</span> : null}
    </>
  );
}
