// Activity Log Controller
// Handles API requests for activity logging and retrieval

import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import { ActivityLogService } from '../services/activityLogService';
import { AuthRequest } from '../middleware/auth';

export class ActivityLogController {
  private activityLogService: ActivityLogService;

  constructor(db: Pool) {
    this.activityLogService = new ActivityLogService(db);
  }

  /**
   * GET /api/activities
   * Get authenticated user's recent activities
   */
  async getUserActivities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await this.activityLogService.getUserActivities(userId, limit);

      res.status(200).json({
        success: true,
        data: activities,
        total: activities.length,
      });
    } catch (error) {
      console.error('Get user activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activities',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/activities/wallet/:walletAddress
   * Get activities for a wallet address
   */
  async getWalletActivities(req: Request, res: Response): Promise<void> {
    try {
      const { walletAddress } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!walletAddress) {
        res.status(400).json({
          success: false,
          message: 'Wallet address is required',
        });
        return;
      }

      const activities = await this.activityLogService.getWalletActivities(walletAddress, limit);

      res.status(200).json({
        success: true,
        data: activities,
        total: activities.length,
      });
    } catch (error) {
      console.error('Get wallet activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch wallet activities',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/properties/:propertyId/activities
   * Get activities for a property
   */
  async getPropertyActivities(req: Request, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      if (!propertyId) {
        res.status(400).json({
          success: false,
          message: 'Property ID is required',
        });
        return;
      }

      const activities = await this.activityLogService.getPropertyActivities(propertyId, limit);

      res.status(200).json({
        success: true,
        data: activities,
        total: activities.length,
      });
    } catch (error) {
      console.error('Get property activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch property activities',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/activities/recent
   * Get recent activities (global)
   */
  async getRecentActivities(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await this.activityLogService.getRecentActivities(limit);

      res.status(200).json({
        success: true,
        data: activities,
        total: activities.length,
      });
    } catch (error) {
      console.error('Get recent activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent activities',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/activities/date-range
   * Get activities by date range
   */
  async getActivitiesByDateRange(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const limit = parseInt(req.query.limit as string) || 100;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'startDate and endDate query parameters are required',
        });
        return;
      }

      const activities = await this.activityLogService.getActivitiesByDateRange(
        new Date(startDate as string),
        new Date(endDate as string),
        limit
      );

      res.status(200).json({
        success: true,
        data: activities,
        total: activities.length,
      });
    } catch (error) {
      console.error('Get activities by date range error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activities',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/properties/:propertyId/activities/date-range
   * Get property activities by date range
   */
  async getPropertyActivitiesByDateRange(req: Request, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;
      const { startDate, endDate } = req.query;

      if (!propertyId || !startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'propertyId, startDate, and endDate are required',
        });
        return;
      }

      const activities = await this.activityLogService.getPropertyActivitiesByDateRange(
        propertyId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.status(200).json({
        success: true,
        data: activities,
        total: activities.length,
      });
    } catch (error) {
      console.error('Get property activities by date range error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch property activities',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/activities/by-type/:actionType
   * Get activities by action type
   */
  async getActivitiesByActionType(req: Request, res: Response): Promise<void> {
    try {
      const { actionType } = req.params;

      if (!actionType) {
        res.status(400).json({
          success: false,
          message: 'Action type is required',
        });
        return;
      }

      const activities = await this.activityLogService.getActivitiesByActionType(
        actionType as any
      );

      res.status(200).json({
        success: true,
        data: activities,
        total: activities.length,
      });
    } catch (error) {
      console.error('Get activities by action type error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activities',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/properties/:propertyId/activities/stats
   * Get activity statistics for a property
   */
  async getPropertyActivityStats(req: Request, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;

      if (!propertyId) {
        res.status(400).json({
          success: false,
          message: 'Property ID is required',
        });
        return;
      }

      const stats = await this.activityLogService.getPropertyActivityStats(propertyId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Get property activity stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activity statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
