'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppSettings } from '@hellowhen/contracts';
import type { LanguagePreference } from '@hellowhen/i18n';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { useWebAppSettings } from '../../providers/WebAppSettingsProvider';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { getOnboardingImageBackground, getOnboardingImageDescriptor } from './onboardingGuideAssets';
import { getOnboardingGuidePack, type OnboardingGuideType } from './onboardingGuide.slides';
import { markWebOnboardingGuideCompletedForVisitor } from './onboardingGuideStorage';

type ResolvedMode = 'light' | 'dark';
type AppearancePreference = AppSettings['appearance'];
type PreferenceOption<T extends string> = { value: T; labelKey: string };

const languageOptions: Array<PreferenceOption<LanguagePreference>> = [
  { value: 'system', labelKey: 'onboarding.preferences.languageOptions.system' },
  { value: 'en', labelKey: 'onboarding.preferences.languageOptions.en' },
  { value: 'fr', labelKey: 'onboarding.preferences.languageOptions.fr' },
  { value: 'es', labelKey: 'onboarding.preferences.languageOptions.es' },
];

const appearanceOptions: Array<PreferenceOption<AppearancePreference>> = [
  { value: 'system', labelKey: 'onboarding.preferences.appearanceOptions.system' },
  { value: 'light', labelKey: 'onboarding.preferences.appearanceOptions.light' },
  { value: 'dark', labelKey: 'onboarding.preferences.appearanceOptions.dark' },
];

const defaultLanguageLabelKey = 'onboarding.preferences.languageOptions.system';
const defaultAppearanceLabelKey = 'onboarding.preferences.appearanceOptions.system';

function readBootstrappedMode(): ResolvedMode | null {
  if (typeof document === 'undefined') return null;
  const theme = document.documentElement.dataset.theme;
  return theme === 'dark' || theme === 'light' ? theme : null;
}

function resolveOnboardingMode(appearance: string | undefined): ResolvedMode {
  if (appearance === 'light' || appearance === 'dark') return appearance;

  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
}

function resolveInitialOnboardingMode(appearance: string | undefined, settingsHydrated: boolean): ResolvedMode {
  if (!settingsHydrated) return readBootstrappedMode() ?? resolveOnboardingMode(appearance);
  return resolveOnboardingMode(appearance);
}

function isGuideType(value: string | null): value is OnboardingGuideType {
  return value === 'global' || value === 'trade' || value === 'plans';
}

function resolveGuideType(guideParam: string | null, nextParam: string | null): OnboardingGuideType {
  if (isGuideType(guideParam)) return guideParam;
  if (nextParam?.startsWith('/plans') || nextParam?.startsWith('/places')) return 'plans';
  if (nextParam?.startsWith('/trades') || nextParam?.startsWith('/needs') || nextParam?.startsWith('/offers')) return 'trade';
  return 'global';
}

function getDefaultNextHref(guideType: OnboardingGuideType) {
  if (guideType === 'plans') return '/plans';
  if (guideType === 'trade') return '/trades';
  return '/';
}

function sanitizeNext(value: string | null, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.startsWith('/onboarding-guide')) return fallback;
  return value;
}

