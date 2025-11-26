"use strict";
// Property Subscription Service
// Manages subscription flow, verification, and subscriber management
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const ethers_1 = require("ethers");
const uuid_1 = require("uuid");
const subscriptionModel_1 = require("../models/subscriptionModel");
const ethersProvider_1 = require("../utils/ethersProvider");
const database_1 = require("../utils/database");
const walletService_1 = require("./walletService");
class SubscriptionService {
    constructor(db) {
        this.db = db;
        this.provider = (0, ethersProvider_1.getProvider)();
        this.signer = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.walletService = new walletService_1.WalletService(db);
    }
    /**
     * Create a new property subscription
     */
    async createSubscription(request) {
        try {
            // Validate property exists
            const propertyResult = await (0, database_1.query)('SELECT id, user_id, supply FROM properties WHERE id = ?', [request.propertyId]);
            if (!propertyResult || propertyResult.length === 0) {
                throw new Error(`Property ${request.propertyId} not found`);
            }
            const property = propertyResult[0];
            // Calculate share percentage
            const totalSupply = property.supply || 1;
            const subscriptionAmountNum = parseFloat(request.subscriptionAmount);
            const sharePercentage = (subscriptionAmountNum / totalSupply) * 100;
            // Create subscription
            const subscriptionId = (0, uuid_1.v4)();
            const subscription = {
                id: subscriptionId,
                property_id: request.propertyId,
                subscriber_user_id: request.subscriberUserId,
                subscriber_wallet_address: request.subscriberWalletAddress,
                subscription_amount: request.subscriptionAmount,
                subscription_date: new Date(),
                status: 'ACTIVE',
                share_percentage: sharePercentage,
                currency: request.currency,
                transaction_hash: request.transactionHash,
                kyc_verified: false,
                created_at: new Date(),
                updated_at: new Date(),
            };
            await (0, database_1.query)(subscriptionModel_1.subscriptionQueries.insert, [
                subscription.id,
                subscription.property_id,
                subscription.subscriber_user_id,
                subscription.subscriber_wallet_address,
                subscription.subscription_amount,
                subscription.subscription_date,
                subscription.status,
                subscription.share_percentage,
                subscription.currency,
                subscription.transaction_hash,
                subscription.kyc_verified,
            ]);
            return subscription;
        }
        catch (error) {
            console.error('Failed to create subscription:', error);
            throw error;
        }
    }
    /**
     * Get all subscriptions for a property
     */
    async getSubscriptionsByProperty(propertyId) {
        try {
            const subscriptions = await (0, database_1.query)(subscriptionModel_1.subscriptionQueries.findByPropertyId, [propertyId]);
            return subscriptions;
        }
        catch (error) {
            console.error('Failed to fetch subscriptions by property:', error);
            throw error;
        }
    }
    /**
     * Get active subscriptions for a property
     */
    async getActiveSubscriptionsByProperty(propertyId) {
        try {
            const subscriptions = await (0, database_1.query)(subscriptionModel_1.subscriptionQueries.findActiveSubscriptionsByProperty, [
                propertyId,
            ]);
            return subscriptions;
        }
        catch (error) {
            console.error('Failed to fetch active subscriptions:', error);
            throw error;
        }
    }
    /**
     * Get subscriptions for a subscriber user
     */
    async getSubscriptionsBySubscriber(subscriberUserId) {
        try {
            const subscriptions = await (0, database_1.query)(subscriptionModel_1.subscriptionQueries.findBySubscriberUserId, [
                subscriberUserId,
            ]);
            return subscriptions;
        }
        catch (error) {
            console.error('Failed to fetch subscriptions by subscriber:', error);
            throw error;
        }
    }
    /**
     * Get subscriptions by wallet address
     */
    async getSubscriptionsByWallet(walletAddress) {
        try {
            const subscriptions = await (0, database_1.query)(subscriptionModel_1.subscriptionQueries.findBySubscriberWallet, [
                walletAddress,
            ]);
            return subscriptions;
        }
        catch (error) {
            console.error('Failed to fetch subscriptions by wallet:', error);
            throw error;
        }
    }
    /**
     * Cancel a subscription
     */
    async cancelSubscription(subscriptionId) {
        try {
            await (0, database_1.query)(subscriptionModel_1.subscriptionQueries.updateStatus, ['CANCELLED', subscriptionId]);
        }
        catch (error) {
            console.error('Failed to cancel subscription:', error);
            throw error;
        }
    }
    /**
     * Verify KYC for a subscription
     */
    async verifySubscriptionKYC(subscriptionId, verified) {
        try {
            await (0, database_1.query)(subscriptionModel_1.subscriptionQueries.updateKycStatus, [verified, subscriptionId]);
        }
        catch (error) {
            console.error('Failed to update KYC status:', error);
            throw error;
        }
    }
    /**
     * Get total number of subscribers for a property
     */
    async getTotalSubscriberCount(propertyId) {
        try {
            const result = await (0, database_1.query)(subscriptionModel_1.subscriptionQueries.findTotalSubscribersByProperty, [
                propertyId,
            ]);
            return result[0]?.total_subscribers || 0;
        }
        catch (error) {
            console.error('Failed to fetch total subscriber count:', error);
            throw error;
        }
    }
    /**
     * Get total subscription amount for a property
     */
    async getTotalSubscriptionAmount(propertyId) {
        try {
            const result = await (0, database_1.query)(subscriptionModel_1.subscriptionQueries.findTotalSubscriptionAmount, [propertyId]);
            return result[0]?.total_amount || '0';
        }
        catch (error) {
            console.error('Failed to fetch total subscription amount:', error);
            throw error;
        }
    }
    /**
     * Create a disbursement record for subscribers
     */
    async createDisbursement(request) {
        try {
            const disbursementId = (0, uuid_1.v4)();
            const disbursement = {
                id: disbursementId,
                property_id: request.propertyId,
                distribution_id: request.distributionId,
                subscriber_id: request.subscriberId,
                subscriber_wallet_address: '',
                disbursement_amount: request.disbursementAmount,
                disbursement_date: new Date(),
                currency: request.currency,
                type: request.type,
                status: 'PENDING',
                created_at: new Date(),
                updated_at: new Date(),
            };
            // Get subscriber wallet address
            const subscriberResult = await (0, database_1.query)(subscriptionModel_1.subscriptionQueries.findById, [request.subscriberId]);
            if (subscriberResult && subscriberResult.length > 0) {
                disbursement.subscriber_wallet_address = subscriberResult[0].subscriber_wallet_address;
            }
            await (0, database_1.query)(subscriptionModel_1.disbursementQueries.insert, [
                disbursement.id,
                disbursement.property_id,
                disbursement.distribution_id,
                disbursement.subscriber_id,
                disbursement.subscriber_wallet_address,
                disbursement.disbursement_amount,
                disbursement.disbursement_date,
                disbursement.currency,
                disbursement.type,
                disbursement.status,
            ]);
            return disbursement;
        }
        catch (error) {
            console.error('Failed to create disbursement:', error);
            throw error;
        }
    }
    /**
     * Create multiple disbursements for all subscribers of a property
     */
    async createDisbursementsForAllSubscribers(propertyId, distributionId, disbursementAmountPerSubscriber, currency, type) {
        try {
            const activeSubscriptions = await this.getActiveSubscriptionsByProperty(propertyId);
            const disbursements = [];
            for (const subscription of activeSubscriptions) {
                const disbursement = await this.createDisbursement({
                    propertyId,
                    distributionId,
                    subscriberId: subscription.id,
                    disbursementAmount: disbursementAmountPerSubscriber,
                    currency,
                    type,
                });
                disbursements.push(disbursement);
            }
            return disbursements;
        }
        catch (error) {
            console.error('Failed to create disbursements for all subscribers:', error);
            throw error;
        }
    }
    /**
     * Get all disbursements for a property
     */
    async getDisbursementsByProperty(propertyId) {
        try {
            const disbursements = await (0, database_1.query)(subscriptionModel_1.disbursementQueries.findByPropertyId, [propertyId]);
            return disbursements;
        }
        catch (error) {
            console.error('Failed to fetch disbursements by property:', error);
            throw error;
        }
    }
    /**
     * Get disbursements by distribution
     */
    async getDisbursementsByDistribution(distributionId) {
        try {
            const disbursements = await (0, database_1.query)(subscriptionModel_1.disbursementQueries.findByDistributionId, [
                distributionId,
            ]);
            return disbursements;
        }
        catch (error) {
            console.error('Failed to fetch disbursements by distribution:', error);
            throw error;
        }
    }
    /**
     * Get disbursements for a subscriber
     */
    async getDisbursementsBySubscriber(subscriberId) {
        try {
            const disbursements = await (0, database_1.query)(subscriptionModel_1.disbursementQueries.findBySubscriberId, [subscriberId]);
            return disbursements;
        }
        catch (error) {
            console.error('Failed to fetch disbursements by subscriber:', error);
            throw error;
        }
    }
    /**
     * Get disbursements by wallet address
     */
    async getDisbursementsByWallet(walletAddress) {
        try {
            const disbursements = await (0, database_1.query)(subscriptionModel_1.disbursementQueries.findBySubscriberWallet, [
                walletAddress,
            ]);
            return disbursements;
        }
        catch (error) {
            console.error('Failed to fetch disbursements by wallet:', error);
            throw error;
        }
    }
    /**
     * Get pending disbursements
     */
    async getPendingDisbursements() {
        try {
            const disbursements = await (0, database_1.query)(subscriptionModel_1.disbursementQueries.findPendingDisbursements, []);
            return disbursements;
        }
        catch (error) {
            console.error('Failed to fetch pending disbursements:', error);
            throw error;
        }
    }
    /**
     * Get pending disbursements for a property
     */
    async getPendingDisbursementsByProperty(propertyId) {
        try {
            const disbursements = await (0, database_1.query)(subscriptionModel_1.disbursementQueries.findPendingByProperty, [propertyId]);
            return disbursements;
        }
        catch (error) {
            console.error('Failed to fetch pending disbursements by property:', error);
            throw error;
        }
    }
    /**
     * Execute a disbursement on blockchain and credit in-app wallet
     */
    async executeDisbursement(disbursementId, tokenAddress, senderAddress) {
        const connection = await this.db.getConnection();
        try {
            await connection.beginTransaction();
            // Get disbursement details
            const disbursementResult = await (0, database_1.query)(subscriptionModel_1.disbursementQueries.findById, [disbursementId]);
            if (!disbursementResult || disbursementResult.length === 0) {
                throw new Error(`Disbursement ${disbursementId} not found`);
            }
            const disbursement = disbursementResult[0];
            // Create token contract instance
            const tokenContract = new ethers_1.ethers.Contract(tokenAddress, [
                'function transfer(address to, uint256 amount) external returns (bool)',
                'function decimals() public view returns (uint8)',
            ], this.signer);
            // Get token decimals
            const decimals = await tokenContract.decimals();
            // Parse the amount
            const parsedAmount = ethers_1.ethers.parseUnits(disbursement.disbursement_amount, decimals);
            // Execute transfer
            const tx = await tokenContract.transfer(disbursement.subscriber_wallet_address, parsedAmount);
            const receipt = await tx.wait();
            if (!receipt) {
                throw new Error('Transaction failed to execute');
            }
            // Update disbursement status
            await (0, database_1.query)(subscriptionModel_1.disbursementQueries.updateStatus, [
                'EXECUTED',
                receipt.hash,
                disbursementId,
            ]);
            // Credit the in-app wallet of the subscriber
            const disbursementAmount = parseFloat(disbursement.disbursement_amount);
            try {
                await this.walletService.disburseROI(disbursement.subscriber_user_id || '', disbursementAmount, disbursement.subscription_id || '', 0 // ROI percentage (can be calculated if needed)
                );
                console.log(`In-app wallet credited for user ${disbursement.subscriber_user_id}: ${disbursementAmount} USDC`);
            }
            catch (walletError) {
                console.warn(`Failed to credit in-app wallet: ${walletError}. Continuing with blockchain transaction.`);
            }
            await connection.commit();
            console.log(`Disbursement executed: ${receipt.hash}`);
            return receipt.hash;
        }
        catch (error) {
            await connection.rollback();
            console.error('Failed to execute disbursement:', error);
            // Mark as failed
            await (0, database_1.query)(subscriptionModel_1.disbursementQueries.updateStatus, ['FAILED', null, disbursementId]);
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Execute multiple disbursements in batch
     */
    async executeBatchDisbursements(disbursementIds, tokenAddress) {
        const results = new Map();
        for (const disbursementId of disbursementIds) {
            try {
                const txHash = await this.executeDisbursement(disbursementId, tokenAddress, '');
                results.set(disbursementId, txHash);
            }
            catch (error) {
                console.error(`Failed to execute disbursement ${disbursementId}:`, error);
                results.set(disbursementId, 'FAILED');
            }
        }
        return results;
    }
    /**
     * Get total disbursed amount for a subscriber
     */
    async getTotalDisbursedBySubscriber(subscriberId) {
        try {
            const result = await (0, database_1.query)(subscriptionModel_1.disbursementQueries.findTotalDisbursedBySubscriber, [
                subscriberId,
            ]);
            return result[0]?.total_disbursed || '0';
        }
        catch (error) {
            console.error('Failed to fetch total disbursed by subscriber:', error);
            throw error;
        }
    }
    /**
     * Get total disbursed amount for a property
     */
    async getTotalDisbursedByProperty(propertyId) {
        try {
            const result = await (0, database_1.query)(subscriptionModel_1.disbursementQueries.findTotalDisbursedByProperty, [propertyId]);
            return result[0]?.total_disbursed || '0';
        }
        catch (error) {
            console.error('Failed to fetch total disbursed by property:', error);
            throw error;
        }
    }
    /**
     * Get disbursements within a date range
     */
    async getDisbursementsByDateRange(propertyId, startDate, endDate) {
        try {
            const disbursements = await (0, database_1.query)(subscriptionModel_1.disbursementQueries.findDisbursementsByDateRange, [
                propertyId,
                startDate,
                endDate,
            ]);
            return disbursements;
        }
        catch (error) {
            console.error('Failed to fetch disbursements by date range:', error);
            throw error;
        }
    }
}
exports.SubscriptionService = SubscriptionService;
//# sourceMappingURL=subscriptionService.js.map