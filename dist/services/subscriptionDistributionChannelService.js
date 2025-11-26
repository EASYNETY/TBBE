"use strict";
// Property Subscription Distribution Channel Service
// Manages the complete flow from subscription to disbursement
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionDistributionChannelService = void 0;
const ethers_1 = require("ethers");
const subscriptionService_1 = require("./subscriptionService");
const database_1 = require("../utils/database");
const ethersProvider_1 = require("../utils/ethersProvider");
/**
 * Complete subscription and distribution channel management
 * Handles the entire flow from subscription creation to disbursement execution
 */
class SubscriptionDistributionChannelService {
    constructor(db) {
        this.subscriptionService = new subscriptionService_1.SubscriptionService(db);
        this.provider = (0, ethersProvider_1.getProvider)();
        this.signer = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    }
    /**
     * Initialize a distribution channel for a property
     * This sets up the initial structure for managing subscriptions and disbursements
     */
    async initializeDistributionChannel(config) {
        try {
            console.log(`Initializing distribution channel for property: ${config.propertyId}`);
            // Verify property exists
            const property = await (0, database_1.query)('SELECT id FROM properties WHERE id = ?', [config.propertyId]);
            if (!property || property.length === 0) {
                throw new Error(`Property ${config.propertyId} not found`);
            }
            // Verify token address is valid
            if (!ethers_1.ethers.isAddress(config.tokenAddress)) {
                throw new Error(`Invalid token address: ${config.tokenAddress}`);
            }
            console.log(`Distribution channel initialized for property: ${config.propertyId}`);
            // Additional setup can be added here (e.g., creating configuration records)
        }
        catch (error) {
            console.error('Failed to initialize distribution channel:', error);
            throw error;
        }
    }
    /**
     * Get channel statistics for a property
     */
    async getChannelStatistics(propertyId) {
        try {
            const totalSubscribers = await this.subscriptionService.getTotalSubscriberCount(propertyId);
            const totalSubscriptionAmount = await this.subscriptionService.getTotalSubscriptionAmount(propertyId);
            const activeSubscriptions = await this.subscriptionService.getActiveSubscriptionsByProperty(propertyId);
            const activeSubscribers = activeSubscriptions.length;
            const totalDisbursed = await this.subscriptionService.getTotalDisbursedByProperty(propertyId);
            const pendingDisbursements = await this.subscriptionService.getPendingDisbursementsByProperty(propertyId);
            return {
                totalSubscribers,
                totalSubscriptionAmount,
                activeSubscribers,
                totalDisbursed,
                pendingDisbursements: pendingDisbursements.length,
            };
        }
        catch (error) {
            console.error('Failed to get channel statistics:', error);
            throw error;
        }
    }
    /**
     * Create and process disbursements for all subscribers
     * Returns both created disbursements and execution results if autoExecute is true
     */
    async createAndProcessDisbursements(propertyId, distributionId, totalDisbursementAmount, currency, type, tokenAddress, autoExecute = false) {
        try {
            console.log(`Creating disbursements for property: ${propertyId}`);
            // Get active subscribers
            const subscribers = await this.subscriptionService.getActiveSubscriptionsByProperty(propertyId);
            if (subscribers.length === 0) {
                throw new Error(`No active subscribers found for property ${propertyId}`);
            }
            // Calculate total share percentage to distribute proportionally
            const totalSharePercentage = subscribers.reduce((sum, sub) => sum + sub.share_percentage, 0);
            // Create disbursements for each subscriber
            const disbursements = [];
            for (const subscriber of subscribers) {
                // Calculate proportional disbursement amount
                const proportionalAmount = ((parseFloat(totalDisbursementAmount) * subscriber.share_percentage) /
                    totalSharePercentage).toString();
                const disbursement = await this.subscriptionService.createDisbursement({
                    propertyId,
                    distributionId,
                    subscriberId: subscriber.id,
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
                executionResults = await this.subscriptionService.executeBatchDisbursements(disbursementIds, tokenAddress);
            }
            return {
                disbursements,
                executionResults,
            };
        }
        catch (error) {
            console.error('Failed to create and process disbursements:', error);
            throw error;
        }
    }
    /**
     * Execute all pending disbursements for a property
     */
    async executePendingDisbursements(propertyId, tokenAddress) {
        try {
            console.log(`Executing pending disbursements for property: ${propertyId}`);
            // Get pending disbursements
            const pendingDisbursements = await this.subscriptionService.getPendingDisbursementsByProperty(propertyId);
            if (pendingDisbursements.length === 0) {
                console.log('No pending disbursements found');
                return {
                    executed: 0,
                    failed: 0,
                    results: new Map(),
                };
            }
            const disbursementIds = pendingDisbursements.map((d) => d.id);
            const results = await this.subscriptionService.executeBatchDisbursements(disbursementIds, tokenAddress);
            const executed = Array.from(results.values()).filter((v) => v !== 'FAILED').length;
            const failed = Array.from(results.values()).filter((v) => v === 'FAILED').length;
            console.log(`Executed ${executed} disbursements, ${failed} failed`);
            return {
                executed,
                failed,
                results,
            };
        }
        catch (error) {
            console.error('Failed to execute pending disbursements:', error);
            throw error;
        }
    }
    /**
     * Get disbursement history for a property
     */
    async getDisbursementHistory(propertyId, limit = 100, offset = 0) {
        try {
            const disbursements = await this.subscriptionService.getDisbursementsByProperty(propertyId);
            return disbursements.slice(offset, offset + limit);
        }
        catch (error) {
            console.error('Failed to get disbursement history:', error);
            throw error;
        }
    }
    /**
     * Get subscriber details including their disbursement history
     */
    async getSubscriberDetails(subscriptionId) {
        try {
            const subscriptionData = await (0, database_1.query)('SELECT * FROM subscriptions WHERE id = ?', [subscriptionId]);
            if (!subscriptionData || subscriptionData.length === 0) {
                throw new Error(`Subscription ${subscriptionId} not found`);
            }
            const subscription = subscriptionData[0];
            // Get disbursement history
            const disbursements = await this.subscriptionService.getDisbursementsBySubscriber(subscriptionId);
            const totalDisbursed = await this.subscriptionService.getTotalDisbursedBySubscriber(subscriptionId);
            return {
                subscription,
                disbursements,
                totalDisbursed,
                disbursementCount: disbursements.length,
            };
        }
        catch (error) {
            console.error('Failed to get subscriber details:', error);
            throw error;
        }
    }
    /**
     * Get property overview including all subscribers and disbursements
     */
    async getPropertyOverview(propertyId) {
        try {
            const property = await (0, database_1.query)('SELECT * FROM properties WHERE id = ?', [propertyId]);
            if (!property || property.length === 0) {
                throw new Error(`Property ${propertyId} not found`);
            }
            const stats = await this.getChannelStatistics(propertyId);
            const subscribers = await this.subscriptionService.getActiveSubscriptionsByProperty(propertyId);
            const disbursements = await this.subscriptionService.getDisbursementsByProperty(propertyId);
            return {
                property: property[0],
                statistics: stats,
                subscribers,
                disbursements,
            };
        }
        catch (error) {
            console.error('Failed to get property overview:', error);
            throw error;
        }
    }
    /**
     * Validate disbursement amounts before execution
     */
    async validateDisbursements(disbursementIds, totalAvailableFunds) {
        try {
            const issues = [];
            let totalRequired = '0';
            for (const disbursementId of disbursementIds) {
                const disbursementData = await (0, database_1.query)('SELECT disbursement_amount FROM disbursements WHERE id = ?', [disbursementId]);
                if (!disbursementData || disbursementData.length === 0) {
                    issues.push(`Disbursement ${disbursementId} not found`);
                    continue;
                }
                totalRequired = (parseFloat(totalRequired) + parseFloat(disbursementData[0].disbursement_amount)).toString();
            }
            const totalRequiredNum = parseFloat(totalRequired);
            const availableFundsNum = parseFloat(totalAvailableFunds);
            if (totalRequiredNum > availableFundsNum) {
                issues.push(`Insufficient funds: required ${totalRequired}, available ${totalAvailableFunds}`);
            }
            return {
                valid: issues.length === 0,
                totalRequired,
                availableFunds: totalAvailableFunds,
                issues,
            };
        }
        catch (error) {
            console.error('Failed to validate disbursements:', error);
            throw error;
        }
    }
    /**
     * Generate a detailed report of all activities for a property
     */
    async generatePropertyReport(propertyId) {
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
        }
        catch (error) {
            console.error('Failed to generate property report:', error);
            throw error;
        }
    }
    /**
     * Helper method to calculate subscription breakdown
     */
    calculateSubscriptionBreakdown(subscribers) {
        const breakdown = {
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
            breakdown.by_currency[subscriber.currency].total_amount = (parseFloat(breakdown.by_currency[subscriber.currency].total_amount) +
                parseFloat(subscriber.subscription_amount)).toString();
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
    calculateDisbursementBreakdown(disbursements) {
        const breakdown = {
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
            breakdown.by_type[disbursement.type].total_amount = (parseFloat(breakdown.by_type[disbursement.type].total_amount) +
                parseFloat(disbursement.disbursement_amount)).toString();
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
            breakdown.by_currency[disbursement.currency].total_amount = (parseFloat(breakdown.by_currency[disbursement.currency].total_amount) +
                parseFloat(disbursement.disbursement_amount)).toString();
        }
        return breakdown;
    }
}
exports.SubscriptionDistributionChannelService = SubscriptionDistributionChannelService;
//# sourceMappingURL=subscriptionDistributionChannelService.js.map