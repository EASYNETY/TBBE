"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisbursementService = void 0;
const uuid_1 = require("uuid");
const walletTransactionService_1 = require("./walletTransactionService");
const walletModel_1 = require("../models/walletModel");
class DisbursementService {
    constructor(pool) {
        this.pool = pool;
        this.transactionService = new walletTransactionService_1.WalletTransactionService(pool);
        this.walletModel = new walletModel_1.WalletModel(pool);
    }
    async createDisbursement(request) {
        const disbursementId = (0, uuid_1.v4)();
        await this.pool.execute(`INSERT INTO disbursements 
       (id, subscription_id, user_id, amount, roi_percentage, status, scheduled_for, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())`, [disbursementId, request.subscriptionId, request.userId, request.amount, request.roiPercentage]);
        return this.getDisbursement(disbursementId);
    }
    async getDisbursement(disbursementId) {
        const [rows] = await this.pool.query('SELECT * FROM disbursements WHERE id = ?', [disbursementId]);
        return rows.length > 0 ? this.formatDisbursement(rows[0]) : null;
    }
    async getDisbursementsBySubscription(subscriptionId) {
        const [rows] = await this.pool.query('SELECT * FROM disbursements WHERE subscription_id = ? ORDER BY scheduled_for DESC', [subscriptionId]);
        return rows.map(row => this.formatDisbursement(row));
    }
    async getDisbursementsByUser(userId, limit = 50) {
        const [rows] = await this.pool.query('SELECT * FROM disbursements WHERE user_id = ? ORDER BY scheduled_for DESC LIMIT ?', [userId, limit]);
        return rows.map(row => this.formatDisbursement(row));
    }
    async getPendingDisbursements() {
        const [rows] = await this.pool.query(`SELECT * FROM disbursements 
       WHERE status = 'pending' AND scheduled_for <= NOW() 
       ORDER BY scheduled_for ASC`);
        return rows.map(row => this.formatDisbursement(row));
    }
    async processDisbursement(disbursementId) {
        const disbursement = await this.getDisbursement(disbursementId);
        if (!disbursement) {
            return { success: false, error: 'Disbursement not found' };
        }
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            // Get wallet
            const wallet = await this.walletModel.getWalletByUserId(disbursement.userId);
            if (!wallet) {
                return { success: false, error: 'User wallet not found' };
            }
            // Update disbursement status to processing
            await connection.execute('UPDATE disbursements SET status = ?, updated_at = NOW() WHERE id = ?', ['processing', disbursementId]);
            // Record transaction
            const balanceBefore = wallet.balance_usdc;
            const newBalance = balanceBefore + disbursement.amount;
            const txId = (0, uuid_1.v4)();
            await connection.execute(`INSERT INTO wallet_transactions 
         (id, user_id, wallet_id, transaction_type, amount, balance_before, balance_after,
          from_address, to_address, status, description, metadata, created_at, updated_at)
         VALUES (?, ?, ?, 'roi_disbursement', ?, ?, ?, 'system', ?, 'completed', ?, ?, NOW(), NOW())`, [
                txId,
                disbursement.userId,
                wallet.id,
                disbursement.amount,
                balanceBefore,
                newBalance,
                wallet.wallet_address,
                `ROI Disbursement (${disbursement.roiPercentage}%) for subscription ${disbursement.subscriptionId}`,
                JSON.stringify({
                    subscriptionId: disbursement.subscriptionId,
                    roiPercentage: disbursement.roiPercentage,
                    disbursementId: disbursementId,
                    disbursementDate: new Date().toISOString()
                })
            ]);
            // Update wallet balance
            await connection.execute('UPDATE user_wallets SET balance_usdc = ?, updated_at = NOW() WHERE id = ?', [newBalance, wallet.id]);
            // Mark disbursement as completed
            await connection.execute(`UPDATE disbursements 
         SET status = 'completed', tx_hash = ?, processed_at = NOW(), updated_at = NOW() 
         WHERE id = ?`, [txId, disbursementId]);
            await connection.commit();
            return { success: true, txHash: txId };
        }
        catch (error) {
            await connection.rollback();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Record failure
            await this.pool.execute('UPDATE disbursements SET status = ?, failure_reason = ?, updated_at = NOW() WHERE id = ?', ['failed', errorMessage, disbursementId]);
            return { success: false, error: errorMessage };
        }
        finally {
            connection.release();
        }
    }
    async retryFailedDisbursement(disbursementId) {
        const disbursement = await this.getDisbursement(disbursementId);
        if (!disbursement || disbursement.status !== 'failed') {
            return { success: false, error: 'Disbursement not found or not in failed state' };
        }
        // Reset to pending and process
        await this.pool.execute('UPDATE disbursements SET status = ?, failure_reason = NULL, updated_at = NOW() WHERE id = ?', ['pending', disbursementId]);
        return this.processDisbursement(disbursementId);
    }
    async createDisbursementSchedule(subscriptionId, userId, amount, roiPercentage, frequency) {
        const scheduleId = (0, uuid_1.v4)();
        const nextDisbursement = this.calculateNextDisbursement(frequency);
        await this.pool.execute(`INSERT INTO disbursement_schedules 
       (id, subscription_id, user_id, amount, roi_percentage, frequency, next_disbursement, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`, [scheduleId, subscriptionId, userId, amount, roiPercentage, frequency, nextDisbursement]);
        return {
            subscriptionId,
            nextDisbursement,
            frequency,
            amount,
            roiPercentage,
            isActive: true
        };
    }
    async getDisbursementSchedule(subscriptionId) {
        const [rows] = await this.pool.query('SELECT * FROM disbursement_schedules WHERE subscription_id = ? AND is_active = 1', [subscriptionId]);
        if (rows.length === 0)
            return null;
        const row = rows[0];
        return {
            subscriptionId: row.subscription_id,
            nextDisbursement: row.next_disbursement,
            frequency: row.frequency,
            amount: row.amount,
            roiPercentage: row.roi_percentage,
            isActive: row.is_active === 1
        };
    }
    async processDueSchedules() {
        const connection = await this.pool.getConnection();
        let processed = 0;
        let failed = 0;
        try {
            await connection.beginTransaction();
            const [schedules] = await connection.query(`SELECT * FROM disbursement_schedules 
         WHERE is_active = 1 AND next_disbursement <= NOW()`);
            for (const schedule of schedules) {
                try {
                    // Create disbursement
                    const disbursement = await this.createDisbursement({
                        subscriptionId: schedule.subscription_id,
                        userId: schedule.user_id,
                        amount: schedule.amount,
                        roiPercentage: schedule.roi_percentage,
                        period: schedule.frequency
                    });
                    // Process immediately
                    const result = await this.processDisbursement(disbursement.id);
                    if (result.success) {
                        processed++;
                    }
                    else {
                        failed++;
                    }
                    // Update schedule for next disbursement
                    const nextDisbursement = this.calculateNextDisbursement(schedule.frequency);
                    await connection.execute('UPDATE disbursement_schedules SET next_disbursement = ?, updated_at = NOW() WHERE id = ?', [nextDisbursement, schedule.id]);
                }
                catch (error) {
                    failed++;
                    console.error('Error processing schedule:', error);
                }
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            console.error('Error processing due schedules:', error);
        }
        finally {
            connection.release();
        }
        return { processed, failed };
    }
    async pauseDisbursementSchedule(subscriptionId) {
        await this.pool.execute('UPDATE disbursement_schedules SET is_active = 0, updated_at = NOW() WHERE subscription_id = ?', [subscriptionId]);
    }
    async resumeDisbursementSchedule(subscriptionId) {
        await this.pool.execute('UPDATE disbursement_schedules SET is_active = 1, updated_at = NOW() WHERE subscription_id = ?', [subscriptionId]);
    }
    async getDisbursementStats(userId) {
        const [stats] = await this.pool.query(`SELECT 
        COALESCE(SUM(amount), 0) as totalDisbursed,
        COALESCE(AVG(amount), 0) as averageAmount,
        MAX(processed_at) as lastDisbursement
       FROM disbursements 
       WHERE user_id = ? AND status = 'completed'`, [userId]);
        const [nextSchedule] = await this.pool.query(`SELECT MIN(next_disbursement) as nextScheduled 
       FROM disbursement_schedules 
       WHERE user_id = ? AND is_active = 1`, [userId]);
        return {
            totalDisbursed: parseFloat(stats[0]?.totalDisbursed || 0),
            averageAmount: parseFloat(stats[0]?.averageAmount || 0),
            lastDisbursement: stats[0]?.lastDisbursement || undefined,
            nextScheduled: nextSchedule[0]?.nextScheduled || undefined
        };
    }
    calculateNextDisbursement(frequency) {
        const next = new Date();
        switch (frequency) {
            case 'monthly':
                next.setMonth(next.getMonth() + 1);
                break;
            case 'quarterly':
                next.setMonth(next.getMonth() + 3);
                break;
            case 'annually':
                next.setFullYear(next.getFullYear() + 1);
                break;
        }
        return next;
    }
    formatDisbursement(row) {
        return {
            id: row.id,
            subscriptionId: row.subscription_id,
            userId: row.user_id,
            amount: row.amount,
            roiPercentage: row.roi_percentage,
            status: row.status,
            txHash: row.tx_hash,
            scheduledFor: row.scheduled_for,
            processedAt: row.processed_at,
            failureReason: row.failure_reason
        };
    }
}
exports.DisbursementService = DisbursementService;
//# sourceMappingURL=disbursementService.js.map