export function OnboardingGuideClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useWebTranslation();
  const { settings, hydrated: settingsHydrated, setSettings } = useWebAppSettings();
  const auth = useWebAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>('light');
  const [isAppearanceReady, setIsAppearanceReady] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const guideType = resolveGuideType(searchParams.get('guide'), searchParams.get('next'));
  const guidePack = getOnboardingGuidePack(guideType);
  const guideSlides = guidePack.slides;
  const slide = guideSlides[currentIndex] ?? guideSlides[0]!;
  const isLastSlide = currentIndex === guideSlides.length - 1;
  const isReplay = searchParams.get('replay') === '1' || searchParams.get('replay') === 'true';
  const nextHref = useMemo(() => sanitizeNext(searchParams.get('next'), getDefaultNextHref(guideType)), [guideType, searchParams]);
  const progressLabel = t('onboarding.progress', { current: currentIndex + 1, total: guideSlides.length });
  const backgroundColor = getOnboardingImageBackground(resolvedMode, slide.illustrationKey);
  const imageDescriptor = isAppearanceReady ? getOnboardingImageDescriptor(resolvedMode, slide.illustrationKey) : null;
  const shouldPrioritizeImage = currentIndex === 0;
  const backgroundStyle = isAppearanceReady ? { backgroundColor } : undefined;
  const currentLanguageLabel = t(languageOptions.find((option) => option.value === settings.language)?.labelKey ?? defaultLanguageLabelKey);
  const currentAppearanceLabel = t(appearanceOptions.find((option) => option.value === settings.appearance)?.labelKey ?? defaultAppearanceLabelKey);
  const preferencesSummary = t('onboarding.preferences.summary', { language: currentLanguageLabel, appearance: currentAppearanceLabel });

  useEffect(() => {
    setCurrentIndex(0);
  }, [guidePack.type]);

  useEffect(() => {
    setResolvedMode(resolveInitialOnboardingMode(settings.appearance, settingsHydrated));
    setIsAppearanceReady(true);

    const shouldFollowSystem = !settingsHydrated || settings.appearance === 'system';
    if (!shouldFollowSystem) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => setResolvedMode(resolveOnboardingMode('system'));
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [settings.appearance, settingsHydrated]);

  const skipGuide = useCallback(() => {
    if (!isReplay) markWebOnboardingGuideCompletedForVisitor(auth.user?.id, guidePack.type);
    router.push(nextHref);
  }, [auth.user?.id, guidePack.type, isReplay, nextHref, router]);

  const completeGuide = useCallback(() => {
    markWebOnboardingGuideCompletedForVisitor(auth.user?.id, guidePack.type);
    router.push(nextHref);
  }, [auth.user?.id, guidePack.type, nextHref, router]);

  function goNext() {
    if (isLastSlide) {
      completeGuide();
      return;
    }
    setCurrentIndex((value) => Math.min(value + 1, guideSlides.length - 1));
  }

  function goBack() {
    setCurrentIndex((value) => Math.max(value - 1, 0));
  }

  function updateOnboardingPreferences(patch: Partial<AppSettings>) {
    void setSettings({ ...settings, ...patch });
  }

  return (
    <section className="onboarding-guide-shell" style={backgroundStyle} aria-label={t('onboarding.ariaLabel')}>
      <header className="onboarding-guide-topbar" style={backgroundStyle}>
        <strong className="onboarding-guide-brand">Hellowhen</strong>
        <button type="button" className="onboarding-guide-skip" onClick={skipGuide}>{t('onboarding.actions.skip')}</button>
      </header>

      <div className="onboarding-guide-preference-bar" style={backgroundStyle}>
        <button
          type="button"
          className="onboarding-guide-preference-pill"
          aria-label={t('onboarding.preferences.openAccessibilityLabel')}
          onClick={() => setPreferencesOpen(true)}
        >
          {preferencesSummary}
        </button>
      </div>

      <div className="onboarding-guide-content" style={backgroundStyle}>
        <figure className="onboarding-guide-figure" style={backgroundStyle}>
          {imageDescriptor ? (
            <Image
              src={imageDescriptor.src}
              width={imageDescriptor.width}
              height={imageDescriptor.height}
              alt=""
              aria-hidden="true"
              className="onboarding-guide-image"
              draggable={false}
              sizes="(min-width: 860px) 560px, 330px"
              loading={shouldPrioritizeImage ? 'eager' : 'lazy'}
              fetchPriority={shouldPrioritizeImage ? 'high' : 'auto'}
            />
          ) : (
            <span className="onboarding-guide-image-placeholder" aria-hidden="true" />
          )}
          <figcaption>{t(slide.illustrationCaptionKey)}</figcaption>
        </figure>

        <p className="onboarding-guide-step">{progressLabel}</p>
        <h1>{t(slide.titleKey)}</h1>
        <p className="onboarding-guide-body">{t(slide.bodyKey)}</p>

        <div className="onboarding-guide-dots" aria-label={progressLabel}>
          {guideSlides.map((item, index) => (
            <span key={item.id} className={index === currentIndex ? 'is-active' : ''} />
          ))}
        </div>

        <p className="onboarding-guide-step onboarding-guide-step--muted">{progressLabel}</p>
      </div>

      {preferencesOpen ? (
        <div className="onboarding-guide-preferences-modal" role="dialog" aria-modal="true" aria-label={t('onboarding.preferences.title')}>
          <button type="button" className="onboarding-guide-preferences-backdrop" aria-label={t('common.actions.close')} onClick={() => setPreferencesOpen(false)} />
          <div className="onboarding-guide-preferences-sheet">
            <div className="onboarding-guide-preferences-header">
              <div>
                <h2>{t('onboarding.preferences.title')}</h2>
                <p>{t('onboarding.preferences.body')}</p>
              </div>
              <button type="button" className="onboarding-guide-preferences-close" onClick={() => setPreferencesOpen(false)}>{t('common.actions.close')}</button>
            </div>

            <div className="onboarding-guide-preferences-group">
              <strong>{t('onboarding.preferences.languageTitle')}</strong>
              <div className="onboarding-guide-preferences-options">
                {languageOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={settings.language === option.value ? 'is-selected' : ''}
                    aria-pressed={settings.language === option.value}
                    onClick={() => updateOnboardingPreferences({ language: option.value })}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div className="onboarding-guide-preferences-group">
              <strong>{t('onboarding.preferences.appearanceTitle')}</strong>
              <div className="onboarding-guide-preferences-options">
                {appearanceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={settings.appearance === option.value ? 'is-selected' : ''}
                    aria-pressed={settings.appearance === option.value}
                    onClick={() => updateOnboardingPreferences({ appearance: option.value })}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" className="onboarding-guide-preferences-done" onClick={() => setPreferencesOpen(false)}>{t('onboarding.preferences.done')}</button>
          </div>
        </div>
      ) : null}

      <footer className="onboarding-guide-actions" style={backgroundStyle}>
        <button type="button" className="onboarding-guide-secondary" disabled={currentIndex === 0} onClick={goBack}>
          {t('onboarding.actions.back')}
        </button>
        <button type="button" className="onboarding-guide-primary" onClick={goNext}>
          {isLastSlide ? t('onboarding.actions.getStarted') : t('onboarding.actions.next')}
        </button>
      </footer>
    </section>
  );
}
