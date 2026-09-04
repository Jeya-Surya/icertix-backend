/**
 * iCertiX - Backend Server Standalone Entry Point
 */

import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import { createExpressApp } from './app';
import { AppRepositories } from './infrastructure/database';

async function bootstrap() {
  // Initialize PostgreSQL database connection & schema synchronization
  await AppRepositories.initializeDatabase();

  const app = createExpressApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[iCertiX Backend] Running with PostgreSQL at http://0.0.0.0:${PORT}`);
    console.log(`[iCertiX API] Public verification at http://0.0.0.0:${PORT}/api/public/verify/:credentialId`);
  });
}

bootstrap().catch((err) => {
  console.error('[iCertiX Backend] Fatal startup error:', err);
  process.exit(1);
});
