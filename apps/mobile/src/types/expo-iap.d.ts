declare module 'expo-iap' {
  export type Purchase = Record<string, unknown>;
  export type Subscription = Record<string, unknown>;
  export function initConnection(): Promise<boolean | void> | boolean | void;
  export function getSubscriptions(args: { skus: string[] }): Promise<Subscription[]>;
  export function getProducts(args: { skus: string[] }): Promise<Subscription[]>;
  export function requestSubscription(args: { sku: string }): Promise<Purchase | Purchase[] | null | undefined>;
  export function requestPurchase(args: { sku: string }): Promise<Purchase | Purchase[] | null | undefined>;
  export function getAvailablePurchases(): Promise<Purchase[]>;
  export function finishTransaction(args: { purchase: Purchase; isConsumable?: boolean }): Promise<void>;
}
