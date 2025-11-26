import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
export declare class SubscriptionController {
    private subscriptionService;
    private walletService;
    private db;
    constructor(db: Pool);
    /**
     * POST /properties/:propertyId/subscribe
     * Create a new subscription to a property
     */
    subscribe(req: Request, res: Response): Promise<void>;
    /**
     * GET /properties/:propertyId/subscribers
     * Get all subscribers for a property
     */
    getSubscribers(req: Request, res: Response): Promise<void>;
    /**
     * GET /properties/:propertyId/subscribers/active
     * Get active subscribers for a property
     */
    getActiveSubscribers(req: Request, res: Response): Promise<void>;
    /**
     * GET /users/:userId/subscriptions
     * Get all subscriptions for a user
     */
    getUserSubscriptions(req: Request, res: Response): Promise<void>;
    /**
     * GET /subscriptions/wallet/:walletAddress
     * Get subscriptions by wallet address
     */
    getSubscriptionsByWallet(req: Request, res: Response): Promise<void>;
    /**
     * POST /subscriptions/:subscriptionId/cancel
     * Cancel a subscription
     */
    cancelSubscription(req: Request, res: Response): Promise<void>;
    /**
     * POST /subscriptions/:subscriptionId/verify-kyc
     * Verify KYC for a subscription
     */
    verifyKYC(req: Request, res: Response): Promise<void>;
    /**
     * GET /properties/:propertyId/subscriber-stats
     * Get subscriber statistics for a property
     */
    getSubscriberStats(req: Request, res: Response): Promise<void>;
    /**
     * POST /properties/:propertyId/disburse
     * Create and execute disbursements for all subscribers
     */
    createAndExecuteDisbursements(req: Request, res: Response): Promise<void>;
    /**
     * GET /properties/:propertyId/disbursements
     * Get all disbursements for a property
     */
    getPropertyDisbursements(req: Request, res: Response): Promise<void>;
    /**
     * GET /disbursements/distribution/:distributionId
     * Get disbursements by distribution ID
     */
    getDistributionDisbursements(req: Request, res: Response): Promise<void>;
    /**
     * GET /subscriptions/:subscriptionId/disbursements
     * Get disbursements for a subscriber
     */
    getSubscriberDisbursements(req: Request, res: Response): Promise<void>;
    /**
     * GET /disbursements/wallet/:walletAddress
     * Get disbursements by wallet address
     */
    getDisbursementsByWallet(req: Request, res: Response): Promise<void>;
    /**
     * POST /properties/:propertyId/subscribe-wallet
     * Subscribe to a property using in-app wallet balance
     */
    subscribeWithWallet(req: Request, res: Response): Promise<void>;
    /**
     * GET /subscriptions/wallet
     * Get wallet subscriptions for authenticated user
     */
    getWalletSubscriptions(req: Request, res: Response): Promise<void>;
    /**
     * POST /subscriptions/disburse-to-wallets/:propertyId
     * Disburse ROI to all subscribers' in-app wallets
     */
    disburseBatchToWallets(req: Request, res: Response): Promise<void>;
    /**
     * GET /disbursements/pending
     * Get all pending disbursements
     */
    getPendingDisbursements(req: Request, res: Response): Promise<void>;
    /**
     * POST /disbursements/:disbursementId/execute
     * Execute a single disbursement
     */
    executeDisbursement(req: Request, res: Response): Promise<void>;
    /**
     * POST /disbursements/execute-batch
     * Execute multiple disbursements in batch
     */
    executeBatchDisbursements(req: Request, res: Response): Promise<void>;
    /**
     * GET /subscriptions/:subscriptionId/total-disbursed
     * Get total disbursed amount for a subscriber
     */
    getTotalDisbursedBySubscriber(req: Request, res: Response): Promise<void>;
    /**
     * GET /properties/:propertyId/total-disbursed
     * Get total disbursed amount for a property
     */
    getTotalDisbursedByProperty(req: Request, res: Response): Promise<void>;
    /**
      * GET /properties/:propertyId/disbursements/date-range
      * Get disbursements within a date range
      */
    getDisbursementsByDateRange(req: Request, res: Response): Promise<void>;
    /**
     * POST /subscriptions/disburse
     * Disburse ROI to all subscribers of a property
     */
    disburseROI(req: Request, res: Response): Promise<void>;
    /**
     * GET /subscriptions/disbursements/:userId
     * Get all disbursements for a user
     */
    getUserDisbursements(req: Request, res: Response): Promise<void>;
    /**
      * POST /subscriptions/disburse-wallet
      * Disburse ROI directly to user's in-app wallet
      */
    disburseToWallet(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/subscriptions/disburse-to-wallets/:propertyId
     * Disburse ROI to all subscribers' in-app wallets for a property
     */
    disburseToInAppWallets(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=subscriptionController.d.ts.map