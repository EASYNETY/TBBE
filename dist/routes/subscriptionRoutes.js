"use strict";
// Property Subscription Routes
// Complete subscription and disbursement flow endpoints
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubscriptionRoutes = void 0;
const express_1 = require("express");
const subscriptionController_1 = require("../controllers/subscriptionController");
const createSubscriptionRoutes = (db) => {
    const router = (0, express_1.Router)();
    const subscriptionController = new subscriptionController_1.SubscriptionController(db);
    // ===== SUBSCRIPTION ENDPOINTS =====
    /**
     * POST /api/subscriptions/subscribe/:propertyId
     * Create a new subscription to a property
     */
    router.post('/subscribe/:propertyId', (req, res) => subscriptionController.subscribe(req, res));
    /**
     * GET /api/subscriptions/properties/:propertyId/subscribers
     * Get all subscribers for a property
     */
    router.get('/properties/:propertyId/subscribers', (req, res) => subscriptionController.getSubscribers(req, res));
    /**
     * GET /api/subscriptions/properties/:propertyId/subscribers/active
     * Get active subscribers for a property
     */
    router.get('/properties/:propertyId/subscribers/active', (req, res) => subscriptionController.getActiveSubscribers(req, res));
    /**
     * GET /api/subscriptions/users/:userId
     * Get all subscriptions for a user
     */
    router.get('/users/:userId', (req, res) => subscriptionController.getUserSubscriptions(req, res));
    /**
     * GET /api/subscriptions/wallet/:walletAddress
     * Get subscriptions by wallet address
     */
    router.get('/wallet/:walletAddress', (req, res) => subscriptionController.getSubscriptionsByWallet(req, res));
    /**
     * POST /api/subscriptions/:subscriptionId/cancel
     * Cancel a subscription
     */
    router.post('/:subscriptionId/cancel', (req, res) => subscriptionController.cancelSubscription(req, res));
    /**
     * POST /api/subscriptions/:subscriptionId/verify-kyc
     * Verify KYC for a subscription
     */
    router.post('/:subscriptionId/verify-kyc', (req, res) => subscriptionController.verifyKYC(req, res));
    /**
     * GET /api/subscriptions/properties/:propertyId/stats
     * Get subscriber statistics for a property
     */
    router.get('/properties/:propertyId/stats', (req, res) => subscriptionController.getSubscriberStats(req, res));
    // ===== DISBURSEMENT ENDPOINTS =====
    /**
     * POST /api/subscriptions/properties/:propertyId/disburse
     * Create and execute disbursements for all subscribers
     */
    router.post('/properties/:propertyId/disburse', (req, res) => subscriptionController.createAndExecuteDisbursements(req, res));
    /**
     * GET /api/subscriptions/properties/:propertyId/disbursements
     * Get all disbursements for a property
     */
    router.get('/properties/:propertyId/disbursements', (req, res) => subscriptionController.getPropertyDisbursements(req, res));
    /**
     * GET /api/subscriptions/distribution/:distributionId/disbursements
     * Get disbursements by distribution ID
     */
    router.get('/distribution/:distributionId/disbursements', (req, res) => subscriptionController.getDistributionDisbursements(req, res));
    /**
     * GET /api/subscriptions/:subscriptionId/disbursements
     * Get disbursements for a subscriber
     */
    router.get('/:subscriptionId/disbursements', (req, res) => subscriptionController.getSubscriberDisbursements(req, res));
    /**
     * GET /api/subscriptions/disbursements/wallet/:walletAddress
     * Get disbursements by wallet address
     */
    router.get('/disbursements/wallet/:walletAddress', (req, res) => subscriptionController.getDisbursementsByWallet(req, res));
    /**
     * GET /api/subscriptions/disbursements/pending
     * Get all pending disbursements
     */
    router.get('/disbursements/pending', (req, res) => subscriptionController.getPendingDisbursements(req, res));
    /**
     * POST /api/subscriptions/disbursements/:disbursementId/execute
     * Execute a single disbursement
     */
    router.post('/disbursements/:disbursementId/execute', (req, res) => subscriptionController.executeDisbursement(req, res));
    /**
      * POST /api/subscriptions/disbursements/execute-batch
      * Execute multiple disbursements in batch
      */
    router.post('/disbursements/execute-batch', (req, res) => subscriptionController.executeBatchDisbursements(req, res));
    /**
      * POST /api/subscriptions/disburse-to-wallets/:propertyId
      * Create and execute ROI disbursements to in-app wallets
      */
    router.post('/disburse-to-wallets/:propertyId', (req, res) => subscriptionController.disburseToInAppWallets(req, res));
    /**
      * GET /api/subscriptions/:subscriptionId/total-disbursed
      * Get total disbursed amount for a subscriber
      */
    router.get('/:subscriptionId/total-disbursed', (req, res) => subscriptionController.getTotalDisbursedBySubscriber(req, res));
    /**
     * GET /api/subscriptions/properties/:propertyId/total-disbursed
     * Get total disbursed amount for a property
     */
    router.get('/properties/:propertyId/total-disbursed', (req, res) => subscriptionController.getTotalDisbursedByProperty(req, res));
    /**
      * GET /api/subscriptions/properties/:propertyId/disbursements/date-range
      * Get disbursements within a date range
      */
    router.get('/properties/:propertyId/disbursements/date-range', (req, res) => subscriptionController.getDisbursementsByDateRange(req, res));
    // ===== WALLET PAYMENT INTEGRATION =====
    /**
     * POST /api/subscriptions/properties/:propertyId/subscribe-wallet
     * Subscribe to a property using in-app wallet balance
     */
    router.post('/properties/:propertyId/subscribe-wallet', (req, res) => subscriptionController.subscribeWithWallet(req, res));
    /**
     * GET /api/subscriptions/subscriptions/wallet
     * Get wallet subscriptions for authenticated user
     */
    router.get('/subscriptions/wallet', (req, res) => subscriptionController.getWalletSubscriptions(req, res));
    /**
     * POST /api/subscriptions/disburse-to-wallets/:propertyId
     * Disburse ROI to all subscribers' in-app wallets
     */
    router.post('/disburse-to-wallets/:propertyId', (req, res) => subscriptionController.disburseToInAppWallets(req, res));
    return router;
};
exports.createSubscriptionRoutes = createSubscriptionRoutes;
//# sourceMappingURL=subscriptionRoutes.js.map