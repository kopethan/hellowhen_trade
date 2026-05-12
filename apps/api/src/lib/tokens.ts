import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  sid?: string;
  iat?: number;
  exp?: number;
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
}
