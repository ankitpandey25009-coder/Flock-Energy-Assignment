import express, { Express } from 'express';
import { createMeterRouter } from './modules/meters/meter.routes';
import { notFoundHandler } from './middleware/not-found.middleware';
import { errorHandler } from './middleware/error.middleware';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  // Lightweight health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });

  // API v1 routes
  app.use('/api/v1/meters', createMeterRouter());

  // 404 & centralized error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
