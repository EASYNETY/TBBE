// Payment Gateway & Subscription Routes
// Handles all payment processing and subscription management endpoints

import { Router, Request, Response } from 'express';
import { SubscriptionController } from '../controllers/subscriptionController';
import { Pool } from 'mysql2/promise';
import { PaymentGatewayService } from '../services/paymentGatewayService';

export function createPaymentRoutes(db: Pool): Router {
  const router = Router();
  const subscriptionController = new SubscriptionController(db);
  const paymentGatewayService = new PaymentGatewayService(db);

  // ==================== ALLOTMENT MANAGEMENT ====================

  /**
   * GET /properties/:propertyId/allotments
   * Get subscription allotments for a property
   */
  router.get('/properties/:propertyId/allotments', (req, res) =>
    subscriptionController.getPropertyAllotments(req, res)
  );

  /**
   * POST /properties/:propertyId/allotments/manage
   * Manage property subscription allotments
   */
  router.post('/properties/:propertyId/allotments/manage', (req, res) =>
    subscriptionController.manageAllotments(req, res)
  );

  /**
   * GET /properties/:propertyId/subscription-availability
   * Check available capacity for subscription
   */
  router.get('/properties/:propertyId/subscription-availability', (req, res) =>
    subscriptionController.checkSubscriptionAvailability(req, res)
  );

  // ==================== SUBSCRIPTION CREATION ====================

  /**
   * POST /properties/:propertyId/subscribe
   * Create subscription with any payment method
   * Supports: Stripe, Eway, POLi, Bank Transfer, NZD, Wallet
   */
  router.post('/properties/:propertyId/subscribe', (req, res) =>
    subscriptionController.subscribe(req, res)
  );

  /**
   * POST /properties/:propertyId/subscribe-wallet
   * Create subscription using in-app wallet balance
   */
  router.post('/properties/:propertyId/subscribe-wallet', (req, res) =>
    subscriptionController.subscribeWithWallet(req, res)
  );

  // ==================== TRANSFER ACCOUNT MANAGEMENT ====================

  /**
   * GET /properties/:propertyId/transfer-account
   * Get transfer account details for a property
   */
  router.get('/properties/:propertyId/transfer-account', (req, res) =>
    subscriptionController.getTransferAccountDetails(req, res)
  );

  /**
   * POST /properties/:propertyId/transfer-account/setup
   * Configure transfer account for a property
   */
  router.post('/properties/:propertyId/transfer-account/setup', (req, res) =>
    subscriptionController.setupTransferAccount(req, res)
  );

  // ==================== STRIPE PAYMENT ====================

  /**
   * POST /api/payments/stripe/intent
   * Create Stripe Payment Intent
   */
  router.post('/api/payments/stripe/intent', async (req: Request, res: Response) => {
    try {
      const { amount, currency, metadata } = req.body;

      if (!amount || !currency) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: amount, currency'
        });
        return;
      }

      const paymentIntent = await paymentGatewayService.createStripePaymentIntent(
        amount,
        currency,
        metadata
      );

      res.status(200).json({
        success: true,
        data: paymentIntent
      });
    } catch (error) {
      console.error('Stripe intent creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment intent',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/payments/stripe/verify
   * Verify Stripe payment
   */
  router.post('/api/payments/stripe/verify', async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.body;

      const verified = await paymentGatewayService.verifyPaymentStatus(
        transactionId,
        'STRIPE'
      );

      res.status(200).json({
        success: true,
        verified
      });
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify payment'
      });
    }
  });

  // ==================== EWAY PAYMENT ====================

  /**
   * POST /api/payments/eway/token
   * Create Eway payment token for stored payments
   */
  router.post('/api/payments/eway/token', async (req: Request, res: Response) => {
    try {
      const { customerName, cardNumber, expiryMonth, expiryYear } = req.body;

      if (!customerName || !cardNumber || !expiryMonth || !expiryYear) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: customerName, cardNumber, expiryMonth, expiryYear'
        });
        return;
      }

      const tokenId = await paymentGatewayService.createEwayPaymentToken(
        customerName,
        cardNumber,
        expiryMonth,
        expiryYear
      );

      res.status(200).json({
        success: true,
        data: { tokenCustomerID: tokenId }
      });
    } catch (error) {
      console.error('Eway token creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment token',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/payments/eway/callback
   * Eway payment callback/webhook
   */
  router.post('/api/payments/eway/callback', async (req: Request, res: Response) => {
    try {
      // Process Eway callback
      console.log('Eway callback received:', req.body);
      
      // Update payment status based on Eway response
      // Implementation depends on Eway callback format
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Eway callback error:', error);
      res.status(500).json({ success: false });
    }
  });

  // ==================== POLI PAYMENT ====================

  /**
   * POST /api/payments/poli/initiate
   * Initiate POLi payment (returns redirect URL)
   */
  router.post('/api/payments/poli/initiate', async (req: Request, res: Response) => {
    try {
      const { amount, currency, merchantReference } = req.body;

      if (!amount || !currency || !merchantReference) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: amount, currency, merchantReference'
        });
        return;
      }

      const redirectUrl = await paymentGatewayService.initiatePOLiPayment(
        amount,
        currency,
        merchantReference
      );

      res.status(200).json({
        success: true,
        data: { redirectUrl }
      });
    } catch (error) {
      console.error('POLi initiation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate POLi payment',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/payments/poli/notification
   * POLi payment notification webhook
   */
  router.post('/api/payments/poli/notification', async (req: Request, res: Response) => {
    try {
      const { Token, TransactionRefNumber, TransactionStatus } = req.body;

      console.log('POLi notification received:', {
        token: Token,
        transactionRef: TransactionRefNumber,
        status: TransactionStatus
      });

      // Handle POLi payment completion
      // Update subscription status based on TransactionStatus
      // Create activity log

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('POLi notification error:', error);
      res.status(500).json({ success: false });
    }
  });

  /**
   * GET /subscription/success
   * POLi/payment success redirect
   */
  router.get('/subscription/success', (req: Request, res: Response) => {
    // Redirect to frontend success page with transaction details
    res.redirect(`${process.env.FRONTEND_URL}/subscription/success?token=${req.query.token}`);
  });

  /**
   * GET /subscription/failed
   * POLi/payment failed redirect
   */
  router.get('/subscription/failed', (req: Request, res: Response) => {
    res.redirect(`${process.env.FRONTEND_URL}/subscription/failed?reason=payment_failed`);
  });

  /**
   * GET /subscription/cancelled
   * POLi/payment cancelled redirect
   */
  router.get('/subscription/cancelled', (req: Request, res: Response) => {
    res.redirect(`${process.env.FRONTEND_URL}/subscription/cancelled`);
  });

  // ==================== SUBSCRIBER MANAGEMENT ====================

  /**
   * GET /properties/:propertyId/subscribers
   * Get all subscribers for a property
   */
  router.get('/properties/:propertyId/subscribers', (req, res) =>
    subscriptionController.getSubscribers(req, res)
  );

  /**
   * GET /properties/:propertyId/subscribers/active
   * Get active subscribers for a property
   */
  router.get('/properties/:propertyId/subscribers/active', (req, res) =>
    subscriptionController.getActiveSubscribers(req, res)
  );

  /**
   * GET /users/:userId/subscriptions
   * Get all subscriptions for a user
   */
  router.get('/users/:userId/subscriptions', (req, res) =>
    subscriptionController.getUserSubscriptions(req, res)
  );

  /**
   * GET /subscriptions/wallet/:walletAddress
   * Get subscriptions by wallet address
   */
  router.get('/subscriptions/wallet/:walletAddress', (req, res) =>
    subscriptionController.getSubscriptionsByWallet(req, res)
  );

  /**
   * POST /subscriptions/:subscriptionId/cancel
   * Cancel a subscription
   */
  router.post('/subscriptions/:subscriptionId/cancel', (req, res) =>
    subscriptionController.cancelSubscription(req, res)
  );

  /**
   * POST /subscriptions/:subscriptionId/verify-kyc
   * Verify KYC for a subscription
   */
  router.post('/subscriptions/:subscriptionId/verify-kyc', (req, res) =>
    subscriptionController.verifyKYC(req, res)
  );

  /**
   * GET /properties/:propertyId/subscriber-stats
   * Get subscriber statistics for a property
   */
  router.get('/properties/:propertyId/subscriber-stats', (req, res) =>
    subscriptionController.getSubscriberStats(req, res)
  );

  // ==================== DISBURSEMENT MANAGEMENT ====================

  /**
   * POST /properties/:propertyId/disburse
   * Create and execute disbursements for all subscribers
   */
  router.post('/properties/:propertyId/disburse', (req, res) =>
    subscriptionController.createAndExecuteDisbursements(req, res)
  );

  /**
   * GET /properties/:propertyId/disbursements
   * Get all disbursements for a property
   */
  router.get('/properties/:propertyId/disbursements', (req, res) =>
    subscriptionController.getPropertyDisbursements(req, res)
  );

  /**
   * GET /disbursements/distribution/:distributionId
   * Get disbursements by distribution ID
   */
  router.get('/disbursements/distribution/:distributionId', (req, res) =>
    subscriptionController.getDistributionDisbursements(req, res)
  );

  /**
   * GET /subscriptions/:subscriptionId/disbursements
   * Get disbursements for a subscriber
   */
  router.get('/subscriptions/:subscriptionId/disbursements', (req, res) =>
    subscriptionController.getSubscriberDisbursements(req, res)
  );

  /**
   * GET /disbursements/wallet/:walletAddress
   * Get disbursements by wallet address
   */
  router.get('/disbursements/wallet/:walletAddress', (req, res) =>
    subscriptionController.getDisbursementsByWallet(req, res)
  );

  /**
   * POST /properties/:propertyId/disburse-batch-wallets
   * Disburse ROI to all subscriber wallets
   */
  router.post('/properties/:propertyId/disburse-batch-wallets', (req, res) =>
    subscriptionController.disburseBatchToWallets(req, res)
  );

  /**
   * GET /disbursements/pending
   * Get all pending disbursements
   */
  router.get('/disbursements/pending', (req, res) =>
    subscriptionController.getPendingDisbursements(req, res)
  );

  /**
   * POST /disbursements/:disbursementId/execute
   * Execute a single disbursement
   */
  router.post('/disbursements/:disbursementId/execute', (req, res) =>
    subscriptionController.executeDisbursement(req, res)
  );

  /**
   * POST /disbursements/execute-batch
   * Execute multiple disbursements in batch
   */
  router.post('/disbursements/execute-batch', (req, res) =>
    subscriptionController.executeBatchDisbursements(req, res)
  );

  /**
   * GET /subscriptions/:subscriptionId/total-disbursed
   * Get total disbursed amount for a subscriber
   */
  router.get('/subscriptions/:subscriptionId/total-disbursed', (req, res) =>
    subscriptionController.getTotalDisbursedBySubscriber(req, res)
  );

  /**
   * GET /properties/:propertyId/total-disbursed
   * Get total disbursed amount for a property
   */
  router.get('/properties/:propertyId/total-disbursed', (req, res) =>
    subscriptionController.getTotalDisbursedByProperty(req, res)
  );

  /**
   * GET /properties/:propertyId/disbursements/date-range
   * Get disbursements within a date range
   */
  router.get('/properties/:propertyId/disbursements/date-range', (req, res) =>
    subscriptionController.getDisbursementsByDateRange(req, res)
  );

  /**
   * POST /subscriptions/disburse
   * Disburse ROI to all subscribers of a property
   */
  router.post('/subscriptions/disburse', (req, res) =>
    subscriptionController.disburseROI(req, res)
  );

  /**
   * GET /subscriptions/disbursements/:userId
   * Get all disbursements for a user
   */
  router.get('/subscriptions/disbursements/:userId', (req, res) =>
    subscriptionController.getUserDisbursements(req, res)
  );

  /**
   * POST /subscriptions/disburse-wallet
   * Disburse ROI directly to user's in-app wallet
   */
  router.post('/subscriptions/disburse-wallet', (req, res) =>
    subscriptionController.disburseToWallet(req, res)
  );

  /**
   * POST /api/subscriptions/disburse-to-wallets/:propertyId
   * Disburse ROI to all subscribers' in-app wallets for a property
   */
  router.post('/api/subscriptions/disburse-to-wallets/:propertyId', (req, res) =>
    subscriptionController.disburseToInAppWallets(req, res)
  );

  return router;
}
