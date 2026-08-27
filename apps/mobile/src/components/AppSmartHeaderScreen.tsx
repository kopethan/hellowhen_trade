import React from 'react';
import { AppCollapsibleHeaderScreen, type AppCollapsibleHeaderScreenProps } from './AppCollapsibleHeaderScreen';

export type AppSmartHeaderScreenProps = Omit<AppCollapsibleHeaderScreenProps, 'revealHeaderOnScrollUp'>;

/**
 * Direction-aware header shell for long, scroll-heavy mobile screens.
 *
 * The header hides after deliberate downward scrolling, reappears after
 * deliberate upward scrolling, and is always restored at the top. Keep
 * forms, short detail pages, and conversation/composer screens on a fixed
 * header so navigation actions do not move while the user is interacting.
 */
export function AppSmartHeaderScreen(props: AppSmartHeaderScreenProps) {
  return <AppCollapsibleHeaderScreen {...props} revealHeaderOnScrollUp />;
}
