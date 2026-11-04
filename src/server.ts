import { app } from './app';
import { env } from './config/env';

const server = app.listen(env.PORT, () => {
  console.log(`[SERVER] Urja Meter API listening on port ${env.PORT} (env: ${env.NODE_ENV})`);
  console.log(`[SERVER] Upstream portal target: ${env.PORTAL_BASE_URL}`);
});

function handleShutdown(signal: string) {
  console.log(`\n[SERVER] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[SERVER] Closed remaining connections.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[SERVER] Forcefully terminating after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
