import { PlanCreateClient } from '../../../features/plans/PlanCreateClient';
import { getPlansWebFlags } from '../../../lib/serverFeatureFlags';

export default function NewPlanPage() {
  return <PlanCreateClient {...getPlansWebFlags()} />;
}
