import { Pool } from 'mysql2/promise';
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
export declare class SubscriptionDistributionChannelService {
    private subscriptionService;
    private provider;
    private signer;
    constructor(db: Pool);
    /**
     * Initialize a distribution channel for a property
     * This sets up the initial structure for managing subscriptions and disbursements
     */
    initializeDistributionChannel(config: DistributionChannelConfig): Promise<void>;
    /**
     * Get channel statistics for a property
     */
    getChannelStatistics(propertyId: string): Promise<ChannelStatistics>;
    /**
     * Create and process disbursements for all subscribers
     * Returns both created disbursements and execution results if autoExecute is true
     */
    createAndProcessDisbursements(propertyId: string, distributionId: string, totalDisbursementAmount: string, currency: string, type: 'YIELD' | 'RETURN' | 'REVENUE' | 'DIVIDEND', tokenAddress?: string, autoExecute?: boolean): Promise<{
        disbursements: any[];
        executionResults?: Map<string, string>;
    }>;
    /**
     * Execute all pending disbursements for a property
     */
    executePendingDisbursements(propertyId: string, tokenAddress: string): Promise<{
        executed: number;
        failed: number;
        results: Map<string, string>;
    }>;
    /**
     * Get disbursement history for a property
     */
    getDisbursementHistory(propertyId: string, limit?: number, offset?: number): Promise<any[]>;
    /**
     * Get subscriber details including their disbursement history
     */
    getSubscriberDetails(subscriptionId: string): Promise<any>;
    /**
     * Get property overview including all subscribers and disbursements
     */
    getPropertyOverview(propertyId: string): Promise<any>;
    /**
     * Validate disbursement amounts before execution
     */
    validateDisbursements(disbursementIds: string[], totalAvailableFunds: string): Promise<{
        valid: boolean;
        totalRequired: string;
        availableFunds: string;
        issues: string[];
    }>;
    /**
     * Generate a detailed report of all activities for a property
     */
    generatePropertyReport(propertyId: string): Promise<any>;
    /**
     * Helper method to calculate subscription breakdown
     */
    private calculateSubscriptionBreakdown;
    /**
     * Helper method to calculate disbursement breakdown
     */
    private calculateDisbursementBreakdown;
}
//# sourceMappingURL=subscriptionDistributionChannelService.d.ts.map