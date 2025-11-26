// Activity Log Service
// Handles activity logging for all user actions

import { Pool } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { ActivityLog, activityLogQueries } from '../models/activityLogModel';
import { query } from '../utils/database';

export class ActivityLogService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Log an activity
   */
  async logActivity(
    walletAddress: string,
    actionType: ActivityLog['action_type'],
    entityType: ActivityLog['entity_type'],
    entityId: string,
    description: string,
    options?: {
      userId?: string;
      propertyId?: string;
      amount?: string;
      currency?: string;
      transactionHash?: string;
      details?: Record<string, any>;
      status?: 'PENDING' | 'COMPLETED' | 'FAILED';
    }
  ): Promise<ActivityLog> {
    try {
      const activityId = uuidv4();
      const now = new Date();

      const activity: ActivityLog = {
        id: activityId,
        user_id: options?.userId,
        wallet_address: walletAddress,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        property_id: options?.propertyId,
        description,
        details: options?.details,
        amount: options?.amount,
        currency: options?.currency,
        transaction_hash: options?.transactionHash,
        status: options?.status || 'COMPLETED',
        created_at: now,
        updated_at: now,
      };

      await query(activityLogQueries.insert, [
        activity.id,
        activity.user_id,
        activity.wallet_address,
        activity.action_type,
        activity.entity_type,
        activity.entity_id,
        activity.property_id,
        activity.description,
        activity.details ? JSON.stringify(activity.details) : null,
        activity.amount,
        activity.currency,
        activity.transaction_hash,
        activity.status,
        activity.created_at,
        activity.updated_at,
      ]);

      return activity;
    } catch (error) {
      console.error('Failed to log activity:', error);
      throw error;
    }
  }

  /**
   * Log subscription creation
   */
  async logSubscription(
    walletAddress: string,
    propertyId: string,
    subscriptionId: string,
    amount: string,
    currency: string,
    userId?: string
  ): Promise<ActivityLog> {
    return this.logActivity(
      walletAddress,
      'SUBSCRIBE',
      'SUBSCRIPTION',
      subscriptionId,
      `Subscribed to property ${propertyId} with ${amount} ${currency}`,
      {
        userId,
        propertyId,
        amount,
        currency,
        details: {
          amount,
          currency,
          propertyId,
        },
      }
    );
  }

  /**
   * Log subscription cancellation
   */
  async logSubscriptionCancellation(
    walletAddress: string,
    propertyId: string,
    subscriptionId: string,
    userId?: string
  ): Promise<ActivityLog> {
    return this.logActivity(
      walletAddress,
      'CANCEL_SUBSCRIPTION',
      'SUBSCRIPTION',
      subscriptionId,
      `Cancelled subscription to property ${propertyId}`,
      {
        userId,
        propertyId,
      }
    );
  }

  /**
   * Log disbursement
   */
  async logDisbursement(
    walletAddress: string,
    propertyId: string,
    disbursementId: string,
    amount: string,
    currency: string,
    type: string,
    userId?: string,
    transactionHash?: string
  ): Promise<ActivityLog> {
    return this.logActivity(
      walletAddress,
      'DISBURSE',
      'DISBURSEMENT',
      disbursementId,
      `Received ${type} disbursement of ${amount} ${currency} from property ${propertyId}`,
      {
        userId,
        propertyId,
        amount,
        currency,
        transactionHash,
        details: {
          type,
          amount,
          currency,
          propertyId,
        },
      }
    );
  }

  /**
   * Log wallet deposit
   */
  async logDeposit(
    walletAddress: string,
    amount: string,
    currency: string,
    userId?: string,
    transactionHash?: string
  ): Promise<ActivityLog> {
    return this.logActivity(
      walletAddress,
      'DEPOSIT',
      'WALLET',
      walletAddress,
      `Deposited ${amount} ${currency} to wallet`,
      {
        userId,
        amount,
        currency,
        transactionHash,
        details: {
          amount,
          currency,
        },
      }
    );
  }

  /**
   * Log wallet withdrawal
   */
  async logWithdrawal(
    walletAddress: string,
    amount: string,
    currency: string,
    userId?: string,
    transactionHash?: string
  ): Promise<ActivityLog> {
    return this.logActivity(
      walletAddress,
      'WITHDRAW',
      'WALLET',
      walletAddress,
      `Withdrew ${amount} ${currency} from wallet`,
      {
        userId,
        amount,
        currency,
        transactionHash,
        details: {
          amount,
          currency,
        },
      }
    );
  }

  /**
   * Log KYC verification
   */
  async logKycVerification(
    walletAddress: string,
    verificationId: string,
    status: 'COMPLETED' | 'FAILED',
    userId?: string
  ): Promise<ActivityLog> {
    return this.logActivity(
      walletAddress,
      'KYC_VERIFY',
      'WALLET',
      verificationId,
      `KYC verification ${status.toLowerCase()}`,
      {
        userId,
        status,
        details: {
          status,
        },
      }
    );
  }

  /**
   * Get all activities for a user
   */
  async getUserActivities(userId: string, limit: number = 50): Promise<ActivityLog[]> {
    try {
      const activities = await query(
        `${activityLogQueries.findRecentByUser}`,
        [userId, limit]
      );
      return activities as ActivityLog[];
    } catch (error) {
      console.error('Failed to fetch user activities:', error);
      throw error;
    }
  }

  /**
   * Get all activities for a wallet address
   */
  async getWalletActivities(walletAddress: string, limit: number = 50): Promise<ActivityLog[]> {
    try {
      const activities = await query(
        `${activityLogQueries.findByWalletAddress} LIMIT ${limit}`,
        [walletAddress]
      );
      return activities as ActivityLog[];
    } catch (error) {
      console.error('Failed to fetch wallet activities:', error);
      throw error;
    }
  }

  /**
   * Get all activities for a property
   */
  async getPropertyActivities(propertyId: string, limit: number = 100): Promise<ActivityLog[]> {
    try {
      const activities = await query(
        `${activityLogQueries.findByPropertyId} LIMIT ${limit}`,
        [propertyId]
      );
      return activities as ActivityLog[];
    } catch (error) {
      console.error('Failed to fetch property activities:', error);
      throw error;
    }
  }

  /**
   * Get activities by date range
   */
  async getActivitiesByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<ActivityLog[]> {
    try {
      const activities = await query(
        `${activityLogQueries.findByDateRange} LIMIT ${limit}`,
        [startDate, endDate]
      );
      return activities as ActivityLog[];
    } catch (error) {
      console.error('Failed to fetch activities by date range:', error);
      throw error;
    }
  }

  /**
   * Get property activities by date range
   */
  async getPropertyActivitiesByDateRange(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ActivityLog[]> {
    try {
      const activities = await query(
        activityLogQueries.findPropertyActivitiesByDateRange,
        [propertyId, startDate, endDate]
      );
      return activities as ActivityLog[];
    } catch (error) {
      console.error('Failed to fetch property activities by date range:', error);
      throw error;
    }
  }

  /**
   * Get activities by action type
   */
  async getActivitiesByActionType(actionType: ActivityLog['action_type']): Promise<ActivityLog[]> {
    try {
      const activities = await query(
        activityLogQueries.findByActionType,
        [actionType]
      );
      return activities as ActivityLog[];
    } catch (error) {
      console.error('Failed to fetch activities by action type:', error);
      throw error;
    }
  }

  /**
   * Update activity status (when async operations complete)
   */
  async updateActivityStatus(
    activityId: string,
    status: 'PENDING' | 'COMPLETED' | 'FAILED',
    transactionHash?: string
  ): Promise<void> {
    try {
      await query(
        activityLogQueries.updateStatus,
        [status, transactionHash || null, new Date(), activityId]
      );
    } catch (error) {
      console.error('Failed to update activity status:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics for a property
   */
  async getPropertyActivityStats(propertyId: string): Promise<Record<string, number>> {
    try {
      const stats = await query(
        activityLogQueries.countByPropertyAndAction,
        [propertyId]
      );

      const result: Record<string, number> = {};
      for (const stat of stats) {
        result[stat.action_type] = stat.count;
      }

      return result;
    } catch (error) {
      console.error('Failed to fetch property activity stats:', error);
      throw error;
    }
  }

  /**
   * Get recent activities (global)
   */
  async getRecentActivities(limit: number = 50): Promise<ActivityLog[]> {
    try {
      const activities = await query(
        `${activityLogQueries.findRecent}`,
        []
      );
      return activities.slice(0, limit) as ActivityLog[];
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
      throw error;
    }
  }
}
