// Express app setup
// CORS, JSON parsing, morgan logging, helmet security, route mounting, static UI files

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as path from 'path';
import { config } from './config';
import { oauthRouter, authMiddleware } from './routes/oauth';
import { envelopesRouter } from './routes/envelopes';
import { templatesRouter } from './routes/templates';
import { accountsRouter } from './routes/accounts';
import { apiRouter } from './routes/api';

export function createApp(): express.Application {
  const app = express();

  // --- Middleware ---

  // Security headers (relaxed for local dev use)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS — allow all origins (it's a local dev tool)
  app.use(cors());

  // JSON body parsing with generous limit for document base64 content
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Request logging
  const logFormat = config.logLevel === 'debug' ? 'dev' : 'short';
  app.use(morgan(logFormat));

  // --- Static files (Web UI) ---
  // In development (ts-node), serve from src/ui/
  // In production (compiled), serve from dist/ui/ which should be copied to public/
  const uiPath = __dirname.includes('dist')
    ? path.join(__dirname, 'ui')
    : path.join(__dirname, 'ui');
  app.use(express.static(uiPath));

  // --- API Routes ---

  // OAuth (no auth required)
  app.use('/oauth', oauthRouter);

  // Apply permissive auth middleware to all DocuSign API routes
  app.use('/restapi', authMiddleware);

  // Account endpoints
  app.use(accountsRouter);

  // Envelope API
  app.use('/restapi/v2.1/accounts/:accountId/envelopes', envelopesRouter);

  // Template API
  app.use('/restapi/v2.1/accounts/:accountId/templates', templatesRouter);

  // Internal API for Web UI
  app.use('/api/v1', apiRouter);

  // --- Fallback ---

  // For SPA-style UI, serve index.html for unmatched GET requests that accept HTML
  app.get('*', (req, res, next) => {
    if (req.accepts('html')) {
      const indexPath = path.join(uiPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          // No UI files yet — that's fine, just 404
          next();
        }
      });
    } else {
      next();
    }
  });

  // 404 handler for API routes
  app.use((req, res) => {
    res.status(404).json({
      errorCode: 'RESOURCE_NOT_FOUND',
      message: `No resource found at ${req.method} ${req.path}`,
    });
  });

  return app;
}
