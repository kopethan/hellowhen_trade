export const POSTER_CARD_GEOMETRY = {
  cardRadius: 28,
  contentInset: 17,
  topPillMinHeight: 25,
  topPillPaddingHorizontal: 10,
  topPillPaddingVertical: 4,
  topPillMaxWidth: '58%' as const,
  secondaryPillMaxWidth: '48%' as const,
  topPillFontSize: 10.5,
  topPillLineHeight: 13,
  topPillLetterSpacing: 0.75,
  footerBleed: -8,
  footerRadius: 23,
  footerContentPaddingHorizontal: 9,
  footerContentPaddingTop: 8,
  footerContentPaddingBottom: 9,
  footerContentGap: 4,
} as const;

// Shared text roles for square Plan/Trade deck cards. Layouts can stay distinct,
// while equivalent information keeps the same visual hierarchy across feeds.
export const DECK_CARD_TYPOGRAPHY = {
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900' as const,
    letterSpacing: 0.75,
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900' as const,
    letterSpacing: -0.55,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
  },
  status: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900' as const,
    letterSpacing: 0.45,
  },
} as const;
