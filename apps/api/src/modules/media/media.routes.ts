import crypto from 'node:crypto';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { listMyMediaQuerySchema } from '@hellowhen/contracts';
import { env } from '../../config/env.js';
import { asyncRoute } from '../../lib/asyncRoute.js';
import { prisma } from '../../lib/prisma.js';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';

const maxImageBytes = 5 * 1024 * 1024;
const maxUnattachedActiveImagesPerUser = 20;
const publicUploadNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|jpeg|png|webp)$/i;
const supportedImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
type SupportedImageMimeType = typeof supportedImageMimeTypes[number];
const supportedImageMimeTypeSet = new Set<string>(supportedImageMimeTypes);

fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, env.uploadDir),
  filename: (_req, _file, callback) => {
    callback(null, `${Date.now()}-${crypto.randomUUID()}.upload`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: maxImageBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!isSupportedImageMimeType(file.mimetype)) return callback(new Error('unsupported_image_type'));
    callback(null, true);
  }
});

const uploadImageRateLimit = createRateLimiter({
  keyPrefix: 'media:upload:image',
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
  message: 'Too many image uploads. Please wait before trying again.',
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


type VerifiedUpload = {
  filename: string;
  mimeType: SupportedImageMimeType;
  sizeBytes: number;
};

function isSupportedImageMimeType(value: string): value is SupportedImageMimeType {
  return supportedImageMimeTypeSet.has(value);
}

function detectImageType(buffer: Buffer): Pick<VerifiedUpload, 'mimeType'> & { extension: '.jpg' | '.png' | '.webp' } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mimeType: 'image/jpeg', extension: '.jpg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimeType: 'image/png', extension: '.png' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { mimeType: 'image/webp', extension: '.webp' };
  return null;
}

async function removeUploadedFile(filePath: string) {
  await fsp.rm(filePath, { force: true }).catch(() => undefined);
}

async function verifyUploadedImage(file: Express.Multer.File): Promise<VerifiedUpload | null> {
  const buffer = await fsp.readFile(file.path);
  const detected = detectImageType(buffer);
  if (!detected || detected.mimeType !== file.mimetype) {
    await removeUploadedFile(file.path);
    return null;
  }

  const safeBase = path.basename(file.filename, path.extname(file.filename));
  const verifiedFilename = `${safeBase}${detected.extension}`;
  const verifiedPath = path.join(env.uploadDir, verifiedFilename);
  if (verifiedPath !== file.path) await fsp.rename(file.path, verifiedPath);
  return { filename: verifiedFilename, mimeType: detected.mimeType, sizeBytes: buffer.length };
}

function resolveUploadPath(storageKey: string) {
  const uploadRoot = path.resolve(env.uploadDir);
  const filePath = path.resolve(uploadRoot, storageKey);
  if (filePath !== path.join(uploadRoot, path.basename(storageKey))) return null;
  if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) return null;
  return filePath;
}

function headerSafeFilename(value: string) {
  return path.basename(value).replace(/[\r\n\"]/g, '_').slice(0, 160) || 'upload';
}

function setUploadResponseHeaders(res: Response) {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
}

async function requireUnattachedUploadSlot(req: Request, res: Response, next: NextFunction) {
  const unattachedCount = await prisma.mediaAsset.count({
    where: {
      ownerId: req.user!.id,
      entityType: null,
      entityId: null,
      status: { not: 'removed' }
    }
  });

  if (unattachedCount >= maxUnattachedActiveImagesPerUser) {
    return res.status(409).json({
      error: 'too_many_unattached_uploads',
      message: 'Attach or remove recently uploaded images before uploading more.',
      limit: maxUnattachedActiveImagesPerUser
    });
  }

  return next();
}

export async function serveUploadedMedia(req: Request, res: Response, next: NextFunction) {
  setUploadResponseHeaders(res);

  const storageKey = String(req.params.storageKey ?? '').trim();
  if (!storageKey || !publicUploadNamePattern.test(storageKey)) {
    return res.status(404).json({ error: 'not_found' });
  }

  const media = await prisma.mediaAsset.findFirst({
    where: { storageKey, status: 'active' },
    select: { storageKey: true, filename: true, mimeType: true, sizeBytes: true }
  });
  if (!media || !isSupportedImageMimeType(media.mimeType)) {
    return res.status(404).json({ error: 'not_found' });
  }

  const filePath = resolveUploadPath(media.storageKey);
  if (!filePath) return res.status(404).json({ error: 'not_found' });

  const stat = await fsp.stat(filePath).catch(() => null);
  if (!stat?.isFile()) return res.status(404).json({ error: 'not_found' });

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', media.mimeType);
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Content-Disposition', `inline; filename="${headerSafeFilename(media.filename || media.storageKey)}"`);
  res.sendFile(filePath, (error) => {
    if (error && !res.headersSent) return next(error);
    return undefined;
  });
}

export const mediaRoutes = Router();
mediaRoutes.use(requireAuth);

mediaRoutes.post('/image', requireActiveAccount, uploadImageRateLimit, asyncRoute(requireUnattachedUploadSlot), uploadImage, asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing_image', message: 'Choose a JPEG, PNG, or WEBP image first.' });

  const verified = await verifyUploadedImage(req.file);
  if (!verified) return res.status(415).json({ error: 'unsupported_image_type', message: 'Upload a valid JPEG, PNG, or WEBP image.' });

  const url = `/uploads/${verified.filename}`;
  const media = await prisma.mediaAsset.create({
    data: {
      ownerId: req.user!.id,
      url,
      storageKey: verified.filename,
      filename: req.file.originalname || verified.filename,
      mimeType: verified.mimeType,
      sizeBytes: verified.sizeBytes,
      status: 'active'
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
