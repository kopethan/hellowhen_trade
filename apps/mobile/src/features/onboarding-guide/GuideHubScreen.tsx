import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SemanticColorName } from '@hellowhen/theme';

import { AppFixedHeaderScreen } from '../../components/AppFixedHeaderScreen';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcon';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useThemeTokens } from '../../providers/ThemeProvider';
import type { OnboardingGuideType } from './onboardingGuide.slides';

type Props = NativeStackScreenProps<RootStackParamList, 'GuideHub'>;

type GuideChoice = {
  title: string;
  body: string;
  badge: string;
  action: string;
  guide: OnboardingGuideType;
  icon: MobileIconName;
  tone: SemanticColorName;
};

const guideChoices: GuideChoice[] = [
  {
    title: 'App guide',
    body: 'Replay the global app guide for navigation, Me, public feeds, and safety basics.',
    badge: 'App',
    action: 'Replay app guide',
    guide: 'global',
    icon: 'help',
    tone: 'info',
  },
  {
    title: 'Plans guide',
    body: 'Learn how plans, places, joining, creating, and safety work.',
    badge: 'Plans',
    action: 'Open Plans guide',
    guide: 'plans',
    icon: 'plan',
    tone: 'plan',
  },
  {
    title: 'Trade guide',
    body: 'Learn trade cards, needs/offers, proposals, and safe agreements.',
    badge: 'Trade',
    action: 'Open Trade guide',
    guide: 'trade',
    icon: 'trade',
    tone: 'trade',
  },
];

export function GuideHubScreen({ navigation }: Props) {
  const theme = useThemeTokens();

  function openGuide(guide: OnboardingGuideType) {
    navigation.navigate('OnboardingGuide', { guide, replay: true });
  }

  return (
    <AppFixedHeaderScreen header={<AppHeader title="Guides" onBack={() => navigation.goBack()} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
          <AppText style={styles.heroEyebrow}>GUIDE LIBRARY</AppText>
          <AppText style={styles.heroTitle}>Replay guides anytime</AppText>
          <AppText style={[styles.heroBody, { color: theme.color.muted }]}>Choose the App, Plans, or Trade guide. Public feeds stay open, and these guides are always available from Me.</AppText>
        </View>

        <View style={styles.cards}>
          {guideChoices.map((choice) => {
            const tone = theme.semantic[choice.tone];
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={choice.action}
                key={choice.guide}
                onPress={() => openGuide(choice.guide)}
                style={({ pressed }) => [styles.card, { backgroundColor: theme.color.surface, borderColor: tone.border }, pressed && styles.pressed]}
              >
                <View style={[styles.iconWrap, { backgroundColor: tone.softBg, borderColor: tone.border }]}>
                  <MobileIcon name={choice.icon} size={20} color={tone.text} />
                </View>
                <View style={styles.cardCopy}>
                  <AppText style={[styles.badge, { color: tone.text }]}>{choice.badge}</AppText>
                  <AppText style={styles.cardTitle}>{choice.title}</AppText>
                  <AppText style={[styles.cardBody, { color: theme.color.muted }]}>{choice.body}</AppText>
                  <AppText style={[styles.cardAction, { color: tone.text }]}>{choice.action}</AppText>
                </View>
                <MobileIcon name="chevron-right" size={22} color={theme.color.muted} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </AppFixedHeaderScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  hero: { borderRadius: 28, borderWidth: 1, padding: 17, gap: 7 },
  heroEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  heroTitle: { fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: -0.55 },
  heroBody: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  cards: { gap: 10 },
  card: { minHeight: 116, borderRadius: 24, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0, gap: 4 },
  badge: { fontSize: 11, fontWeight: '900', letterSpacing: 0.85, textTransform: 'uppercase' },
  cardTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.25 },
  cardBody: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  cardAction: { marginTop: 3, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
