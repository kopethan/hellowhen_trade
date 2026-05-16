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

const maxImageBytes = 5 * 1024 * 1024;
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


type VerifiedUpload = {
  filename: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
};

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

export const mediaRoutes = Router();
mediaRoutes.use(requireAuth);

mediaRoutes.post('/image', requireActiveAccount, uploadImage, asyncRoute(async (req, res) => {
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
