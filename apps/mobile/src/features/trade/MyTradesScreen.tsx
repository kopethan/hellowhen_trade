import React from 'react';
import { useTranslation } from '../../providers/MobileI18nProvider';
import { AppCard } from '../../components/AppCard';
import { AppScreen } from '../../components/AppScreen';
import { AppText } from '../../components/AppText';

export function MyTradesScreen() {
  const { t } = useTranslation();
  return (
    <AppScreen>
      <AppCard>
        <AppText style={{ fontSize: 28, fontWeight: '800' }}>{t('trade.legacy.myTradesTitle')}</AppText>
        <AppText>{t('trade.legacy.myTradesBody')}</AppText>
      </AppCard>
    </AppScreen>
  );
}
