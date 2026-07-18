export const normalAppNavItemIds = ['plans', 'me', 'trade'] as const;
export type NormalAppNavItemId = typeof normalAppNavItemIds[number];

export type NormalAppNavIcon = 'plan' | 'profile' | 'trade';
export type NormalAppMobileTabName = 'PlanTab' | 'MeTab' | 'TradeTab';

export type NormalAppNavItem = {
  id: NormalAppNavItemId;
  labelKey: string;
  routeTitleKey: string;
  icon: NormalAppNavIcon;
  webHref: string;
  mobileTabName: NormalAppMobileTabName;
};

export const normalAppNavItems = [
  {
    id: 'plans',
    labelKey: 'navigation.tabs.plans',
    routeTitleKey: 'navigation.routes.plans',
    icon: 'plan',
    webHref: '/plans',
    mobileTabName: 'PlanTab',
  },
  {
    id: 'me',
    labelKey: 'navigation.tabs.me',
    routeTitleKey: 'navigation.routes.me',
    icon: 'profile',
    webHref: '/account',
    mobileTabName: 'MeTab',
  },
  {
    id: 'trade',
    labelKey: 'navigation.tabs.trade',
    routeTitleKey: 'navigation.routes.trade',
    icon: 'trade',
    webHref: '/trades',
    mobileTabName: 'TradeTab',
  },
] as const satisfies readonly NormalAppNavItem[];

export const DEFAULT_NORMAL_APP_NAV_ITEM_ID: NormalAppNavItemId = 'me';
export const DEFAULT_NORMAL_APP_NAV_MOBILE_TAB_NAME: NormalAppMobileTabName = 'MeTab';
export const DEFAULT_NORMAL_APP_NAV_WEB_HREF = '/account';

export function isNormalAppNavItemId(value: string | null | undefined): value is NormalAppNavItemId {
  return normalAppNavItemIds.includes(value as NormalAppNavItemId);
}

export function getNormalAppNavItem(id: NormalAppNavItemId): NormalAppNavItem {
  return normalAppNavItems.find((item) => item.id === id) ?? normalAppNavItems[1];
}

export function getNormalAppNavItemByMobileTabName(tabName: string | null | undefined): NormalAppNavItem | null {
  return normalAppNavItems.find((item) => item.mobileTabName === tabName) ?? null;
}

export type NormalWorkspaceMenuId = 'plans' | 'trade';
export type NormalWorkspaceMenuIcon = 'activity' | 'help' | 'location-on' | 'need' | 'offer' | 'plan' | 'proposal-accepted' | 'save' | 'search' | 'trade';
export type NormalWorkspaceMenuTone = 'info' | 'need' | 'offer' | 'plan' | 'trade';

export type NormalWorkspaceMenuItem = {
  id: string;
  title: string;
  body: string;
  titleKey?: string;
  bodyKey?: string;
  icon: NormalWorkspaceMenuIcon;
  tone: NormalWorkspaceMenuTone;
};

export const normalWorkspaceMenus = {
  plans: [
    { id: 'plan_guide', title: 'Plan Guide', body: 'Learn how Plans, Places, joining, creating, and safety work.', titleKey: 'navigation.workspace.plans.planGuide.title', bodyKey: 'navigation.workspace.plans.planGuide.body', icon: 'help', tone: 'info' },
    { id: 'my_plans', title: 'My plans', body: 'Plans you created.', titleKey: 'plans.workspace.myPlans.title', bodyKey: 'plans.workspace.myPlans.body', icon: 'plan', tone: 'plan' },
    { id: 'joined_plans', title: 'Joined plans', body: 'Plans you joined freely.', titleKey: 'plans.workspace.joinedPlans.title', bodyKey: 'plans.workspace.joinedPlans.body', icon: 'activity', tone: 'info' },
    { id: 'my_places', title: 'My places', body: 'Reusable offline or online places.', titleKey: 'plans.workspace.myPlaces.title', bodyKey: 'plans.workspace.myPlaces.body', icon: 'location-on', tone: 'plan' },
    { id: 'plan_ideas', title: 'Plan ideas', body: 'Starter Plan ideas you can review and customize.', titleKey: 'plans.workspace.planIdeas.title', bodyKey: 'plans.workspace.planIdeas.body', icon: 'search', tone: 'info' },
  ],
  trade: [
    { id: 'trade_guide', title: 'Trade Guide', body: 'Learn how Needs, Offers, trade cards, proposals, and safety work.', titleKey: 'trade.wizard.actions.tradeGuide.title', bodyKey: 'trade.wizard.actions.tradeGuide.body', icon: 'help', tone: 'info' },
    { id: 'my_trades', title: 'My trades', body: 'Manage trades you created.', titleKey: 'trade.wizard.actions.myTrades.title', bodyKey: 'trade.wizard.actions.myTrades.body', icon: 'trade', tone: 'trade' },
    { id: 'proposals', title: 'Proposals', body: 'Open your proposal/deal activity.', titleKey: 'trade.wizard.actions.proposals.title', bodyKey: 'trade.wizard.actions.proposals.body', icon: 'proposal-accepted', tone: 'info' },
    { id: 'my_needs', title: 'My needs', body: 'Manage reusable needs.', titleKey: 'trade.wizard.actions.myNeeds.title', bodyKey: 'trade.wizard.actions.myNeeds.body', icon: 'need', tone: 'need' },
    { id: 'my_offers', title: 'My offers', body: 'Manage reusable offers.', titleKey: 'trade.wizard.actions.myOffers.title', bodyKey: 'trade.wizard.actions.myOffers.body', icon: 'offer', tone: 'offer' },
    { id: 'starter_ideas', title: 'Starter ideas', body: 'Open creative starter ideas you can turn into trades.', titleKey: 'trade.wizard.actions.starterIdeas.title', bodyKey: 'trade.wizard.actions.starterIdeas.body', icon: 'search', tone: 'info' },
  ],
} as const satisfies Record<NormalWorkspaceMenuId, readonly NormalWorkspaceMenuItem[]>;

export function getNormalWorkspaceMenuItems(menuId: NormalWorkspaceMenuId): readonly NormalWorkspaceMenuItem[] {
  return normalWorkspaceMenus[menuId] ?? [];
}
