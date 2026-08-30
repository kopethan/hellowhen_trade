import { Router } from 'express';
import { mobileReleasePolicyQuerySchema } from '@hellowhen/contracts';
import { getConfiguredMobileReleasePolicy } from './mobileReleaseConfig.js';

export const mobileReleaseRoutes = Router();

mobileReleaseRoutes.get('/release-policy', (req, res) => {
  const input = mobileReleasePolicyQuerySchema.parse(req.query);
  const policy = getConfiguredMobileReleasePolicy(input);
  res.setHeader('Cache-Control', 'no-store');
  res.json(policy);
});
