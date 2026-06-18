import type { MembershipProductHandle } from '@hellowhen/shared';

type ProductCard = {
  handle: MembershipProductHandle;
  title: string;
  price: string;
  appleProductId: string;
  googleProductId: string;
};

type Props = {
  products: ProductCard[];
  onSynced: () => Promise<void> | void;
};

export function IosStoreKitMembershipCard(_props: Props) {
  // Native StoreKit purchases are intentionally disabled in this binary.
  // Keep membership status/product metadata visible while avoiding the expo-iap
  // native module until the app is upgraded to a compatible Expo/RN/IAP stack.
  return null;
}
