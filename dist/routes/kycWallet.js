"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKYCWalletRoutes = void 0;
const express_1 = __importDefault(require("express"));
const kycWalletService_1 = require("../services/kycWalletService");
const auth_1 = require("../middleware/auth");
const createKYCWalletRoutes = (db) => {
    const router = express_1.default.Router();
    const kycService = new kycWalletService_1.KYCWalletService(db);
    // ========== KYC Verification ==========
    /**
     * Initiate KYC verification
     * POST /api/kyc-wallet/initiate
     */
    router.post('/initiate', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const result = await kycService.initiateKYCVerification(req.user.id);
            res.status(202).json({
                success: true,
                verification: result
            });
        }
        catch (error) {
            console.error('KYC initiation error:', error);
            res.status(500).json({ error: error.message || 'Failed to initiate KYC' });
        }
    });
    /**
     * Get KYC status for current user
     * GET /api/kyc-wallet/status
     */
    router.get('/status', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const status = await kycService.getKYCStatus(req.user.id);
            res.json({
                success: true,
                status
            });
        }
        catch (error) {
            console.error('Get KYC status error:', error);
            res.status(500).json({ error: 'Failed to fetch KYC status' });
        }
    });
    /**
     * Get detailed KYC information
     * GET /api/kyc-wallet/details
     */
    router.get('/details', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const details = await kycService.getKYCDetails(req.user.id);
            if (!details) {
                return res.status(404).json({ error: 'No KYC verification found' });
            }
            res.json({
                success: true,
                kyc: details
            });
        }
        catch (error) {
            console.error('Get KYC details error:', error);
            res.status(500).json({ error: 'Failed to fetch KYC details' });
        }
    });
    /**
     * Check if user is KYC verified
     * GET /api/kyc-wallet/is-verified
     */
    router.get('/is-verified', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const isVerified = await kycService.isKYCVerified(req.user.id);
            res.json({
                success: true,
                isVerified
            });
        }
        catch (error) {
            console.error('Check KYC verification error:', error);
            res.status(500).json({ error: 'Failed to check KYC status' });
        }
    });
    /**
     * Submit KYC data (for mock provider testing)
     * POST /api/kyc-wallet/submit
     */
    router.post('/submit', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { kycData } = req.body;
            if (!kycData) {
                return res.status(400).json({ error: 'Missing required field: kycData' });
            }
            await kycService.verifyKYCSubmission(req.user.id, kycData);
            res.json({
                success: true,
                message: 'KYC verification completed successfully'
            });
        }
        catch (error) {
            console.error('KYC submission error:', error);
            res.status(500).json({ error: error.message || 'Failed to submit KYC' });
        }
    });
    /**
     * Mock KYC completion (for testing)
     * POST /api/kyc-wallet/mock-complete/:verificationId
     */
    router.post('/mock-complete/:verificationId', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { verificationId } = req.params;
            const { kycData } = req.body;
            const mockKycData = kycData || {
                fullName: 'Test User',
                nationality: 'Test',
                dateOfBirth: '1990-01-01',
                address: 'Test Address',
                idType: 'passport',
                idNumber: 'TEST123456',
                verified: true,
                verificationDate: new Date().toISOString()
            };
            await kycService.completeMockKYCVerification(req.user.id, verificationId, mockKycData);
            res.json({
                success: true,
                message: 'Mock KYC verification completed',
                verificationId
            });
        }
        catch (error) {
            console.error('Mock KYC completion error:', error);
            res.status(500).json({ error: error.message || 'Failed to complete mock KYC' });
        }
    });
    /**
     * Webhook for KYC provider (Sumsub, Blockpass, Persona)
     * POST /api/kyc-wallet/webhook
     */
    router.post('/webhook', async (req, res) => {
        try {
            const { provider, payload } = req.body;
            if (!provider || !payload) {
                return res.status(400).json({ error: 'Missing required fields: provider, payload' });
            }
            await kycService.handleKYCWebhook(provider, payload);
            res.json({
                success: true,
                message: 'Webhook processed successfully'
            });
        }
        catch (error) {
            console.error('KYC webhook error:', error);
            res.status(500).json({ error: error.message || 'Failed to process webhook' });
        }
    });
    // ========== Admin Routes ==========
    /**
     * Admin: Reject KYC submission
     * POST /api/kyc-wallet/admin/reject
     */
    router.post('/admin/reject', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            // Check if user is admin
            if (!['admin', 'super-admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { userId, reason } = req.body;
            if (!userId || !reason) {
                return res.status(400).json({ error: 'Missing required fields: userId, reason' });
            }
            await kycService.rejectKYCSubmission(userId, reason);
            res.json({
                success: true,
                message: 'KYC submission rejected'
            });
        }
        catch (error) {
            console.error('Admin reject KYC error:', error);
            res.status(500).json({ error: error.message || 'Failed to reject KYC' });
        }
    });
    return router;
};
exports.createKYCWalletRoutes = createKYCWalletRoutes;
//# sourceMappingURL=kycWallet.js.map