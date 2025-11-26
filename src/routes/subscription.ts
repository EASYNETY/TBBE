import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscriptionController';
import { Pool } from 'mysql2/promise';
import { authenticateToken, AuthRequest } from '../middleware/auth';

export const createSubscriptionRoutes = (db: Pool) => {
    const router = Router();
    const subscriptionController = new SubscriptionController(db);

    // Primary subscription endpoint - POST /api/subscriptions
    router.post('/', (req, res) => subscriptionController.subscribe(req, res));
    
    // User subscription routes
    router.post('/properties/:id/subscribe', (req, res) => subscriptionController.subscribe(req, res));
    router.get('/user', authenticateToken, (req: AuthRequest, res) => subscriptionController.getUserSubscriptions(req, res));
    router.get('/user/:userId', (req, res) => subscriptionController.getUserSubscriptions(req, res));
    
    // Get user subscription to specific property
    router.get('/property/:propertyId/user', (req, res) => subscriptionController.getUserSubscriptionForProperty(req, res));
    
    // Get all subscriptions for a property (for property owners/admins)
    router.get('/property/:propertyId', (req, res) => subscriptionController.getPropertySubscriptions(req, res));
    router.get('/property/:propertyId/subscribers', (req, res) => subscriptionController.getPropertySubscribers(req, res));
    
    // In-app wallet subscription routes (NEW)
    router.post('/properties/:id/subscribe-wallet', authenticateToken, (req: AuthRequest, res) => subscriptionController.subscribeWithWallet(req, res));
    router.get('/wallet', authenticateToken, (req: AuthRequest, res) => subscriptionController.getWalletSubscriptions(req, res));
    
    // ROI Disbursement routes
    router.post('/disburse', (req, res) => subscriptionController.disburseROI(req, res));
    router.get('/disbursements/:userId', authenticateToken, (req: AuthRequest, res) => subscriptionController.getUserDisbursements(req, res));
    router.post('/disburse-wallet', authenticateToken, (req: AuthRequest, res) => subscriptionController.disburseToWallet(req, res));
    
    // Batch ROI disbursement to in-app wallets (NEW)
    router.post('/disburse-to-wallets/:propertyId', authenticateToken, (req: AuthRequest, res) => subscriptionController.disburseBatchToWallets(req, res));

    return router;
};
