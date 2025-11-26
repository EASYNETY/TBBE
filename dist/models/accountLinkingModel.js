"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountLinkingModel = void 0;
const uuid_1 = require("uuid");
class AccountLinkingModel {
    constructor(pool) {
        this.pool = pool;
    }
    async linkWalletToAccount(userId, smartAccountAddress, walletAddress, isPrimary = false) {
        const linkId = (0, uuid_1.v4)();
        const verificationCode = this.generateVerificationCode();
        await this.pool.execute(`INSERT INTO account_links 
       (id, user_id, smart_account_address, wallet_address, is_primary, 
        status, verification_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())`, [linkId, userId, smartAccountAddress, walletAddress, isPrimary ? 1 : 0, verificationCode]);
        const link = await this.getLinkById(linkId);
        if (!link)
            throw new Error('Failed to create account link');
        return link;
    }
    async getLinkById(linkId) {
        const [rows] = await this.pool.query('SELECT * FROM account_links WHERE id = ?', [linkId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getLinksByUserId(userId) {
        const [rows] = await this.pool.query('SELECT * FROM account_links WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC', [userId]);
        return rows;
    }
    async getPrimaryLink(userId) {
        const [rows] = await this.pool.query('SELECT * FROM account_links WHERE user_id = ? AND is_primary = 1 AND status = "active"', [userId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getLinkBySmartAccount(smartAccountAddress) {
        const [rows] = await this.pool.query('SELECT * FROM account_links WHERE smart_account_address = ? AND status = "active" LIMIT 1', [smartAccountAddress]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getLinkByWalletAddress(walletAddress) {
        const [rows] = await this.pool.query('SELECT * FROM account_links WHERE wallet_address = ? AND status = "active" LIMIT 1', [walletAddress]);
        return rows.length > 0 ? rows[0] : null;
    }
    async verifyLink(linkId, verificationCode) {
        const link = await this.getLinkById(linkId);
        if (!link || link.verification_code !== verificationCode) {
            return false;
        }
        await this.pool.execute('UPDATE account_links SET status = ?, verified_at = NOW(), updated_at = NOW() WHERE id = ?', ['active', linkId]);
        return true;
    }
    async setPrimaryLink(userId, linkId) {
        const connection = await this.pool.getConnection();
        try {
            // Remove primary from all other links
            await connection.execute('UPDATE account_links SET is_primary = 0 WHERE user_id = ? AND id != ?', [userId, linkId]);
            // Set this link as primary
            await connection.execute('UPDATE account_links SET is_primary = 1, updated_at = NOW() WHERE id = ? AND user_id = ?', [linkId, userId]);
        }
        finally {
            connection.release();
        }
    }
    async updateLinkStatus(linkId, status) {
        await this.pool.execute('UPDATE account_links SET status = ?, updated_at = NOW() WHERE id = ?', [status, linkId]);
    }
    async deactivateLink(linkId) {
        await this.updateLinkStatus(linkId, 'inactive');
    }
    async recordLinkingHistory(linkId, action, performedBy, ipAddress, userAgent, status = 'success') {
        const historyId = (0, uuid_1.v4)();
        await this.pool.execute(`INSERT INTO account_linking_history 
       (id, account_link_id, action, performed_by, ip_address, user_agent, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`, [historyId, linkId, action, performedBy, ipAddress, userAgent, status]);
    }
    async getLinkingHistory(linkId, limit = 50) {
        const [rows] = await this.pool.query(`SELECT * FROM account_linking_history 
       WHERE account_link_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`, [linkId, limit]);
        return rows;
    }
    generateVerificationCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
}
exports.AccountLinkingModel = AccountLinkingModel;
//# sourceMappingURL=accountLinkingModel.js.map