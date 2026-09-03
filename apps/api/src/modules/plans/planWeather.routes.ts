import { Router } from 'express';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { usersHaveBlockBetween } from '../users/userBlocks.js';
import { weatherService } from '../weather/weatherFactory.js';
import { canReadPlanPlaceWeather, lookupPlanPlaceWeather } from './planPlaceWeather.js';

export const planWeatherRoutes = Router();

planWeatherRoutes.get('/:planId/places/:planPlaceId/weather', requireAuth, asyncRoute(async (req, res) => {
  const planId = req.params.planId;
  const planPlaceId = req.params.planPlaceId;
  const viewerId = req.user!.id;
  if (!planId) return res.status(400).json({ error: 'missing_plan_id' });
  if (!planPlaceId) return res.status(400).json({ error: 'missing_plan_place_id' });

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      ownerId: true,
      status: true,
      deletedAt: true,
      owner: { select: { trustTier: true } },
      places: {
        where: { id: planPlaceId },
        take: 1,
        select: {
          id: true,
          mode: true,
          startsAt: true,
          latitude: true,
          longitude: true,
          sourcePlace: { select: { latitude: true, longitude: true } },
        },
      },
    },
  });

  if (!plan || !canReadPlanPlaceWeather({
    ownerId: plan.ownerId,
    status: plan.status,
    deletedAt: plan.deletedAt,
    ownerTrustTier: plan.owner?.trustTier ?? null,
  }, viewerId)) {
    return res.status(404).json({ error: 'not_found' });
  }

  if (plan.ownerId !== viewerId && await usersHaveBlockBetween(viewerId, plan.ownerId)) {
    return res.status(404).json({ error: 'not_found' });
  }

  const place = plan.places[0];
  if (!place) return res.status(404).json({ error: 'not_found' });

  const weather = await lookupPlanPlaceWeather(place, weatherService);
  return res.json({ weather });
}));
