import { Router } from 'express';
import { MeterController } from './meter.controller';

export function createMeterRouter(meterController = new MeterController()): Router {
  const router = Router();
  router.get('/', meterController.getMeters);
  router.get('/:meterId', meterController.getMeterById);
  router.get('/:meterId/consumption', meterController.getMeterConsumption);
  router.get('/:meterId/hierarchy', meterController.getMeterHierarchy);
  return router;
}
