'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppSettings } from '@hellowhen/contracts';
import type { LanguagePreference } from '@hellowhen/i18n';
import { useWebTranslation } from '../../providers/WebI18nProvider';
import { useWebAppSettings } from '../../providers/WebAppSettingsProvider';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { getOnboardingImageBackground, getOnboardingImagePath } from './onboardingGuideAssets';
import { ONBOARDING_GUIDE_SLIDES } from './onboardingGuide.slides';
import { markWebOnboardingGuideCompletedForVisitor } from './onboardingGuideStorage';

type ResolvedMode = 'light' | 'dark';
type AppearancePreference = AppSettings['appearance'];
type PreferenceOption<T extends string> = { value: T; labelKey: string };

const languageOptions: Array<PreferenceOption<LanguagePreference>> = [
  { value: 'system', labelKey: 'onboarding.preferences.languageOptions.system' },
  { value: 'en', labelKey: 'onboarding.preferences.languageOptions.en' },
  { value: 'fr', labelKey: 'onboarding.preferences.languageOptions.fr' },
];

const appearanceOptions: Array<PreferenceOption<AppearancePreference>> = [
  { value: 'system', labelKey: 'onboarding.preferences.appearanceOptions.system' },
  { value: 'light', labelKey: 'onboarding.preferences.appearanceOptions.light' },
  { value: 'dark', labelKey: 'onboarding.preferences.appearanceOptions.dark' },
];

function resolveOnboardingMode(appearance: string | undefined): ResolvedMode {
  if (appearance === 'light' || appearance === 'dark') return appearance;

  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
}

function sanitizeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/trades';
  if (value.startsWith('/onboarding-guide')) return '/trades';
  return value;
}

export function OnboardingGuideClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useWebTranslation();
  const { settings, setSettings } = useWebAppSettings();
  const auth = useWebAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>(() => resolveOnboardingMode(settings.appearance));
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const slide = ONBOARDING_GUIDE_SLIDES[currentIndex] ?? ONBOARDING_GUIDE_SLIDES[0]!;
  const isLastSlide = currentIndex === ONBOARDING_GUIDE_SLIDES.length - 1;
  const isReplay = searchParams.get('replay') === '1' || searchParams.get('replay') === 'true';
  const nextHref = useMemo(() => sanitizeNext(searchParams.get('next')), [searchParams]);
  const progressLabel = t('onboarding.progress', { current: currentIndex + 1, total: ONBOARDING_GUIDE_SLIDES.length });
  const backgroundColor = getOnboardingImageBackground(resolvedMode, slide.illustrationKey);
  const imagePath = getOnboardingImagePath(resolvedMode, slide.illustrationKey);
  const currentLanguageLabel = t(languageOptions.find((option) => option.value === settings.language)?.labelKey ?? languageOptions[0].labelKey);
  const currentAppearanceLabel = t(appearanceOptions.find((option) => option.value === settings.appearance)?.labelKey ?? appearanceOptions[0].labelKey);
  const preferencesSummary = t('onboarding.preferences.summary', { language: currentLanguageLabel, appearance: currentAppearanceLabel });

  useEffect(() => {
    setResolvedMode(resolveOnboardingMode(settings.appearance));

    if (settings.appearance !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => setResolvedMode(resolveOnboardingMode('system'));
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [settings.appearance]);

  const closeGuide = useCallback(() => {
    if (!isReplay) markWebOnboardingGuideCompletedForVisitor(auth.user?.id);
    router.push(nextHref);
  }, [auth.user?.id, isReplay, nextHref, router]);

  function goNext() {
    if (isLastSlide) {
      closeGuide();
      return;
    }
    setCurrentIndex((value) => Math.min(value + 1, ONBOARDING_GUIDE_SLIDES.length - 1));
  }

  function goBack() {
    setCurrentIndex((value) => Math.max(value - 1, 0));
  }

  function updateOnboardingPreferences(patch: Partial<AppSettings>) {
    void setSettings({ ...settings, ...patch });
  }

  return (
    <section className="onboarding-guide-shell" style={{ backgroundColor }} aria-label={t('onboarding.ariaLabel')}>
      <header className="onboarding-guide-topbar" style={{ backgroundColor }}>
        <strong className="onboarding-guide-brand">Hellowhen</strong>
        <button type="button" className="onboarding-guide-skip" onClick={closeGuide}>{t('onboarding.actions.skip')}</button>
      </header>

      <div className="onboarding-guide-preference-bar" style={{ backgroundColor }}>
        <button
          type="button"
          className="onboarding-guide-preference-pill"
          aria-label={t('onboarding.preferences.openAccessibilityLabel')}
          onClick={() => setPreferencesOpen(true)}
        >
          {preferencesSummary}
        </button>
      </div>

      <div className="onboarding-guide-content" style={{ backgroundColor }}>
        <figure className="onboarding-guide-figure" style={{ backgroundColor }}>
          <img src={imagePath} alt="" aria-hidden="true" className="onboarding-guide-image" draggable={false} />
          <figcaption>{t(slide.illustrationCaptionKey)}</figcaption>
        </figure>

        <p className="onboarding-guide-step">{progressLabel}</p>
        <h1>{t(slide.titleKey)}</h1>
        <p className="onboarding-guide-body">{t(slide.bodyKey)}</p>

        <div className="onboarding-guide-dots" aria-label={progressLabel}>
          {ONBOARDING_GUIDE_SLIDES.map((item, index) => (
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

      <footer className="onboarding-guide-actions" style={{ backgroundColor }}>
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
