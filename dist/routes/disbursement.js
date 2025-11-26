"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDisbursementRoutes = void 0;
const express_1 = __importDefault(require("express"));
const disbursementService_1 = require("../services/disbursementService");
const auth_1 = require("../middleware/auth");
const createDisbursementRoutes = (db) => {
    const router = express_1.default.Router();
    const disbursementService = new disbursementService_1.DisbursementService(db);
    // ========== Disbursement Management ==========
    /**
     * GET /api/disbursements/user
     * Get all disbursements for authenticated user
     * Query params: limit (default: 50)
     */
    router.get('/user', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);
            const disbursements = await disbursementService.getDisbursementsByUser(req.user.id, limit);
            return res.json({
                success: true,
                data: disbursements,
                count: disbursements.length
            });
        }
        catch (error) {
            console.error('Get user disbursements error:', error);
            return res.status(500).json({ error: 'Failed to fetch disbursements' });
        }
    });
    /**
     * GET /api/disbursements/subscription/:subscriptionId
     * Get disbursements for a specific subscription
     */
    router.get('/subscription/:subscriptionId', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { subscriptionId } = req.params;
            const disbursements = await disbursementService.getDisbursementsBySubscription(subscriptionId);
            return res.json({
                success: true,
                data: disbursements,
                count: disbursements.length,
                subscriptionId
            });
        }
        catch (error) {
            console.error('Get subscription disbursements error:', error);
            return res.status(500).json({ error: 'Failed to fetch disbursements' });
        }
    });
    /**
     * GET /api/disbursements/:disbursementId
     * Get specific disbursement details
     */
    router.get('/:disbursementId', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { disbursementId } = req.params;
            const disbursement = await disbursementService.getDisbursement(disbursementId);
            if (!disbursement) {
                return res.status(404).json({ error: 'Disbursement not found' });
            }
            // Verify ownership
            if (disbursement.userId !== req.user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            return res.json({
                success: true,
                data: disbursement
            });
        }
        catch (error) {
            console.error('Get disbursement error:', error);
            return res.status(500).json({ error: 'Failed to fetch disbursement' });
        }
    });
    /**
     * GET /api/disbursements/schedule/:subscriptionId
     * Get disbursement schedule for a subscription
     */
    router.get('/schedule/:subscriptionId', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { subscriptionId } = req.params;
            const schedule = await disbursementService.getDisbursementSchedule(subscriptionId);
            if (!schedule) {
                return res.status(404).json({
                    error: 'No active disbursement schedule found',
                    data: null
                });
            }
            return res.json({
                success: true,
                data: schedule
            });
        }
        catch (error) {
            console.error('Get disbursement schedule error:', error);
            return res.status(500).json({ error: 'Failed to fetch schedule' });
        }
    });
    /**
     * POST /api/disbursements/schedule
     * Create new disbursement schedule
     * Requires: subscriptionId, amount, roiPercentage, frequency
     */
    router.post('/schedule', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { subscriptionId, amount, roiPercentage, frequency } = req.body;
            if (!subscriptionId || !amount || !roiPercentage || !frequency) {
                return res.status(400).json({
                    error: 'subscriptionId, amount, roiPercentage, and frequency are required'
                });
            }
            const validFrequencies = ['monthly', 'quarterly', 'annually'];
            if (!validFrequencies.includes(frequency)) {
                return res.status(400).json({
                    error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`
                });
            }
            const schedule = await disbursementService.createDisbursementSchedule(subscriptionId, req.user.id, amount, roiPercentage, frequency);
            return res.status(201).json({
                success: true,
                data: schedule,
                message: 'Disbursement schedule created successfully'
            });
        }
        catch (error) {
            console.error('Create disbursement schedule error:', error);
            const message = error instanceof Error ? error.message : 'Failed to create schedule';
            return res.status(400).json({ error: message });
        }
    });
    /**
     * POST /api/disbursements/:disbursementId/process
     * Process a pending disbursement (admin/system only)
     */
    router.post('/:disbursementId/process', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            // In production, verify admin role
            const { disbursementId } = req.params;
            const result = await disbursementService.processDisbursement(disbursementId);
            if (!result.success) {
                return res.status(400).json({
                    error: result.error,
                    success: false
                });
            }
            return res.json({
                success: true,
                data: { disbursementId, txHash: result.txHash },
                message: 'Disbursement processed successfully'
            });
        }
        catch (error) {
            console.error('Process disbursement error:', error);
            return res.status(500).json({ error: 'Failed to process disbursement' });
        }
    });
    /**
     * POST /api/disbursements/:disbursementId/retry
     * Retry a failed disbursement
     */
    router.post('/:disbursementId/retry', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { disbursementId } = req.params;
            const result = await disbursementService.retryFailedDisbursement(disbursementId);
            if (!result.success) {
                return res.status(400).json({
                    error: result.error,
                    success: false
                });
            }
            return res.json({
                success: true,
                data: { disbursementId, txHash: result.txHash },
                message: 'Disbursement retry initiated'
            });
        }
        catch (error) {
            console.error('Retry disbursement error:', error);
            return res.status(500).json({ error: 'Failed to retry disbursement' });
        }
    });
    /**
     * POST /api/disbursements/schedule/:subscriptionId/pause
     * Pause disbursement schedule
     */
    router.post('/schedule/:subscriptionId/pause', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { subscriptionId } = req.params;
            await disbursementService.pauseDisbursementSchedule(subscriptionId);
            return res.json({
                success: true,
                message: 'Disbursement schedule paused'
            });
        }
        catch (error) {
            console.error('Pause disbursement schedule error:', error);
            return res.status(500).json({ error: 'Failed to pause schedule' });
        }
    });
    /**
     * POST /api/disbursements/schedule/:subscriptionId/resume
     * Resume disbursement schedule
     */
    router.post('/schedule/:subscriptionId/resume', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { subscriptionId } = req.params;
            await disbursementService.resumeDisbursementSchedule(subscriptionId);
            return res.json({
                success: true,
                message: 'Disbursement schedule resumed'
            });
        }
        catch (error) {
            console.error('Resume disbursement schedule error:', error);
            return res.status(500).json({ error: 'Failed to resume schedule' });
        }
    });
    /**
     * GET /api/disbursements/stats
     * Get disbursement statistics for user
     */
    router.get('/stats', auth_1.authenticateToken, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const stats = await disbursementService.getDisbursementStats(req.user.id);
            return res.json({
                success: true,
                data: stats
            });
        }
        catch (error) {
            console.error('Get disbursement stats error:', error);
            return res.status(500).json({ error: 'Failed to fetch statistics' });
        }
    });
    return router;
};
exports.createDisbursementRoutes = createDisbursementRoutes;
//# sourceMappingURL=disbursement.js.map