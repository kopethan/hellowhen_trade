import type React from 'react';

export type SquareStackDeckCard = {
  id: string;
};

export type SquareStackDeckRenderArgs<TCard extends SquareStackDeckCard> = {
  card: TCard;
  index: number;
  total: number;
};

export type SquareStackDepthEffect = 'flat' | 'stacked' | 'motionOnly';

export type SquareStackDeckProps<TCard extends SquareStackDeckCard> = {
  cards: TCard[];
  initialIndex?: number;
  renderCard: (args: SquareStackDeckRenderArgs<TCard>) => React.ReactNode;
  onIndexChange?: (index: number, card: TCard) => void;
  renderWindow?: 'visible' | 'all';
  showDebugBadge?: boolean;
  depthEffect?: SquareStackDepthEffect;
  availableWidth?: number;
  availableHeight?: number;
  minCardSize?: number;
  maxCardSize?: number;
};
