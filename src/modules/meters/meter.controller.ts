import { Request, Response, NextFunction } from 'express';
import { MeterService } from './meter.service';
import { ConsumptionService } from '../consumption/consumption.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { GetMetersQuerySchema, MeterIdParamSchema } from './meter.schema';
import { ValidationError } from '../../shared/errors';

export class MeterController {
  private readonly meterService: MeterService;
  private readonly consumptionService: ConsumptionService;
  private readonly hierarchyService: HierarchyService;

  constructor(
    meterService = new MeterService(),
    consumptionService = new ConsumptionService(),
    hierarchyService = new HierarchyService()
  ) {
    this.meterService = meterService;
    this.consumptionService = consumptionService;
    this.hierarchyService = hierarchyService;
  }

  public getMeters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedQuery = GetMetersQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError('Invalid meter query parameters', parsedQuery.error.format());
      }

      const { q, page } = parsedQuery.data;
      const result = await this.meterService.getMeters(q, page);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public getMeterById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedParams = MeterIdParamSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError('Invalid meter identifier', parsedParams.error.format());
      }

      const { meterId } = parsedParams.data;
      const meter = await this.meterService.getMeterById(meterId);

      res.status(200).json({ data: meter });
    } catch (err) {
      next(err);
    }
  };

  public getMeterConsumption = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedParams = MeterIdParamSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError('Invalid meter identifier', parsedParams.error.format());
      }

      const { meterId } = parsedParams.data;
      const result = await this.consumptionService.getConsumption(meterId);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public getMeterHierarchy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedParams = MeterIdParamSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError('Invalid meter identifier', parsedParams.error.format());
      }

      const { meterId } = parsedParams.data;
      const result = await this.hierarchyService.getMeterHierarchy(meterId);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
