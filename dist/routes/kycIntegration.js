"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKYCIntegrationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const kycIntegrationService_1 = require("../services/kycIntegrationService");
const auth_1 = require("../middleware/auth");
const crypto_1 = __importDefault(require("crypto"));
const createKYCIntegrationRoutes = (db) => {
    const router = express_1.default.Router();
    const kycService = new kycIntegrationService_1.KYCIntegrationService(db);
    /**
     * Initialize KYC verification
     * POST /api/kyc/initialize
     */
    router.post('/initialize', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const result = await kycService.initializeVerification(req.user.id, req.user.wallet_address);
            res.status(202).json({
                success: true,
                verificationId: result.verificationId,
                provider: result.provider,
                redirectUrl: result.redirectUrl,
                status: 'initiated',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            });
        }
        catch (error) {
            console.error('KYC initialization error:', error);
            res.status(500).json({ error: error.message || 'Failed to initialize KYC' });
        }
    });
    /**
     * Get verification status
     * GET /api/kyc/status/:verificationId
     */
    router.get('/status/:verificationId', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { verificationId } = req.params;
            const status = await kycService.getVerificationStatus(verificationId, req.user.id);
            if (!status) {
                return res.status(404).json({ error: 'Verification not found' });
            }
            res.json({
                success: true,
                verificationId,
                status: status.status,
                provider: status.provider,
                isVerified: status.status === 'approved',
                verificationDate: status.verification_date,
                rejectionReason: status.rejection_reason
            });
        }
        catch (error) {
            console.error('Get KYC status error:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch status' });
        }
    });
    /**
     * Submit manual KYC data (mock provider)
     * POST /api/kyc/submit
     */
    router.post('/submit', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const kycData = req.body;
            // Validate required fields
            const requiredFields = ['fullName', 'dateOfBirth', 'nationality', 'address', 'idType', 'idNumber'];
            const missingFields = requiredFields.filter(field => !kycData[field]);
            if (missingFields.length > 0) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    missingFields
                });
            }
            const result = await kycService.submitManualKYC(req.user.id, kycData);
            res.json({
                success: true,
                verificationId: result.verificationId,
                status: result.status,
                message: 'KYC submission received. Pending manual review.'
            });
        }
        catch (error) {
            console.error('KYC submit error:', error);
            res.status(500).json({ error: error.message || 'Failed to submit KYC' });
        }
    });
    /**
     * Webhook receiver for Sumsub
     * POST /api/kyc/webhook/sumsub
     */
    router.post('/webhook/sumsub', async (req, res) => {
        try {
            // Verify webhook signature
            const signature = req.headers['x-signature'];
            if (!signature) {
                return res.status(401).json({ error: 'Missing signature' });
            }
            const payload = JSON.stringify(req.body);
            const expectedSignature = crypto_1.default
                .createHmac('sha256', process.env.SUMSUB_WEBHOOK_SECRET || '')
                .update(payload)
                .digest('hex');
            if (signature !== expectedSignature) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
            await kycService.handleSumsubWebhook(req.body);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Sumsub webhook error:', error);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    });
    /**
     * Webhook receiver for Blockpass
     * POST /api/kyc/webhook/blockpass
     */
    router.post('/webhook/blockpass', async (req, res) => {
        try {
            const signature = req.headers['x-signature'];
            if (!signature) {
                return res.status(401).json({ error: 'Missing signature' });
            }
            const payload = JSON.stringify(req.body);
            const expectedSignature = crypto_1.default
                .createHmac('sha256', process.env.BLOCKPASS_WEBHOOK_SECRET || '')
                .update(payload)
                .digest('hex');
            if (signature !== expectedSignature) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
            await kycService.handleBlockpassWebhook(req.body);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Blockpass webhook error:', error);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    });
    /**
     * Webhook receiver for Persona
     * POST /api/kyc/webhook/persona
     */
    router.post('/webhook/persona', async (req, res) => {
        try {
            const signature = req.headers['x-signature'];
            if (!signature) {
                return res.status(401).json({ error: 'Missing signature' });
            }
            const payload = JSON.stringify(req.body);
            const expectedSignature = crypto_1.default
                .createHmac('sha256', process.env.PERSONA_WEBHOOK_SECRET || '')
                .update(payload)
                .digest('hex');
            if (signature !== expectedSignature) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
            await kycService.handlePersonaWebhook(req.body);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Persona webhook error:', error);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    });
    /**
     * Admin: Get all pending verifications
     * GET /api/kyc/admin/pending
     */
    router.get('/admin/pending', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user || !['admin', 'super-admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { limit = '50', offset = '0' } = req.query;
            const verifications = await kycService.getPendingVerifications(parseInt(limit), parseInt(offset));
            res.json({
                success: true,
                verifications,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            });
        }
        catch (error) {
            console.error('Get pending verifications error:', error);
            res.status(500).json({ error: 'Failed to fetch pending verifications' });
        }
    });
    /**
     * Admin: Approve verification
     * POST /api/kyc/admin/approve/:verificationId
     */
    router.post('/admin/approve/:verificationId', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user || !['admin', 'super-admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { verificationId } = req.params;
            const result = await kycService.approveVerification(verificationId);
            res.json({
                success: true,
                message: 'Verification approved',
                verificationId,
                walletVerified: result.walletVerified
            });
        }
        catch (error) {
            console.error('Approve verification error:', error);
            res.status(500).json({ error: error.message || 'Failed to approve verification' });
        }
    });
    /**
      * Admin: Reject verification
      * POST /api/kyc/admin/reject/:verificationId
      */
    router.post('/admin/reject/:verificationId', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user || !['admin', 'super-admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { verificationId } = req.params;
            const { reason } = req.body;
            if (!reason) {
                return res.status(400).json({ error: 'Rejection reason required' });
            }
            await kycService.rejectVerification(verificationId, reason);
            res.json({
                success: true,
                message: 'Verification rejected',
                verificationId
            });
        }
        catch (error) {
            console.error('Reject verification error:', error);
            res.status(500).json({ error: error.message || 'Failed to reject verification' });
        }
    });
    /**
     * Mock KYC: Complete verification (for testing)
     * POST /api/kyc/mock/complete/:verificationId
     */
    router.post('/mock/complete/:verificationId', async (req, res) => {
        try {
            const { verificationId } = req.params;
            const { approved = true, kycData } = req.body;
            // Get verification
            const verifications = await query(`SELECT * FROM kyc_verifications WHERE id = ? AND provider = 'mock'`, [verificationId]);
            if (verifications.length === 0) {
                return res.status(404).json({ error: 'Mock verification not found' });
            }
            const verification = verifications[0];
            const status = approved ? 'approved' : 'rejected';
            // Update verification
            await query(`UPDATE kyc_verifications SET status = ?, verification_date = NOW(), kyc_data = ?, updated_at = NOW() WHERE id = ?`, [status, kycData ? JSON.stringify(kycData) : null, verificationId]);
            // If approved, mark wallet as KYC verified
            if (approved) {
                await query(`UPDATE wallets SET kyc_status = 'verified', kyc_verified_at = NOW() WHERE user_id = ?`, [verification.user_id]);
            }
            // Create notification
            const notificationId = crypto_1.default.randomUUID();
            await query(`INSERT INTO notifications 
          (id, user_id, type, title, message, created_at)
          VALUES (?, ?, ?, ?, ?, NOW())`, [
                notificationId,
                verification.user_id,
                approved ? 'kyc_approved' : 'kyc_rejected',
                approved ? 'KYC Approved (Mock)' : 'KYC Rejected (Mock)',
                approved
                    ? 'Your KYC verification has been approved!'
                    : 'Your KYC verification was rejected. Please resubmit.',
            ]);
            res.json({
                success: true,
                message: `Mock KYC ${approved ? 'approved' : 'rejected'}`,
                verificationId,
                status,
                userId: verification.user_id
            });
        }
        catch (error) {
            console.error('Mock KYC complete error:', error);
            res.status(500).json({ error: error.message || 'Failed to complete mock KYC' });
        }
    });
    return router;
};
exports.createKYCIntegrationRoutes = createKYCIntegrationRoutes;
//# sourceMappingURL=kycIntegration.js.map