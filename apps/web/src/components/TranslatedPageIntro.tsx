'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageIntro } from './MobilePage';
import { useWebTranslation } from '../providers/WebI18nProvider';

export function TranslatedPageIntro({ eyebrowKey, titleKey, bodyKey, action }: { eyebrowKey?: string; titleKey: string; bodyKey?: string; action?: ReactNode }) {
  const { t } = useWebTranslation();
  return <PageIntro eyebrow={eyebrowKey ? t(eyebrowKey) : undefined} title={t(titleKey)} body={bodyKey ? t(bodyKey) : undefined} action={action} />;
}

export function TranslatedPageIntroLinkAction({ href, labelKey, className = 'button primary' }: { href: string; labelKey: string; className?: string }) {
  const { t } = useWebTranslation();
  return <Link href={href} className={className}>{t(labelKey)}</Link>;
}
