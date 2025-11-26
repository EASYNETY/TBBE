"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletTransactionModel = void 0;
const uuid_1 = require("uuid");
class WalletTransactionModel {
    constructor(pool) {
        this.pool = pool;
    }
    async createTransaction(userId, walletId, type, amount, fromAddress, toAddress, status = 'pending', description, metadata) {
        const transactionId = (0, uuid_1.v4)();
        const [wallet] = await this.pool.query('SELECT balance_usdc FROM user_wallets WHERE id = ?', [walletId]);
        const balanceBefore = wallet?.[0]?.balance_usdc || 0;
        await this.pool.execute(`INSERT INTO wallet_transactions 
       (id, user_id, wallet_id, transaction_type, amount, balance_before, 
        from_address, to_address, status, description, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`, [
            transactionId,
            userId,
            walletId,
            type,
            amount,
            balanceBefore,
            fromAddress,
            toAddress,
            status,
            description,
            metadata ? JSON.stringify(metadata) : null
        ]);
        const transaction = await this.getTransactionById(transactionId);
        if (!transaction)
            throw new Error('Failed to create transaction');
        return transaction;
    }
    async getTransactionById(transactionId) {
        const [rows] = await this.pool.query('SELECT * FROM wallet_transactions WHERE id = ?', [transactionId]);
        return rows.length > 0 ? this.formatTransaction(rows[0]) : null;
    }
    async getTransactionsByUserId(userId, limit = 50, offset = 0, types) {
        let query = 'SELECT * FROM wallet_transactions WHERE user_id = ?';
        const params = [userId];
        if (types && types.length > 0) {
            query += ` AND transaction_type IN (${types.map(() => '?').join(',')})`;
            params.push(...types);
        }
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [rows] = await this.pool.query(query, params);
        return rows.map(row => this.formatTransaction(row));
    }
    async getTransactionsByWalletId(walletId, limit = 50, offset = 0) {
        const [rows] = await this.pool.query(`SELECT * FROM wallet_transactions 
       WHERE wallet_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`, [walletId, limit, offset]);
        return rows.map(row => this.formatTransaction(row));
    }
    async getTransactionsByType(userId, type, limit = 50) {
        const [rows] = await this.pool.query(`SELECT * FROM wallet_transactions 
       WHERE user_id = ? AND transaction_type = ? 
       ORDER BY created_at DESC 
       LIMIT ?`, [userId, type, limit]);
        return rows.map(row => this.formatTransaction(row));
    }
    async getTransactionsByStatus(status, limit = 50) {
        const [rows] = await this.pool.query(`SELECT * FROM wallet_transactions 
       WHERE status = ? 
       ORDER BY created_at DESC 
       LIMIT ?`, [status, limit]);
        return rows.map(row => this.formatTransaction(row));
    }
    async updateTransactionStatus(transactionId, status, txHash) {
        await this.pool.execute(`UPDATE wallet_transactions 
       SET status = ?, tx_hash = ${txHash ? '?' : 'tx_hash'}, updated_at = NOW() 
       WHERE id = ?`, txHash ? [status, txHash, transactionId] : [status, transactionId]);
    }
    async updateTransactionBalances(transactionId, balanceBefore, balanceAfter) {
        await this.pool.execute(`UPDATE wallet_transactions 
       SET balance_before = ?, balance_after = ?, updated_at = NOW() 
       WHERE id = ?`, [balanceBefore, balanceAfter, transactionId]);
    }
    async updateTransactionMetadata(transactionId, metadata) {
        await this.pool.execute('UPDATE wallet_transactions SET metadata = ?, updated_at = NOW() WHERE id = ?', [JSON.stringify(metadata), transactionId]);
    }
    async getTransactionStats(userId) {
        const [stats] = await this.pool.query(`SELECT 
        COUNT(*) as totalTransactions,
        COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END), 0) as totalDeposited,
        COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END), 0) as totalWithdrawn,
        COALESCE(SUM(CASE WHEN transaction_type IN ('subscription_payment', 'transfer') THEN amount ELSE 0 END), 0) as totalSpent,
        COALESCE(AVG(amount), 0) as averageTransaction
       FROM wallet_transactions 
       WHERE user_id = ? AND status = 'completed'`, [userId]);
        return {
            totalTransactions: stats[0]?.totalTransactions || 0,
            totalDeposited: parseFloat(stats[0]?.totalDeposited || 0),
            totalWithdrawn: parseFloat(stats[0]?.totalWithdrawn || 0),
            totalSpent: parseFloat(stats[0]?.totalSpent || 0),
            averageTransaction: parseFloat(stats[0]?.averageTransaction || 0)
        };
    }
    async getPendingTransactions(userId) {
        const [rows] = await this.pool.query(`SELECT * FROM wallet_transactions 
       WHERE user_id = ? AND status = 'pending' 
       ORDER BY created_at ASC`, [userId]);
        return rows.map(row => this.formatTransaction(row));
    }
    async getFailedTransactions(userId) {
        const [rows] = await this.pool.query(`SELECT * FROM wallet_transactions 
       WHERE user_id = ? AND status = 'failed' 
       ORDER BY created_at DESC`, [userId]);
        return rows.map(row => this.formatTransaction(row));
    }
    async searchTransactions(userId, query, limit = 50) {
        const [rows] = await this.pool.query(`SELECT * FROM wallet_transactions 
       WHERE user_id = ? AND (
         description LIKE ? OR 
         tx_hash LIKE ? OR 
         from_address LIKE ? OR 
         to_address LIKE ?
       )
       ORDER BY created_at DESC 
       LIMIT ?`, [userId, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit]);
        return rows.map(row => this.formatTransaction(row));
    }
    formatTransaction(row) {
        if (row.metadata && typeof row.metadata === 'string') {
            return {
                ...row,
                metadata: JSON.parse(row.metadata)
            };
        }
        return row;
    }
}
exports.WalletTransactionModel = WalletTransactionModel;
//# sourceMappingURL=walletTransactionModel.js.map