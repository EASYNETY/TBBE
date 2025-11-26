// Property Subscription Distribution Channel Service
// Manages the complete flow from subscription to disbursement

import { Pool } from 'mysql2/promise';
import { ethers } from 'ethers';
import { SubscriptionService } from './subscriptionService';
import { query } from '../utils/database';
import { getProvider } from '../utils/ethersProvider';

export interface DistributionChannelConfig {
  propertyId: string;
  tokenAddress: string;
  currency: string;
  autoExecute?: boolean;
  batchSize?: number;
}

export interface DisbursementPayload {
  subscriberAddress: string;
  amount: string;
}

export interface ChannelStatistics {
  totalSubscribers: number;
  totalSubscriptionAmount: string;
  activeSubscribers: number;
  totalDisbursed: string;
  pendingDisbursements: number;
  lastDisbursementDate?: Date;
}

/**
 * Complete subscription and distribution channel management
 * Handles the entire flow from subscription creation to disbursement execution
 */
export class SubscriptionDistributionChannelService {
  private subscriptionService: SubscriptionService;
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer;

  constructor(db: Pool) {
    this.subscriptionService = new SubscriptionService(db);
    this.provider = getProvider();
    this.signer = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);
  }

  /**
   * Initialize a distribution channel for a property
   * This sets up the initial structure for managing subscriptions and disbursements
   */
  async initializeDistributionChannel(config: DistributionChannelConfig): Promise<void> {
    try {
      console.log(`Initializing distribution channel for property: ${config.propertyId}`);

      // Verify property exists
      const property = await query('SELECT id FROM properties WHERE id = ?', [config.propertyId]);
      if (!property || property.length === 0) {
        throw new Error(`Property ${config.propertyId} not found`);
      }

      // Verify token address is valid
      if (!ethers.isAddress(config.tokenAddress)) {
        throw new Error(`Invalid token address: ${config.tokenAddress}`);
      }

      console.log(`Distribution channel initialized for property: ${config.propertyId}`);
      // Additional setup can be added here (e.g., creating configuration records)
    } catch (error) {
      console.error('Failed to initialize distribution channel:', error);
      throw error;
    }
  }

  /**
   * Get channel statistics for a property
   */
  async getChannelStatistics(propertyId: string): Promise<ChannelStatistics> {
    try {
      const totalSubscribers = await this.subscriptionService.getTotalSubscriberCount(propertyId);
      const totalSubscriptionAmount = await this.subscriptionService.getTotalSubscriptionAmount(
        propertyId
      );

      const activeSubscriptions = await this.subscriptionService.getActiveSubscriptionsByProperty(
        propertyId
      );
      const activeSubscribers = activeSubscriptions.length;

      const totalDisbursed = await this.subscriptionService.getTotalDisbursedByProperty(propertyId);

      const pendingDisbursements = await this.subscriptionService.getPendingDisbursementsByProperty(
        propertyId
      );

      return {
        totalSubscribers,
        totalSubscriptionAmount,
        activeSubscribers,
        totalDisbursed,
        pendingDisbursements: pendingDisbursements.length,
      };
    } catch (error) {
      console.error('Failed to get channel statistics:', error);
      throw error;
    }
  }

  /**
   * Create and process disbursements for all subscribers
   * Returns both created disbursements and execution results if autoExecute is true
   */
  async createAndProcessDisbursements(
    propertyId: string,
    distributionId: string,
    totalDisbursementAmount: string,
    currency: string,
    type: 'YIELD' | 'RETURN' | 'REVENUE' | 'DIVIDEND',
    tokenAddress?: string,
    autoExecute: boolean = false
  ): Promise<{
    disbursements: any[];
    executionResults?: Map<string, string>;
  }> {
    try {
      console.log(`Creating disbursements for property: ${propertyId}`);

      // Get active subscribers
      const subscribers = await this.subscriptionService.getActiveSubscriptionsByProperty(
        propertyId
      );

      if (subscribers.length === 0) {
        throw new Error(`No active subscribers found for property ${propertyId}`);
      }

      // Calculate total share percentage to distribute proportionally
      const totalSharePercentage = subscribers.reduce((sum, sub) => sum + sub.share_percentage, 0);

      // Create disbursements for each subscriber
      const disbursements = [];
      for (const subscriber of subscribers) {
        // Calculate proportional disbursement amount
        const proportionalAmount = (
          (parseFloat(totalDisbursementAmount) * subscriber.share_percentage) /
          totalSharePercentage
        ).toString();

        const disbursement = await this.subscriptionService.createDisbursement({
          propertyId,
          distributionId,
          subscriberId: subscriber.id!,
          disbursementAmount: proportionalAmount,
          currency,
          type,
        });

        disbursements.push(disbursement);
      }

      console.log(`Created ${disbursements.length} disbursements`);

      // Execute disbursements if requested
      let executionResults;
      if (autoExecute && tokenAddress) {
        console.log('Auto-executing disbursements...');
        const disbursementIds = disbursements.map((d) => d.id);
        executionResults = await this.subscriptionService.executeBatchDisbursements(
          disbursementIds,
          tokenAddress
        );
      }

      return {
        disbursements,
        executionResults,
      };
    } catch (error) {
      console.error('Failed to create and process disbursements:', error);
      throw error;
    }
  }

  /**
   * Execute all pending disbursements for a property
   */
  async executePendingDisbursements(propertyId: string, tokenAddress: string): Promise<{
    executed: number;
    failed: number;
    results: Map<string, string>;
  }> {
    try {
      console.log(`Executing pending disbursements for property: ${propertyId}`);

      // Get pending disbursements
      const pendingDisbursements = await this.subscriptionService.getPendingDisbursementsByProperty(
        propertyId
      );

      if (pendingDisbursements.length === 0) {
        console.log('No pending disbursements found');
        return {
          executed: 0,
          failed: 0,
          results: new Map(),
        };
      }

      const disbursementIds = pendingDisbursements.map((d) => d.id);
      const results = await this.subscriptionService.executeBatchDisbursements(
        disbursementIds,
        tokenAddress
      );

      const executed = Array.from(results.values()).filter((v) => v !== 'FAILED').length;
      const failed = Array.from(results.values()).filter((v) => v === 'FAILED').length;

      console.log(`Executed ${executed} disbursements, ${failed} failed`);

      return {
        executed,
        failed,
        results,
      };
    } catch (error) {
      console.error('Failed to execute pending disbursements:', error);
      throw error;
    }
  }

  /**
   * Get disbursement history for a property
   */
  async getDisbursementHistory(
    propertyId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const disbursements = await this.subscriptionService.getDisbursementsByProperty(propertyId);

      return disbursements.slice(offset, offset + limit);
    } catch (error) {
      console.error('Failed to get disbursement history:', error);
      throw error;
    }
  }

  /**
   * Get subscriber details including their disbursement history
   */
  async getSubscriberDetails(subscriptionId: string): Promise<any> {
    try {
      const subscriptionData = await query(
        'SELECT * FROM subscriptions WHERE id = ?',
        [subscriptionId]
      );

      if (!subscriptionData || subscriptionData.length === 0) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      const subscription = subscriptionData[0];

      // Get disbursement history
      const disbursements = await this.subscriptionService.getDisbursementsBySubscriber(
        subscriptionId
      );

      const totalDisbursed = await this.subscriptionService.getTotalDisbursedBySubscriber(
        subscriptionId
      );

      return {
        subscription,
        disbursements,
        totalDisbursed,
        disbursementCount: disbursements.length,
      };
    } catch (error) {
      console.error('Failed to get subscriber details:', error);
      throw error;
    }
  }

  /**
   * Get property overview including all subscribers and disbursements
   */
  async getPropertyOverview(propertyId: string): Promise<any> {
    try {
      const property = await query('SELECT * FROM properties WHERE id = ?', [propertyId]);

      if (!property || property.length === 0) {
        throw new Error(`Property ${propertyId} not found`);
      }

      const stats = await this.getChannelStatistics(propertyId);
      const subscribers = await this.subscriptionService.getActiveSubscriptionsByProperty(
        propertyId
      );
      const disbursements = await this.subscriptionService.getDisbursementsByProperty(propertyId);

      return {
        property: property[0],
        statistics: stats,
        subscribers,
        disbursements,
      };
    } catch (error) {
      console.error('Failed to get property overview:', error);
      throw error;
    }
  }

  /**
   * Validate disbursement amounts before execution
   */
  async validateDisbursements(disbursementIds: string[], totalAvailableFunds: string): Promise<{
    valid: boolean;
    totalRequired: string;
    availableFunds: string;
    issues: string[];
  }> {
    try {
      const issues: string[] = [];
      let totalRequired = '0';

      for (const disbursementId of disbursementIds) {
        const disbursementData = await query(
          'SELECT disbursement_amount FROM disbursements WHERE id = ?',
          [disbursementId]
        );

        if (!disbursementData || disbursementData.length === 0) {
          issues.push(`Disbursement ${disbursementId} not found`);
          continue;
        }

        totalRequired = (
          parseFloat(totalRequired) + parseFloat(disbursementData[0].disbursement_amount)
        ).toString();
      }

      const totalRequiredNum = parseFloat(totalRequired);
      const availableFundsNum = parseFloat(totalAvailableFunds);

      if (totalRequiredNum > availableFundsNum) {
        issues.push(
          `Insufficient funds: required ${totalRequired}, available ${totalAvailableFunds}`
        );
      }

      return {
        valid: issues.length === 0,
        totalRequired,
        availableFunds: totalAvailableFunds,
        issues,
      };
    } catch (error) {
      console.error('Failed to validate disbursements:', error);
      throw error;
    }
  }

  /**
   * Generate a detailed report of all activities for a property
   */
  async generatePropertyReport(propertyId: string): Promise<any> {
    try {
      const overview = await this.getPropertyOverview(propertyId);
      const stats = await this.getChannelStatistics(propertyId);

      return {
        report_date: new Date(),
        property_id: propertyId,
        property_name: overview.property.title,
        statistics: stats,
        subscribers_count: overview.subscribers.length,
        disbursements_count: overview.disbursements.length,
        subscription_breakdown: this.calculateSubscriptionBreakdown(overview.subscribers),
        disbursement_breakdown: this.calculateDisbursementBreakdown(overview.disbursements),
      };
    } catch (error) {
      console.error('Failed to generate property report:', error);
      throw error;
    }
  }

  /**
   * Helper method to calculate subscription breakdown
   */
  private calculateSubscriptionBreakdown(subscribers: any[]): any {
    const breakdown: { [key: string]: any } = {
      by_currency: {},
      by_status: {},
    };

    for (const subscriber of subscribers) {
      // By currency
      if (!breakdown.by_currency[subscriber.currency]) {
        breakdown.by_currency[subscriber.currency] = {
          count: 0,
          total_amount: '0',
        };
      }
      breakdown.by_currency[subscriber.currency].count++;
      breakdown.by_currency[subscriber.currency].total_amount = (
        parseFloat(breakdown.by_currency[subscriber.currency].total_amount) +
        parseFloat(subscriber.subscription_amount)
      ).toString();

      // By status
      if (!breakdown.by_status[subscriber.status]) {
        breakdown.by_status[subscriber.status] = 0;
      }
      breakdown.by_status[subscriber.status]++;
    }

    return breakdown;
  }

  /**
   * Helper method to calculate disbursement breakdown
   */
  private calculateDisbursementBreakdown(disbursements: any[]): any {
    const breakdown: { [key: string]: any } = {
      by_type: {},
      by_status: {},
      by_currency: {},
    };

    for (const disbursement of disbursements) {
      // By type
      if (!breakdown.by_type[disbursement.type]) {
        breakdown.by_type[disbursement.type] = {
          count: 0,
          total_amount: '0',
        };
      }
      breakdown.by_type[disbursement.type].count++;
      breakdown.by_type[disbursement.type].total_amount = (
        parseFloat(breakdown.by_type[disbursement.type].total_amount) +
        parseFloat(disbursement.disbursement_amount)
      ).toString();

      // By status
      if (!breakdown.by_status[disbursement.status]) {
        breakdown.by_status[disbursement.status] = 0;
      }
      breakdown.by_status[disbursement.status]++;

      // By currency
      if (!breakdown.by_currency[disbursement.currency]) {
        breakdown.by_currency[disbursement.currency] = {
          count: 0,
          total_amount: '0',
        };
      }
      breakdown.by_currency[disbursement.currency].count++;
      breakdown.by_currency[disbursement.currency].total_amount = (
        parseFloat(breakdown.by_currency[disbursement.currency].total_amount) +
        parseFloat(disbursement.disbursement_amount)
      ).toString();
    }

    return breakdown;
  }
}
