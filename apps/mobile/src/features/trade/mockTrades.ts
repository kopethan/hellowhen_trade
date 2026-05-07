export type FeedTrade = {
  id: string;
  title: string;
  description: string;
  creditAmount: number;
  status: string;
  expiresAt?: string | null;
  owner?: {
    profile?: {
      displayName?: string | null;
      handle?: string | null;
      avatarUrl?: string | null;
    } | null;
  } | null;
};

export const mockTrades: FeedTrade[] = [
  {
    id: 'mock-launch-video',
    title: 'Edit a short launch video',
    description: 'Polish a 45-second launch clip with captions, tighter pacing, and a clean ending frame.',
    creditAmount: 25,
    status: 'active',
    expiresAt: null,
    owner: {
      profile: {
        displayName: 'Maya C.'
      }
    }
  },
  {
    id: 'mock-copy-review',
    title: 'Landing page copy review',
    description: 'Review a SaaS landing page for clarity, hierarchy, and sharper calls to action.',
    creditAmount: 15,
    status: 'active',
    expiresAt: null,
    owner: {
      profile: {
        displayName: 'Jon Bell'
      }
    }
  },
  {
    id: 'mock-icon-set',
    title: 'Design five simple icons',
    description: 'Create a small outline icon set for profile, wallet, trade, search, and settings.',
    creditAmount: 30,
    status: 'active',
    expiresAt: null,
    owner: {
      profile: {
        displayName: 'Ari Studio'
      }
    }
  }
];
