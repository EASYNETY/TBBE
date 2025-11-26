"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubscriptionRoutes = void 0;
const express_1 = require("express");
const subscriptionController_1 = require("../controllers/subscriptionController");
const auth_1 = require("../middleware/auth");
const createSubscriptionRoutes = (db) => {
    const router = (0, express_1.Router)();
    const subscriptionController = new subscriptionController_1.SubscriptionController(db);
    // User subscription routes
    router.post('/properties/:id/subscribe', (req, res) => subscriptionController.subscribe(req, res));
    router.get('/subscriptions/user', auth_1.authenticateToken, (req, res) => subscriptionController.getUserSubscriptions(req, res));
    // In-app wallet subscription routes (NEW)
    router.post('/properties/:id/subscribe-wallet', auth_1.authenticateToken, (req, res) => subscriptionController.subscribeWithWallet(req, res));
    router.get('/subscriptions/wallet', auth_1.authenticateToken, (req, res) => subscriptionController.getWalletSubscriptions(req, res));
    // ROI Disbursement routes
    router.post('/subscriptions/disburse', (req, res) => subscriptionController.disburseROI(req, res));
    router.get('/subscriptions/disbursements/:userId', auth_1.authenticateToken, (req, res) => subscriptionController.getUserDisbursements(req, res));
    router.post('/subscriptions/disburse-wallet', auth_1.authenticateToken, (req, res) => subscriptionController.disburseToWallet(req, res));
    // Batch ROI disbursement to in-app wallets (NEW)
    router.post('/subscriptions/disburse-to-wallets/:propertyId', auth_1.authenticateToken, (req, res) => subscriptionController.disburseBatchToWallets(req, res));
    return router;
};
exports.createSubscriptionRoutes = createSubscriptionRoutes;
//# sourceMappingURL=subscription.js.map