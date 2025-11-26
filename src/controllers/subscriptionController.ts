// Property Subscription Controller
// Handles API requests for subscription, payment processing, disbursement operations
// Supports multiple payment gateways: Stripe, Eway, POLi, and Bank Transfers

import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import { SubscriptionService } from '../services/subscriptionService';
import { WalletService } from '../services/walletService';
import { ActivityLogService } from '../services/activityLogService';
import { PaymentGatewayService } from '../services/paymentGatewayService';

export class SubscriptionController {
    private subscriptionService: SubscriptionService;
    private walletService: WalletService;
    private activityLogService: ActivityLogService;
    private paymentGatewayService: PaymentGatewayService;
    private db: Pool;

    constructor(db: Pool) {
        this.subscriptionService = new SubscriptionService(db);
        this.walletService = new WalletService(db);
        this.activityLogService = new ActivityLogService(db);
        this.paymentGatewayService = new PaymentGatewayService(db);
        this.db = db;
    }

    /**
     * GET /properties/:propertyId/allotments
     * Get subscription allotments for a property
     */
    async getPropertyAllotments(req: Request, res: Response): Promise<void> {
        try {
            const { propertyId } = req.params;

            const allotments = await this.subscriptionService.getPropertyAllotments(propertyId);

            res.status(200).json({
                success: true,
                data: allotments,
            });
        } catch (error) {
            console.error('Get property allotments error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch property allotments',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * POST /properties/:propertyId/allotments/manage
     * Manage property subscription allotments (set limits)
     */
    async manageAllotments(req: Request, res: Response): Promise<void> {
        try {
            const { propertyId } = req.params;
            const { totalAllotment, pricePerShare, availableShares } = req.body;

            if (!propertyId || !totalAllotment || !pricePerShare) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields: totalAllotment, pricePerShare',
                });
                return;
            }

            const allotment = await this.subscriptionService.setPropertyAllotments({
                propertyId,
                totalAllotment: parseFloat(totalAllotment),
                pricePerShare: parseFloat(pricePerShare),
                availableShares: availableShares ? parseFloat(availableShares) : null,
            });

            res.status(200).json({
                success: true,
                message: 'Property allotments updated',
                data: allotment,
            });
        } catch (error) {
            console.error('Manage allotments error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to manage allotments',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * GET /properties/:propertyId/subscription-availability
     * Check available shares and remaining capacity for subscription
     */
    async checkSubscriptionAvailability(req: Request, res: Response): Promise<void> {
        try {
            const { propertyId } = req.params;
            const { requestedAmount } = req.query;

            const availability = await this.subscriptionService.checkAvailability(
                propertyId,
                requestedAmount ? parseFloat(requestedAmount as string) : undefined
            );

            res.status(200).json({
                success: true,
                data: availability,
            });
        } catch (error) {
            console.error('Check availability error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check availability',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * POST /properties/:propertyId/subscribe
     * Create a new subscription with payment method selection
     * Supports: Stripe, Eway, POLi, Bank Transfer, and In-App Wallet
     */
    async subscribe(req: Request, res: Response): Promise<void> {
        try {
            const propertyId = req.params.propertyId || req.body.property_id;

            const subscriberWalletAddress = req.body.subscriberWalletAddress || req.body.subscriber_address || req.body.wallet_address;
            const subscriptionAmount = req.body.subscriptionAmount || req.body.invested_amount || req.body.amount;
            const currency = req.body.currency || 'NZD';
            const paymentMethod = req.body.paymentMethod || 'STRIPE';
            const transactionHash = req.body.transactionHash || req.body.transaction_hash;

            let subscriberUserId = req.body.subscriberUserId || req.body.subscriber_id;

            if (!subscriberUserId && subscriberWalletAddress) {
                subscriberUserId = subscriberWalletAddress;
            }

            // Validate required fields
            if (!propertyId || !subscriberWalletAddress || !subscriptionAmount) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields: property_id, subscriber_address, invested_amount',
                    received: {
                        property_id: propertyId,
                        subscriber_address: subscriberWalletAddress,
                        invested_amount: subscriptionAmount,
                    }
                });
                return;
            }

            // Check availability before processing subscription
            const availability = await this.subscriptionService.checkAvailability(propertyId, subscriptionAmount);
            if (!availability.isAvailable) {
                res.status(400).json({
                    success: false,
                    message: `Cannot subscribe: ${availability.reason}`,
                    available: availability.availableAmount,
                    requested: subscriptionAmount,
                });
                return;
            }

            // Handle different payment methods
            let subscription;
            const connection = await this.db.getConnection();

            try {
                await connection.beginTransaction();

                switch (paymentMethod.toUpperCase()) {
                    case 'STRIPE':
                        subscription = await this.handleStripePayment(
                            propertyId,
                            subscriberUserId,
                            subscriberWalletAddress,
                            subscriptionAmount,
                            currency,
                            req.body.stripePaymentIntentId
                        );
                        break;

                    case 'EWAY':
                        subscription = await this.handleEwayPayment(
                            propertyId,
                            subscriberUserId,
                            subscriberWalletAddress,
                            subscriptionAmount,
                            currency,
                            req.body.ewayTokenCustomerID
                        );
                        break;

                    case 'POLI':
                        subscription = await this.handlePOLiPayment(
                            propertyId,
                            subscriberUserId,
                            subscriberWalletAddress,
                            subscriptionAmount,
                            currency,
                            req.body.poliTransactionToken
                        );
                        break;

                    case 'TRANSFER':
                        // Transfer doesn't require wallet connection
                        subscription = await this.handleTransferPayment(
                            propertyId,
                            subscriberUserId,
                            subscriberWalletAddress,
                            subscriptionAmount,
                            currency,
                            req.body.transferDetails
                        );
                        break;

                    case 'NZD':
                        // NZD direct payment - could integrate with local gateway
                        subscription = await this.handleNZDPayment(
                            propertyId,
                            subscriberUserId,
                            subscriberWalletAddress,
                            subscriptionAmount,
                            req.body.nzdPaymentMethodId
                        );
                        break;

                    case 'WALLET':
                        subscription = await this.handleWalletPayment(
                            propertyId,
                            subscriberUserId,
                            subscriberWalletAddress,
                            subscriptionAmount,
                            currency
                        );
                        break;

                    default:
                        throw new Error(`Unsupported payment method: ${paymentMethod}`);
                }

                // Log the activity
                try {
                    await this.activityLogService.logSubscription(
                        subscriberWalletAddress,
                        propertyId,
                        subscription.id,
                        subscriptionAmount.toString(),
                        currency,
                        subscriberUserId
                    );
                } catch (logError) {
                    console.error('Failed to log subscription activity:', logError);
                }

                await connection.commit();

                res.status(201).json({
                    success: true,
                    message: 'Subscription created successfully',
                    data: subscription,
                    paymentDetails: {
                        method: paymentMethod,
                        currency,
                        amount: subscriptionAmount,
                    }
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Subscription creation error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create subscription',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Handle Stripe payment processing
     */
    private async handleStripePayment(
        propertyId: string,
        subscriberUserId: string,
        subscriberWalletAddress: string,
        amount: number,
        currency: string,
        paymentIntentId?: string
    ) {
        const result = await this.paymentGatewayService.processStripePayment({
            propertyId,
            subscriberUserId,
            amount,
            currency,
            paymentIntentId,
        });

        return await this.subscriptionService.createSubscription({
            propertyId,
            subscriberUserId,
            subscriberWalletAddress,
            subscriptionAmount: amount,
            currency: currency || 'AUD',
            transactionHash: result.transactionId,
            paymentMethod: 'STRIPE',
            paymentStatus: result.status,
        });
    }

    /**
     * Handle Eway payment processing
     */
    private async handleEwayPayment(
        propertyId: string,
        subscriberUserId: string,
        subscriberWalletAddress: string,
        amount: number,
        currency: string,
        tokenCustomerID?: string
    ) {
        const result = await this.paymentGatewayService.processEwayPayment({
            propertyId,
            subscriberUserId,
            amount,
            currency,
            tokenCustomerID,
        });

        return await this.subscriptionService.createSubscription({
            propertyId,
            subscriberUserId,
            subscriberWalletAddress,
            subscriptionAmount: amount,
            currency: currency || 'AUD',
            transactionHash: result.transactionId,
            paymentMethod: 'EWAY',
            paymentStatus: result.status,
        });
    }

    /**
     * Handle POLi payment processing
     */
    private async handlePOLiPayment(
        propertyId: string,
        subscriberUserId: string,
        subscriberWalletAddress: string,
        amount: number,
        currency: string,
        transactionToken?: string
    ) {
        const result = await this.paymentGatewayService.processPOLiPayment({
            propertyId,
            subscriberUserId,
            amount,
            currency,
            transactionToken,
        });

        return await this.subscriptionService.createSubscription({
            propertyId,
            subscriberUserId,
            subscriberWalletAddress,
            subscriptionAmount: amount,
            currency: currency || 'AUD',
            transactionHash: result.transactionId,
            paymentMethod: 'POLI',
            paymentStatus: result.status,
        });
    }

    /**
     * Handle bank transfer payment
     * Doesn't require external wallet connection
     */
    private async handleTransferPayment(
        propertyId: string,
        subscriberUserId: string,
        subscriberWalletAddress: string,
        amount: number,
        currency: string,
        transferDetails?: any
    ) {
        // Get company's bank account details for transfer
        const accountDetails = await this.subscriptionService.getTransferAccountDetails(propertyId);

        if (!accountDetails) {
            throw new Error('Transfer account not configured for this property');
        }

        // Create pending transfer subscription
        const subscription = await this.subscriptionService.createSubscription({
            propertyId,
            subscriberUserId,
            subscriberWalletAddress,
            subscriptionAmount: amount,
            currency: currency || 'NZD',
            transactionHash: `transfer-pending-${Date.now()}`,
            paymentMethod: 'TRANSFER',
            paymentStatus: 'PENDING',
            transferDetails: transferDetails || {},
        });

        // Log transfer for reconciliation
        await this.paymentGatewayService.logPendingTransfer({
            subscriptionId: subscription.id,
            amount,
            currency,
            accountDetails,
            subscriber: { userId: subscriberUserId, address: subscriberWalletAddress },
        });

        return subscription;
    }

    /**
     * Handle NZD direct payment
     * NZD payments can be processed through local payment providers
     */
    private async handleNZDPayment(
        propertyId: string,
        subscriberUserId: string,
        subscriberWalletAddress: string,
        amount: number,
        paymentMethodId?: string
    ) {
        // NZD payments can be processed through:
        // 1. Local NZ payment providers (e.g., Paymark)
        // 2. Direct bank transfer (via POLi or similar)
        // 3. Stripe's NZD support (requires NZ bank account)

        const result = await this.paymentGatewayService.processNZDPayment({
            subscriberUserId,
            amount,
            paymentMethodId,
        });

        return await this.subscriptionService.createSubscription({
            propertyId,
            subscriberUserId,
            subscriberWalletAddress,
            subscriptionAmount: amount,
            currency: 'NZD',
            transactionHash: result.transactionId,
            paymentMethod: 'NZD',
            paymentStatus: result.status,
        });
    }

    /**
     * Handle in-app wallet payment
     */
    private async handleWalletPayment(
        propertyId: string,
        subscriberUserId: string,
        subscriberWalletAddress: string,
        amount: number,
        currency: string
    ) {
        // Check wallet balance
        const walletBalance = await this.walletService.getWalletBalance(subscriberUserId);
        if (!walletBalance || walletBalance.balanceUsdc < amount) {
            throw new Error(`Insufficient wallet balance. Required: ${amount}, Available: ${walletBalance?.balanceUsdc || 0}`);
        }

        // Get subscriber's wallet
        const wallet = await this.walletService.getWalletInfo(subscriberUserId);
        if (!wallet) {
            throw new Error('Wallet not found for subscriber');
        }

        // Transfer from wallet
        await this.walletService.transferBetweenWallets(
            subscriberUserId,
            process.env.SYSTEM_WALLET_USER_ID || 'system',
            amount,
            `Subscription to property ${propertyId}`
        );

        return await this.subscriptionService.createSubscription({
            propertyId,
            subscriberUserId,
            subscriberWalletAddress: wallet.wallet_address,
            subscriptionAmount: amount,
            currency: currency || 'USDC',
            transactionHash: `wallet-transfer-${Date.now()}`,
            paymentMethod: 'WALLET',
            paymentStatus: 'COMPLETED',
        });
    }

    /**
     * GET /properties/:propertyId/transfer-account
     * Get transfer account details for a property (for users choosing bank transfer)
     */
    async getTransferAccountDetails(req: Request, res: Response): Promise<void> {
        try {
            const { propertyId } = req.params;

            const accountDetails = await this.subscriptionService.getTransferAccountDetails(propertyId);

            if (!accountDetails) {
                res.status(404).json({
                    success: false,
                    message: 'No transfer account configured for this property',
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: {
                    accountHolder: accountDetails.accountHolder,
                    bankName: accountDetails.bankName,
                    accountNumber: accountDetails.accountNumber,
                    routingNumber: accountDetails.routingNumber,
                    swiftCode: accountDetails.swiftCode,
                    iban: accountDetails.iban,
                    reference: accountDetails.reference,
                    currency: accountDetails.currency,
                    // Don't expose full account details in response, keep secure
                    displayName: `${accountDetails.bankName} - ${accountDetails.accountNumber.slice(-4)}`,
                },
            });
        } catch (error) {
            console.error('Get transfer account error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch transfer account details',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * POST /properties/:propertyId/transfer-account/setup
     * Configure transfer account for a property
     */
    async setupTransferAccount(req: Request, res: Response): Promise<void> {
        try {
            const { propertyId } = req.params;
            const { accountHolder, bankName, accountNumber, routingNumber, swiftCode, iban, currency } = req.body;

            if (!propertyId || !accountHolder || !bankName || !accountNumber) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields: accountHolder, bankName, accountNumber',
                });
                return;
            }

            const accountDetails = await this.subscriptionService.setupTransferAccount({
                propertyId,
                accountHolder,
                bankName,
                accountNumber,
                routingNumber,
                swiftCode,
                iban,
                currency: currency || 'NZD',
                reference: `PROP-${propertyId}-${Date.now()}`,
            });

            res.status(201).json({
                success: true,
                message: 'Transfer account configured successfully',
                data: accountDetails,
            });
        } catch (error) {
            console.error('Setup transfer account error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to setup transfer account',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * GET /properties/:propertyId/subscribers
     * Get all subscribers for a property
     */
    async getSubscribers(req: Request, res: Response): Promise<void> {
        try {
            const { propertyId } = req.params;

            const subscriptions = await this.subscriptionService.getSubscriptionsByProperty(propertyId);

            res.status(200).json({
                success: true,
                data: subscriptions,
                total: subscriptions.length,
            });
        } catch (error) {
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
    async getActiveSubscribers(req: Request, res: Response): Promise<void> {
        try {
            const { propertyId } = req.params;

            const subscriptions = await this.subscriptionService.getActiveSubscriptionsByProperty(
                propertyId
            );

            res.status(200).json({
                success: true,
                data: subscriptions,
                total: subscriptions.length,
            });
        } catch (error) {
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
    async getUserSubscriptions(req: Request, res: Response): Promise<void> {
        try {
            // Support both :userId param and AuthRequest
            let userId = (req.params.userId) || (req as any).user?.id;

            if (!userId) {
                res.status(400).json({
                    success: false,
                    message: 'User ID is required',
                });
                return;
            }

            const subscriptions = await this.subscriptionService.getSubscriptionsBySubscriber(userId);

            res.status(200).json({
                success: true,
                data: subscriptions,
                total: subscriptions.length,
            });
        } catch (error) {
            console.error('Get user subscriptions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user subscriptions',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * GET /property/:propertyId/user
     * Get user's subscription to a specific property
     */
    async getUserSubscriptionForProperty(req: Request, res: Response): Promise<void> {
        try {
            const { propertyId } = req.params;
            const walletAddress = req.query.wallet as string || (req as any).user?.walletAddress;

            if (!propertyId || !walletAddress) {
                res.status(400).json({
                    success: false,
                    message: 'propertyId and wallet address are required',
                });
                return;
            }

            const subscription = await this.subscriptionService.getUserSubscriptionForProperty(
                propertyId,
                walletAddress
            );

            res.status(200).json({
                success: true,
                data: subscription,
            });
        } catch (error: any) {
            if (error.message?.includes('No subscription found')) {
                res.status(404).json({
                    success: false,
                    message: 'No subscription found for this property and wallet',
                });
                return;
            }
            console.error('Get user subscription for property error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch subscription',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * GET /property/:propertyId
     * Get all subscriptions for a property (alias for getSubscribers)
     */
    async getPropertySubscriptions(req: Request, res: Response): Promise<void> {
        return this.getSubscribers(req, res);
    }

    /**
     * GET /property/:propertyId/subscribers
     * Get all subscribers for a property (alias for getSubscribers)
     */
    async getPropertySubscribers(req: Request, res: Response): Promise<void> {
        return this.getSubscribers(req, res);
    }

    /**
     * GET /wallet
     * Get subscriptions for authenticated user's wallet
     */
    async getWalletSubscriptions(req: Request, res: Response): Promise<void> {
        try {
            const walletAddress = (req as any).user?.walletAddress;

            if (!walletAddress) {
                res.status(401).json({
                    success: false,
                    message: 'Wallet address not found in user context',
                });
                return;
            }

            const subscriptions = await this.subscriptionService.getSubscriptionsByWallet(walletAddress);

            res.status(200).json({
                success: true,
                data: subscriptions,
                total: subscriptions.length,
            });
        } catch (error) {
            console.error('Get wallet subscriptions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch wallet subscriptions',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * GET /subscriptions/wallet/:walletAddress
     * Get subscriptions by wallet address
     */
    async getSubscriptionsByWallet(req: Request, res: Response): Promise<void> {
        try {
            const { walletAddress } = req.params;

            const subscriptions = await this.subscriptionService.getSubscriptionsByWallet(walletAddress);

            res.status(200).json({
                success: true,
                data: subscriptions,
                total: subscriptions.length,
            });
        } catch (error) {
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
    async cancelSubscription(req: Request, res: Response): Promise<void> {
        try {
            const { subscriptionId } = req.params;

            await this.subscriptionService.cancelSubscription(subscriptionId);

            res.status(200).json({
                success: true,
                message: 'Subscription cancelled successfully',
            });
        } catch (error) {
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
    async verifyKYC(req: Request, res: Response): Promise<void> {
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
        } catch (error) {
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
    async getSubscriberStats(req: Request, res: Response): Promise<void> {
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
        } catch (error) {
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
    async createAndExecuteDisbursements(req: Request, res: Response): Promise<void> {
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
            const disbursements = await this.subscriptionService.createDisbursementsForAllSubscribers(
                propertyId,
                distributionId,
                disbursementAmount,
                currency,
                type
            );

            res.status(201).json({
                success: true,
                message: `Created ${disbursements.length} disbursements`,
                data: disbursements,
            });
        } catch (error) {
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
    async getPropertyDisbursements(req: Request, res: Response): Promise<void> {
        try {
            const { propertyId } = req.params;

            const disbursements = await this.subscriptionService.getDisbursementsByProperty(propertyId);

            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        } catch (error) {
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
    async getDistributionDisbursements(req: Request, res: Response): Promise<void> {
        try {
            const { distributionId } = req.params;

            const disbursements = await this.subscriptionService.getDisbursementsByDistribution(
                distributionId
            );

            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        } catch (error) {
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
    async getSubscriberDisbursements(req: Request, res: Response): Promise<void> {
        try {
            const { subscriptionId } = req.params;

            const disbursements = await this.subscriptionService.getDisbursementsBySubscriber(
                subscriptionId
            );

            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        } catch (error) {
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
    async getDisbursementsByWallet(req: Request, res: Response): Promise<void> {
        try {
            const { walletAddress } = req.params;

            const disbursements = await this.subscriptionService.getDisbursementsByWallet(walletAddress);

            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        } catch (error) {
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
    async subscribeWithWallet(req: Request, res: Response): Promise<void> {
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

            // Check availability first
            const availability = await this.subscriptionService.checkAvailability(propertyId, subscriptionAmount);
            if (!availability.isAvailable) {
                res.status(400).json({
                    success: false,
                    message: `Cannot subscribe: ${availability.reason}`,
                    available: availability.availableAmount,
                    requested: subscriptionAmount,
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
                const newBalance = await this.walletService.transferBetweenWallets(
                    subscriberUserId,
                    process.env.SYSTEM_WALLET_USER_ID || 'system',
                    subscriptionAmount,
                    `Subscription to property ${propertyId}`
                );

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
                    message: 'Subscription created from wallet successfully',
                    data: subscription,
                    walletUpdate: {
                        balanceBefore,
                        balanceAfter: newBalance,
                        deducted: subscriptionAmount,
                    },
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Subscribe with wallet error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to subscribe with wallet',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * POST /properties/:propertyId/disburse-batch-wallets
     * Disburse ROI to all subscriber wallets
     */
    async disburseBatchToWallets(req: Request, res: Response): Promise<void> {
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
            const subscriptions = await this.subscriptionService.getActiveSubscriptionsByProperty(
                propertyId
            );

            if (subscriptions.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'No active subscriptions found for property',
                });
                return;
            }

            const results: any[] = [];
            const errors: any[] = [];

            // Disburse to each subscriber's wallet
            for (const subscription of subscriptions) {
                try {
                    const result = await this.walletService.disburseROI(
                        subscription.subscriber_user_id,
                        disbursementAmount,
                        subscription.id,
                        roiPercentage || 0
                    );

                    results.push({
                        subscriptionId: subscription.id,
                        userId: subscription.subscriber_user_id,
                        status: 'completed',
                        transaction: result,
                    });
                } catch (error) {
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
        } catch (error) {
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
    async getPendingDisbursements(req: Request, res: Response): Promise<void> {
        try {
            const disbursements = await this.subscriptionService.getPendingDisbursements();

            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        } catch (error) {
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
    async executeDisbursement(req: Request, res: Response): Promise<void> {
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
        } catch (error) {
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
    async executeBatchDisbursements(req: Request, res: Response): Promise<void> {
        try {
            const { disbursementIds, tokenAddress } = req.body;

            if (!Array.isArray(disbursementIds) || !tokenAddress) {
                res.status(400).json({
                    success: false,
                    message: 'disbursementIds (array) and tokenAddress are required',
                });
                return;
            }

            const results = await this.subscriptionService.executeBatchDisbursements(
                disbursementIds,
                tokenAddress
            );

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
        } catch (error) {
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
    async getTotalDisbursedBySubscriber(req: Request, res: Response): Promise<void> {
        try {
            const { subscriptionId } = req.params;

            const totalDisbursed = await this.subscriptionService.getTotalDisbursedBySubscriber(
                subscriptionId
            );

            res.status(200).json({
                success: true,
                data: {
                    subscriptionId,
                    totalDisbursed,
                },
            });
        } catch (error) {
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
    async getTotalDisbursedByProperty(req: Request, res: Response): Promise<void> {
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
        } catch (error) {
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
    async getDisbursementsByDateRange(req: Request, res: Response): Promise<void> {
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

            const disbursements = await this.subscriptionService.getDisbursementsByDateRange(
                propertyId,
                new Date(startDate as string),
                new Date(endDate as string)
            );

            res.status(200).json({
                success: true,
                data: disbursements,
                total: disbursements.length,
            });
        } catch (error) {
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
    async disburseROI(req: Request, res: Response): Promise<void> {
        try {
            const { propertyId, amount, type } = req.body;

            if (!propertyId || !amount || !type) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields: propertyId, amount, type',
                });
                return;
            }

            const disbursements = await this.subscriptionService.createDisbursementsForAllSubscribers(
                propertyId,
                req.body.distributionId || `dist-${Date.now()}`,
                amount.toString(),
                'USDC',
                type
            );

            res.status(201).json({
                success: true,
                message: `Created ${disbursements.length} disbursements`,
                data: disbursements,
            });
        } catch (error) {
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
    async getUserDisbursements(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.id;
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
        } catch (error) {
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
    async disburseToWallet(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.id;
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

            const result = await this.walletService.disburseROI(
                userId,
                amount,
                subscriptionId,
                0
            );

            res.status(201).json({
                success: true,
                message: 'ROI disbursed to wallet successfully',
                data: result,
            });
        } catch (error) {
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
    async disburseToInAppWallets(req: Request, res: Response): Promise<void> {
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
            const results: {
                successful: Array<{
                    subscriptionId: string;
                    userId: string;
                    amount: any;
                    transactionId: string;
                    status: string;
                }>;
                failed: Array<{
                    subscriptionId: string;
                    userId: string;
                    error: string;
                }>;
            } = {
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
                        const result = await this.walletService.disburseROI(
                            subscription.subscriber_user_id,
                            parseFloat(disbursementAmount as string),
                            subscription.id,
                            roiPercentage || 0
                        );

                        results.successful.push({
                            subscriptionId: subscription.id,
                            userId: subscription.subscriber_user_id,
                            amount: disbursementAmount,
                            transactionId: result.transactionId,
                            status: result.status
                        });
                    } catch (error: any) {
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
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Disburse to in-app wallets error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to disburse to in-app wallets',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
