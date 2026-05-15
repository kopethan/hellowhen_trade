import { PlansListClient } from '../../features/plans/PlansListClient';
import { getPlansWebFlags } from '../../lib/serverFeatureFlags';

export default function PlansPage() {
  return <PlansListClient {...getPlansWebFlags()} />;
}
