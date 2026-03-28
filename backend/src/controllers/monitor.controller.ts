import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { MonitorService } from '../services/monitor.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

export const createMonitor = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const monitor = await MonitorService.createMonitor(req.userId!, req.body);
    successResponse(res, monitor, 201);
  } catch (error: any) {
    errorResponse(res, error.message, error.status || 400);
  }
};

export const updateMonitor = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const monitor = await MonitorService.updateMonitor(req.userId!, req.params.id as string, req.body);
    successResponse(res, monitor, 200);
  } catch (error: any) {
    errorResponse(res, error.message, error.status || 400);
  }
};

export const getMonitors = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const monitors = await MonitorService.getMonitors(req.userId!);
    successResponse(res, monitors, 200);
  } catch (error: any) {
    errorResponse(res, error.message, error.status || 400);
  }
};

export const getMonitor = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const monitor = await MonitorService.getMonitorById(req.userId!, req.params.id as string);
    successResponse(res, monitor, 200);
  } catch (error: any) {
    errorResponse(res, error.message, error.status || 400);
  }
};

export const deleteMonitor = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await MonitorService.deleteMonitor(req.userId!, req.params.id as string);
    successResponse(res, {}, 200);
  } catch (error: any) {
    errorResponse(res, error.message, error.status || 400);
  }
};
