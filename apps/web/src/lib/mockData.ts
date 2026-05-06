import type { TradeDto } from '@zizilia/contracts';

export const mockTrades: TradeDto[] = [
  {
    id: 'demo-trade-1',
    ownerId: 'demo-user-1',
    title: 'Need help editing a short launch video',
    description: 'Looking for someone to polish a 45-second launch video and export it for mobile/social.',
    creditAmount: 25,
    status: 'active',
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: null,
  },
  {
    id: 'demo-trade-2',
    ownerId: 'demo-user-2',
    title: 'Offer: quick landing page copy review',
    description: 'I can review your landing page copy and return notes within 24 hours.',
    creditAmount: 15,
    status: 'active',
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: null,
  },
];
