import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { listMyMediaQuerySchema } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

const maxImageBytes = 5 * 1024 * 1024;
fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, env.uploadDir),
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    callback(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: maxImageBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new Error('unsupported_image_type'));
    callback(null, true);
  }
});

function uploadImage(req: Request, res: Response, next: NextFunction) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'image_too_large', message: 'Images must be 5 MB or smaller.' });
    }
    if (error instanceof Error && error.message === 'unsupported_image_type') {
      return res.status(415).json({ error: 'unsupported_image_type', message: 'Upload a JPEG, PNG, or WEBP image.' });
    }
    return next(error);
  });
}

export const mediaRoutes = Router();
mediaRoutes.use(requireAuth);

mediaRoutes.post('/image', uploadImage, asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing_image', message: 'Choose a JPEG, PNG, or WEBP image first.' });

  const url = `/uploads/${req.file.filename}`;
  const media = await prisma.mediaAsset.create({
    data: {
      ownerId: req.user!.id,
      url,
      storageKey: req.file.filename,
      filename: req.file.originalname || req.file.filename,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      status: 'pending_review'
    }
  });

  res.status(201).json({ media });
}));

mediaRoutes.get('/mine', asyncRoute(async (req, res) => {
  const input = listMyMediaQuerySchema.parse(req.query);
  const media = await prisma.mediaAsset.findMany({
    where: {
      ownerId: req.user!.id,
      status: { not: 'removed' },
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.status ? { status: input.status } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: input.take ?? 100
  });

  res.json({ media });
}));

mediaRoutes.delete('/:mediaId', asyncRoute(async (req, res) => {
  const media = await prisma.mediaAsset.findFirst({ where: { id: req.params.mediaId, ownerId: req.user!.id, status: { not: 'removed' } } });
  if (!media) return res.status(404).json({ error: 'not_found' });
  const removed = await prisma.mediaAsset.update({ where: { id: media.id }, data: { status: 'removed' } });
  res.json({ media: removed });
}));
