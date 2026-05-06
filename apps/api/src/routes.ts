import { Router } from 'express';
import { authRoutes } from './modules/auth/auth.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { needsRoutes } from './modules/needs/needs.routes.js';
import { offersRoutes } from './modules/offers/offers.routes.js';
import { profileRoutes } from './modules/profile/profile.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';
import { tradesRoutes } from './modules/trades/trades.routes.js';
import { walletRoutes } from './modules/wallet/wallet.routes.js';

export const routes = Router();

routes.use('/health', healthRoutes);
routes.use('/auth', authRoutes);
routes.use('/profile', profileRoutes);
routes.use('/settings', settingsRoutes);
routes.use('/needs', needsRoutes);
routes.use('/offers', offersRoutes);
routes.use('/trades', tradesRoutes);
routes.use('/wallet', walletRoutes);
