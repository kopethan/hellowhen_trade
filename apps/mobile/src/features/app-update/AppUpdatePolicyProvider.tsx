import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { MobileReleasePolicyResponse, MobileReleaseTarget } from '@hellowhen/contracts';
import { api } from '../../lib/api';
import { useTranslation } from '../../providers/MobileI18nProvider';
import {
  getOptionalUpdateDismissal,
  readInstalledReleaseTarget,
  shouldPresentAppUpdate,
  validateAppUpdatePolicyResponse,
  type OptionalUpdateDismissal,
} from './appUpdatePolicy';
import { readOptionalUpdateDismissal, writeOptionalUpdateDismissal } from './appUpdateStorage';

const FOREGROUND_RECHECK_INTERVAL_MS = 15 * 60 * 1000;

type AppUpdatePolicyPhase = 'idle' | 'checking' | 'ready';

type AppUpdatePolicyContextValue = {
  phase: AppUpdatePolicyPhase;
  installed: MobileReleaseTarget | null;
  policy: MobileReleasePolicyResponse | null;
  checkedAt: number | null;
  shouldPrompt: boolean;
  isMandatory: boolean;
  refresh: () => Promise<void>;
  dismissOptionalUpdate: () => Promise<void>;
};

const AppUpdatePolicyContext = createContext<AppUpdatePolicyContextValue | null>(null);

export function AppUpdatePolicyProvider({ children }: { children: React.ReactNode }) {
  const { language } = useTranslation();
  const [phase, setPhase] = useState<AppUpdatePolicyPhase>('idle');
  const [installed, setInstalled] = useState<MobileReleaseTarget | null>(null);
  const [policy, setPolicy] = useState<MobileReleasePolicyResponse | null>(null);
  const [dismissal, setDismissal] = useState<OptionalUpdateDismissal | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const mountedRef = useRef(true);
  const latestRequestIdRef = useRef(0);
  const lastCheckStartedAtRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    lastCheckStartedAtRef.current = Date.now();

    const release = Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      ? null
      : readInstalledReleaseTarget({
        platform: Platform.OS,
        version: Application.nativeApplicationVersion,
        build: Application.nativeBuildVersion,
      });

    if (!release) {
      if (!mountedRef.current || requestId !== latestRequestIdRef.current) return;
      setInstalled(null);
      setPolicy(null);
      setDismissal(null);
      setCheckedAt(Date.now());
      setPhase('ready');
      return;
    }

    if (mountedRef.current) {
      setInstalled(release.target);
      setPhase('checking');
    }

    try {
      const [policyResponse, nextDismissal] = await Promise.all([
        api.mobile.releasePolicy({
          platform: release.platform,
          version: release.target.version,
          build: release.target.build,
          locale: language,
        }),
        readOptionalUpdateDismissal(release.platform),
      ]);

      if (!mountedRef.current || requestId !== latestRequestIdRef.current) return;
      const nextPolicy = validateAppUpdatePolicyResponse(policyResponse, release);
      setPolicy(nextPolicy);
      setDismissal(nextDismissal);
    } catch {
      // Release policy is deliberately fail-open. A network/API problem must not block launch.
      if (!mountedRef.current || requestId !== latestRequestIdRef.current) return;
      setPolicy(null);
      setDismissal(null);
    } finally {
      if (mountedRef.current && requestId === latestRequestIdRef.current) {
        setCheckedAt(Date.now());
        setPhase('ready');
      }
    }
  }, [language]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    let lastState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasInactive = lastState === 'inactive' || lastState === 'background';
      lastState = nextState;
      if (!wasInactive || nextState !== 'active') return;
      if (Date.now() - lastCheckStartedAtRef.current < FOREGROUND_RECHECK_INTERVAL_MS) return;
      void refresh();
    });

    return () => subscription.remove();
  }, [refresh]);

  const dismissOptionalUpdate = useCallback(async () => {
    if (!policy) return;
    const nextDismissal = getOptionalUpdateDismissal(policy);
    if (!nextDismissal) return;

    setDismissal(nextDismissal);
    try {
      await writeOptionalUpdateDismissal(nextDismissal);
    } catch {
      // Keep the current-session dismissal even if local persistence is temporarily unavailable.
    }
  }, [policy]);

  const shouldPrompt = shouldPresentAppUpdate(policy, dismissal);
  const value = useMemo<AppUpdatePolicyContextValue>(() => ({
    phase,
    installed,
    policy,
    checkedAt,
    shouldPrompt,
    isMandatory: shouldPrompt && policy?.status === 'mandatory',
    refresh,
    dismissOptionalUpdate,
  }), [checkedAt, dismissOptionalUpdate, installed, phase, policy, refresh, shouldPrompt]);

  return <AppUpdatePolicyContext.Provider value={value}>{children}</AppUpdatePolicyContext.Provider>;
}

export function useAppUpdatePolicy() {
  const value = useContext(AppUpdatePolicyContext);
  if (!value) throw new Error('useAppUpdatePolicy must be used within AppUpdatePolicyProvider');
  return value;
}
