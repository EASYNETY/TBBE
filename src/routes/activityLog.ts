// Activity Log Routes
// API endpoints for activity logging and retrieval

import { Router } from 'express';
import { ActivityLogController } from '../controllers/activityLogController';
import { Pool } from 'mysql2/promise';
import { authenticateToken, AuthRequest } from '../middleware/auth';

export const createActivityLogRoutes = (db: Pool) => {
  const router = Router();
  const activityLogController = new ActivityLogController(db);

  // Get authenticated user's activities
  router.get('/', authenticateToken, (req: AuthRequest, res) =>
    activityLogController.getUserActivities(req, res)
  );

  // Get activities by wallet address
  router.get('/wallet/:walletAddress', (req, res) =>
    activityLogController.getWalletActivities(req, res)
  );

  // Get recent activities (global)
  router.get('/recent', (req, res) =>
    activityLogController.getRecentActivities(req, res)
  );

  // Get activities by date range
  router.get('/date-range', (req, res) =>
    activityLogController.getActivitiesByDateRange(req, res)
  );

  // Get activities by action type
  router.get('/by-type/:actionType', (req, res) =>
    activityLogController.getActivitiesByActionType(req, res)
  );

  // Get activities for a property
  router.get('/property/:propertyId', (req, res) =>
    activityLogController.getPropertyActivities(req, res)
  );

  // Get property activities by date range
  router.get('/property/:propertyId/date-range', (req, res) =>
    activityLogController.getPropertyActivitiesByDateRange(req, res)
  );

  // Get property activity statistics
  router.get('/property/:propertyId/stats', (req, res) =>
    activityLogController.getPropertyActivityStats(req, res)
  );

  return router;
};
