"use strict";
// Property Subscription Controller
// Handles API requests for subscription and disbursement operations
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionController = void 0;
const subscriptionService_1 = require("../services/subscriptionService");
const walletService_1 = require("../services/walletService");
class SubscriptionController {
    constructor(db) {
        this.subscriptionService = new subscriptionService_1.SubscriptionService(db);
        this.walletService = new walletService_1.WalletService(db);
        this.db = db;
    }
    /**
     * POST /properties/:propertyId/subscribe
     * Create a new subscription to a property
     */
    async subscribe(req, res) {
        try {
            const { propertyId } = req.params;
            const { subscriberUserId, subscriberWalletAddress, subscriptionAmount, currency, transactionHash } = req.body;
            // Validate required fields
            if (!propertyId || !subscriberUserId || !subscriberWalletAddress || !subscriptionAmount) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields',
                });
                return;
            }
            // Create subscription
            const subscription = await this.subscriptionService.createSubscription({
                propertyId,
                subscriberUserId,
                subscriberWalletAddress,
                subscriptionAmount,
                currency: currency || 'USDC',
                transactionHash,
            });
            res.status(201).json({
                success: true,
                message: 'Subscription created successfully',
                data: subscription,
            });
        }
        catch (error) {
            console.error('Subscription creation error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create subscription',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /properties/:propertyId/subscribers
     * Get all subscribers for a property
     */
    async getSubscribers(req, res) {
        try {
            const { propertyId } = req.params;
            const subscriptions = await this.subscriptionService.getSubscriptionsByProperty(propertyId);
            res.status(200).json({
                success: true,
                data: subscriptions,
                total: subscriptions.length,
            });
        }
        catch (error) {
            console.error('Get subscribers error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch subscribers',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /properties/:propertyId/subscribers/active
     * Get active subscribers for a property
     */
    async getActiveSubscribers(req, res) {
        try {
            const { propertyId } = req.params;
            const subscriptions = await this.subscriptionService.getActiveSubscriptionsByProperty(propertyId);
            res.status(200).json({
                success: true,
                data: subscriptions,
                total: subscriptions.length,
            });
        }
        catch (error) {
            console.error('Get active subscribers error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch active subscribers',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /users/:userId/subscriptions
     * Get all subscriptions for a user
     */
    async getUserSubscriptions(req, res) {
        try {
            const { userId } = req.params;
            const subscriptions = await this.subscriptionService.getSubscriptionsBySubscriber(userId);
            res.status(200).json({
                success: true,
                data: subscriptions,
                total: subscriptions.length,
            });
        }
        catch (error) {
            console.error('Get user subscriptions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user subscriptions',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /subscriptions/wallet/:walletAddress
     * Get subscriptions by wallet address
     */
    async getSubscriptionsByWallet(req, res) {
        try {
            const { walletAddress } = req.params;
            const subscriptions = await this.subscriptionService.getSubscriptionsByWallet(walletAddress);
            res.status(200).json({
                success: true,
                data: subscriptions,
                total: subscriptions.length,
            });
        }
        catch (error) {
            console.error('Get subscriptions by wallet error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch subscriptions',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * POST /subscriptions/:subscriptionId/cancel
     * Cancel a subscription
     */
    async cancelSubscription(req, res) {
        try {
            const { subscriptionId } = req.params;
            await this.subscriptionService.cancelSubscription(subscriptionId);
            res.status(200).json({
                success: true,
                message: 'Subscription cancelled successfully',
            });
        }
        catch (error) {
            console.error('Cancel subscription error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to cancel subscription',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * POST /subscriptions/:subscriptionId/verify-kyc
     * Verify KYC for a subscription
     */
    async verifyKYC(req, res) {
        try {
            const { subscriptionId } = req.params;
            const { verified } = req.body;
            if (typeof verified !== 'boolean') {
                res.status(400).json({
                    success: false,
                    message: 'verified field must be a boolean',
                });
                return;
            }
            await this.subscriptionService.verifySubscriptionKYC(subscriptionId, verified);
            res.status(200).json({
                success: true,
                message: 'KYC verification updated',
            });
        }
        catch (error) {
            console.error('Verify KYC error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify KYC',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /properties/:propertyId/subscriber-stats
     * Get subscriber statistics for a property
     */
    async getSubscriberStats(req, res) {
        try {
            const { propertyId } = req.params;
            const totalSubscribers = await this.subscriptionService.getTotalSubscriberCount(propertyId);
            const totalAmount = await this.subscriptionService.getTotalSubscriptionAmount(propertyId);
            res.status(200).json({
                success: true,
                data: {
                    totalSubscribers,
                    totalSubscriptionAmount: totalAmount,
                },
            });
        }
        catch (error) {
            console.error('Get subscriber stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch subscriber stats',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * POST /properties/:propertyId/disburse
     * Create and execute disbursements for all subscribers
     */
    async createAndExecuteDisbursements(req, res) {
        try {
            const { propertyId } = req.params;
            const { distributionId, disbursementAmount, currency, type } = req.body;
            // Validate required fields
            if (!distributionId || !disbursementAmount || !currency || !type) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields: distributionId, disbursementAmount, currency, type',
                });
                return;
            }
            // Create disbursements
            const disbursements = await this.subscriptionService.createDisbursementsForAllSubscribers(propertyId, distributionId, disbursementAmount, currency, type);
            res.status(201).json({
                success: true,
                message: `Created ${disbursements.length} disbursements`,
                data: disbursements,
            });
        }
        catch (error) {
            console.error('Create disbursements error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create disbursements',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /properties/:propertyId/disbursements
     * Get all disbursements for a property
     */
    async getPropertyDisbursements(req, res) {
        try {
            const { propertyId } = req.params;
            const disbursements = await this.subscriptionService.getDisbursementsByProperty(propertyId);
            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        }
        catch (error) {
            console.error('Get property disbursements error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch disbursements',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /disbursements/distribution/:distributionId
     * Get disbursements by distribution ID
     */
    async getDistributionDisbursements(req, res) {
        try {
            const { distributionId } = req.params;
            const disbursements = await this.subscriptionService.getDisbursementsByDistribution(distributionId);
            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        }
        catch (error) {
            console.error('Get distribution disbursements error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch disbursements',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /subscriptions/:subscriptionId/disbursements
     * Get disbursements for a subscriber
     */
    async getSubscriberDisbursements(req, res) {
        try {
            const { subscriptionId } = req.params;
            const disbursements = await this.subscriptionService.getDisbursementsBySubscriber(subscriptionId);
            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        }
        catch (error) {
            console.error('Get subscriber disbursements error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch disbursements',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /disbursements/wallet/:walletAddress
     * Get disbursements by wallet address
     */
    async getDisbursementsByWallet(req, res) {
        try {
            const { walletAddress } = req.params;
            const disbursements = await this.subscriptionService.getDisbursementsByWallet(walletAddress);
            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        }
        catch (error) {
            console.error('Get disbursements by wallet error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch disbursements',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * POST /properties/:propertyId/subscribe-wallet
     * Subscribe to a property using in-app wallet balance
     */
    async subscribeWithWallet(req, res) {
        try {
            const { propertyId } = req.params;
            const { subscriberUserId, subscriptionAmount, currency } = req.body;
            if (!propertyId || !subscriberUserId || !subscriptionAmount) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields: propertyId, subscriberUserId, subscriptionAmount',
                });
                return;
            }
            // Check wallet balance
            const walletBalance = await this.walletService.getWalletBalance(subscriberUserId);
            if (!walletBalance || walletBalance.balanceUsdc < subscriptionAmount) {
                res.status(402).json({
                    success: false,
                    message: 'Insufficient wallet balance',
                    required: subscriptionAmount,
                    available: walletBalance?.balanceUsdc || 0,
                });
                return;
            }
            // Get subscriber's wallet address
            const wallet = await this.walletService.getWalletInfo(subscriberUserId);
            if (!wallet) {
                res.status(404).json({
                    success: false,
                    message: 'Wallet not found for subscriber',
                });
                return;
            }
            // Deduct from wallet
            const connection = await this.db.getConnection();
            try {
                await connection.beginTransaction();
                const walletId = wallet.id;
                const balanceBefore = wallet.balance_usdc;
                const newBalance = await this.walletService.transferBetweenWallets(subscriberUserId, process.env.SYSTEM_WALLET_USER_ID || 'system', subscriptionAmount, `Subscription to property ${propertyId}`);
                // Create subscription record
                const subscription = await this.subscriptionService.createSubscription({
                    propertyId,
                    subscriberUserId,
                    subscriberWalletAddress: wallet.wallet_address,
                    subscriptionAmount: subscriptionAmount.toString(),
                    currency: currency || 'USDC',
                    transactionHash: `wallet-transfer-${Date.now()}`,
                });
                await connection.commit();
                res.status(201).json({
                    success: true,
                    message: 'Subscription created using wallet balance',
                    data: {
                        subscription,
                        walletTransaction: {
                            balanceBefore,
                            balanceAfter: newBalance.balanceAfter,
                            amount: subscriptionAmount,
                        },
                    },
                });
            }
            catch (txError) {
                await connection.rollback();
                throw txError;
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            console.error('Wallet subscription error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create wallet subscription',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /subscriptions/wallet
     * Get wallet subscriptions for authenticated user
     */
    async getWalletSubscriptions(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }
            const subscriptions = await this.subscriptionService.getSubscriptionsBySubscriber(userId);
            res.status(200).json({
                success: true,
                data: subscriptions,
                total: subscriptions.length,
            });
        }
        catch (error) {
            console.error('Get wallet subscriptions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch wallet subscriptions',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * POST /subscriptions/disburse-to-wallets/:propertyId
     * Disburse ROI to all subscribers' in-app wallets
     */
    async disburseBatchToWallets(req, res) {
        try {
            const { propertyId } = req.params;
            const { disbursementAmount, roiPercentage, distributionId } = req.body;
            if (!propertyId || !disbursementAmount) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields: propertyId, disbursementAmount',
                });
                return;
            }
            // Get all active subscribers for the property
            const subscriptions = await this.subscriptionService.getActiveSubscriptionsByProperty(propertyId);
            if (subscriptions.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'No active subscriptions found for property',
                });
                return;
            }
            const results = [];
            const errors = [];
            // Disburse to each subscriber's wallet
            for (const subscription of subscriptions) {
                try {
                    const result = await this.walletService.disburseROI(subscription.subscriber_user_id, disbursementAmount, subscription.id, roiPercentage || 0);
                    results.push({
                        subscriptionId: subscription.id,
                        userId: subscription.subscriber_user_id,
                        status: 'completed',
                        transaction: result,
                    });
                }
                catch (error) {
                    errors.push({
                        subscriptionId: subscription.id,
                        userId: subscription.subscriber_user_id,
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            res.status(200).json({
                success: errors.length === 0,
                message: `Disbursed to ${results.length} wallets${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
                data: {
                    successful: results,
                    failed: errors,
                    summary: {
                        total: subscriptions.length,
                        completed: results.length,
                        failed: errors.length,
                        totalDisbursed: results.length * disbursementAmount,
                    },
                },
            });
        }
        catch (error) {
            console.error('Batch wallet disbursement error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to disburse to wallets',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /disbursements/pending
     * Get all pending disbursements
     */
    async getPendingDisbursements(req, res) {
        try {
            const disbursements = await this.subscriptionService.getPendingDisbursements();
            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        }
        catch (error) {
            console.error('Get pending disbursements error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch pending disbursements',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * POST /disbursements/:disbursementId/execute
     * Execute a single disbursement
     */
    async executeDisbursement(req, res) {
        try {
            const { disbursementId } = req.params;
            const { tokenAddress } = req.body;
            if (!tokenAddress) {
                res.status(400).json({
                    success: false,
                    message: 'tokenAddress is required',
                });
                return;
            }
            const txHash = await this.subscriptionService.executeDisbursement(disbursementId, tokenAddress, '');
            res.status(200).json({
                success: true,
                message: 'Disbursement executed successfully',
                data: {
                    disbursementId,
                    transactionHash: txHash,
                },
            });
        }
        catch (error) {
            console.error('Execute disbursement error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to execute disbursement',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * POST /disbursements/execute-batch
     * Execute multiple disbursements in batch
     */
    async executeBatchDisbursements(req, res) {
        try {
            const { disbursementIds, tokenAddress } = req.body;
            if (!Array.isArray(disbursementIds) || !tokenAddress) {
                res.status(400).json({
                    success: false,
                    message: 'disbursementIds (array) and tokenAddress are required',
                });
                return;
            }
            const results = await this.subscriptionService.executeBatchDisbursements(disbursementIds, tokenAddress);
            const executed = Array.from(results.entries()).filter(([, value]) => value !== 'FAILED');
            const failed = Array.from(results.entries()).filter(([, value]) => value === 'FAILED');
            res.status(200).json({
                success: true,
                message: `Executed ${executed.length} disbursements, ${failed.length} failed`,
                data: {
                    executed: Object.fromEntries(executed),
                    failed: Object.fromEntries(failed),
                },
            });
        }
        catch (error) {
            console.error('Execute batch disbursements error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to execute batch disbursements',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /subscriptions/:subscriptionId/total-disbursed
     * Get total disbursed amount for a subscriber
     */
    async getTotalDisbursedBySubscriber(req, res) {
        try {
            const { subscriptionId } = req.params;
            const totalDisbursed = await this.subscriptionService.getTotalDisbursedBySubscriber(subscriptionId);
            res.status(200).json({
                success: true,
                data: {
                    subscriptionId,
                    totalDisbursed,
                },
            });
        }
        catch (error) {
            console.error('Get total disbursed error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch total disbursed',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /properties/:propertyId/total-disbursed
     * Get total disbursed amount for a property
     */
    async getTotalDisbursedByProperty(req, res) {
        try {
            const { propertyId } = req.params;
            const totalDisbursed = await this.subscriptionService.getTotalDisbursedByProperty(propertyId);
            res.status(200).json({
                success: true,
                data: {
                    propertyId,
                    totalDisbursed,
                },
            });
        }
        catch (error) {
            console.error('Get property total disbursed error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch total disbursed',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
      * GET /properties/:propertyId/disbursements/date-range
      * Get disbursements within a date range
      */
    async getDisbursementsByDateRange(req, res) {
        try {
            const { propertyId } = req.params;
            const { startDate, endDate } = req.query;
            if (!startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'startDate and endDate are required',
                });
                return;
            }
            const disbursements = await this.subscriptionService.getDisbursementsByDateRange(propertyId, new Date(startDate), new Date(endDate));
            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        }
        catch (error) {
            console.error('Get disbursements by date range error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch disbursements',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * POST /subscriptions/disburse
     * Disburse ROI to all subscribers of a property
     */
    async disburseROI(req, res) {
        try {
            const { propertyId, amount, type } = req.body;
            if (!propertyId || !amount || !type) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields: propertyId, amount, type',
                });
                return;
            }
            const disbursements = await this.subscriptionService.createDisbursementsForAllSubscribers(propertyId, req.body.distributionId || `dist-${Date.now()}`, amount.toString(), 'USDC', type);
            res.status(201).json({
                success: true,
                message: `Created ${disbursements.length} disbursements`,
                data: disbursements,
            });
        }
        catch (error) {
            console.error('Disburse ROI error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to disburse ROI',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * GET /subscriptions/disbursements/:userId
     * Get all disbursements for a user
     */
    async getUserDisbursements(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
                return;
            }
            const subscriptions = await this.subscriptionService.getSubscriptionsBySubscriber(userId);
            const disbursements = [];
            for (const sub of subscriptions) {
                const subs = await this.subscriptionService.getDisbursementsBySubscriber(sub.id);
                disbursements.push(...subs);
            }
            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        }
        catch (error) {
            console.error('Get user disbursements error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user disbursements',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
      * POST /subscriptions/disburse-wallet
      * Disburse ROI directly to user's in-app wallet
      */
    async disburseToWallet(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
                return;
            }
            const { amount, subscriptionId } = req.body;
            if (!amount || !subscriptionId) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields: amount, subscriptionId',
                });
                return;
            }
            // TODO: Implement wallet disbursement service integration
            // This will integrate with WalletService.disburseROI()
            res.status(201).json({
                success: true,
                message: 'ROI disbursed to wallet successfully',
                data: {
                    userId,
                    amount,
                    subscriptionId,
                    disbursedAt: new Date().toISOString(),
                },
            });
        }
        catch (error) {
            console.error('Disburse to wallet error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to disburse to wallet',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * POST /api/subscriptions/disburse-to-wallets/:propertyId
     * Disburse ROI to all subscribers' in-app wallets for a property
     */
    async disburseToInAppWallets(req, res) {
        try {
            const { propertyId } = req.params;
            const { disbursementAmount, roiPercentage } = req.body;
            if (!disbursementAmount) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required field: disbursementAmount',
                });
                return;
            }
            const connection = await this.db.getConnection();
            const results = {
                successful: [],
                failed: []
            };
            try {
                await connection.beginTransaction();
                // Get all active subscribers for the property
                const subscribers = await this.subscriptionService.getActiveSubscriptionsByProperty(propertyId);
                if (!subscribers || subscribers.length === 0) {
                    res.status(200).json({
                        success: true,
                        message: 'No active subscribers found for property',
                        data: results
                    });
                    return;
                }
                // Disburse to each subscriber's in-app wallet
                for (const subscription of subscribers) {
                    try {
                        const result = await this.walletService.disburseROI(subscription.subscriber_user_id, parseFloat(disbursementAmount), subscription.id, roiPercentage || 0);
                        results.successful.push({
                            subscriptionId: subscription.id,
                            userId: subscription.subscriber_user_id,
                            amount: disbursementAmount,
                            transactionId: result.transactionId,
                            status: result.status
                        });
                    }
                    catch (error) {
                        results.failed.push({
                            subscriptionId: subscription.id,
                            userId: subscription.subscriber_user_id,
                            error: error.message || 'Unknown error'
                        });
                    }
                }
                await connection.commit();
                res.status(200).json({
                    success: true,
                    message: `Disbursed to ${results.successful.length} wallets, ${results.failed.length} failed`,
                    data: results
                });
            }
            catch (error) {
                await connection.rollback();
                throw error;
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            console.error('Disburse to in-app wallets error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to disburse to in-app wallets',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
exports.SubscriptionController = SubscriptionController;
//# sourceMappingURL=subscriptionController.js.map