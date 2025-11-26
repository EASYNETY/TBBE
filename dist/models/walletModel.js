"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletModel = void 0;
const uuid_1 = require("uuid");
class WalletModel {
    constructor(pool) {
        this.pool = pool;
    }
    // ========== User Wallet Operations ==========
    async createWallet(userId, walletAddress) {
        const walletId = (0, uuid_1.v4)();
        const connection = await this.pool.getConnection();
        try {
            const [result] = await connection.execute(`INSERT INTO user_wallets (id, user_id, wallet_address, balance_usdc, kyc_status)
         VALUES (?, ?, ?, 0, 'pending')`, [walletId, userId, walletAddress]);
            const wallet = await this.getWalletById(walletId);
            if (!wallet)
                throw new Error('Failed to create wallet');
            return wallet;
        }
        finally {
            connection.release();
        }
    }
    async getWalletById(walletId) {
        const [rows] = await this.pool.query('SELECT * FROM user_wallets WHERE id = ?', [walletId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getWalletByUserId(userId) {
        const [rows] = await this.pool.query('SELECT * FROM user_wallets WHERE user_id = ?', [userId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getWalletByAddress(address) {
        const [rows] = await this.pool.query('SELECT * FROM user_wallets WHERE wallet_address = ?', [address]);
        return rows.length > 0 ? rows[0] : null;
    }
    async updateWalletBalance(walletId, newBalance) {
        await this.pool.execute('UPDATE user_wallets SET balance_usdc = ? WHERE id = ?', [newBalance, walletId]);
    }
    async incrementWalletBalance(walletId, amount) {
        const connection = await this.pool.getConnection();
        try {
            const wallet = await this.getWalletById(walletId);
            if (!wallet)
                throw new Error('Wallet not found');
            const newBalance = wallet.balance_usdc + amount;
            await connection.execute('UPDATE user_wallets SET balance_usdc = ? WHERE id = ?', [newBalance, walletId]);
            return newBalance;
        }
        finally {
            connection.release();
        }
    }
    async decrementWalletBalance(walletId, amount) {
        const connection = await this.pool.getConnection();
        try {
            const wallet = await this.getWalletById(walletId);
            if (!wallet)
                throw new Error('Wallet not found');
            if (wallet.balance_usdc < amount) {
                throw new Error('Insufficient balance');
            }
            const newBalance = wallet.balance_usdc - amount;
            await connection.execute('UPDATE user_wallets SET balance_usdc = ? WHERE id = ?', [newBalance, walletId]);
            return newBalance;
        }
        finally {
            connection.release();
        }
    }
    async incrementNonce(walletId) {
        const [result] = await this.pool.execute('UPDATE user_wallets SET nonce = nonce + 1 WHERE id = ? RETURNING nonce', [walletId]);
        const wallet = await this.getWalletById(walletId);
        return wallet?.nonce || 0;
    }
    // ========== Transaction Operations ==========
    async createTransaction(userId, walletId, type, amount, fromAddress, toAddress, description, metadata) {
        const transactionId = (0, uuid_1.v4)();
        const wallet = await this.getWalletById(walletId);
        if (!wallet)
            throw new Error('Wallet not found');
        await this.pool.execute(`INSERT INTO wallet_transactions 
       (id, user_id, wallet_id, transaction_type, amount, balance_before, from_address, to_address, status, description, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`, [
            transactionId,
            userId,
            walletId,
            type,
            amount,
            wallet.balance_usdc,
            fromAddress,
            toAddress,
            description,
            metadata ? JSON.stringify(metadata) : null
        ]);
        const transaction = await this.getTransactionById(transactionId);
        if (!transaction)
            throw new Error('Failed to create transaction');
        return transaction;
    }
    async getTransactionById(txId) {
        const [rows] = await this.pool.query('SELECT * FROM wallet_transactions WHERE id = ?', [txId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getTransactionsByWalletId(walletId, limit = 50, offset = 0) {
        const [rows] = await this.pool.query(`SELECT * FROM wallet_transactions 
       WHERE wallet_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`, [walletId, limit, offset]);
        return rows;
    }
    async getTransactionsByUserId(userId, limit = 50, offset = 0) {
        const [rows] = await this.pool.query(`SELECT * FROM wallet_transactions 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`, [userId, limit, offset]);
        return rows;
    }
    async updateTransactionStatus(txId, status, txHash) {
        if (txHash) {
            await this.pool.execute('UPDATE wallet_transactions SET status = ?, tx_hash = ? WHERE id = ?', [status, txHash, txId]);
        }
        else {
            await this.pool.execute('UPDATE wallet_transactions SET status = ? WHERE id = ?', [status, txId]);
        }
    }
    async updateTransactionBalances(txId, balanceBefore, balanceAfter) {
        await this.pool.execute('UPDATE wallet_transactions SET balance_before = ?, balance_after = ? WHERE id = ?', [balanceBefore, balanceAfter, txId]);
    }
    // ========== Deposit Operations ==========
    async createDeposit(userId, walletId, amount, sourceAddress, depositAddress) {
        const depositId = (0, uuid_1.v4)();
        await this.pool.execute(`INSERT INTO wallet_deposits 
       (id, user_id, wallet_id, amount, source_address, deposit_address, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`, [depositId, userId, walletId, amount, sourceAddress, depositAddress]);
        const deposit = await this.getDepositById(depositId);
        if (!deposit)
            throw new Error('Failed to create deposit');
        return deposit;
    }
    async getDepositById(depositId) {
        const [rows] = await this.pool.query('SELECT * FROM wallet_deposits WHERE id = ?', [depositId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getDepositsByWalletId(walletId) {
        const [rows] = await this.pool.query('SELECT * FROM wallet_deposits WHERE wallet_id = ? ORDER BY created_at DESC', [walletId]);
        return rows;
    }
    async updateDepositStatus(depositId, status, txHash, confirmations) {
        if (txHash && confirmations !== undefined) {
            await this.pool.execute('UPDATE wallet_deposits SET status = ?, tx_hash = ?, confirmations = ? WHERE id = ?', [status, txHash, confirmations, depositId]);
        }
        else if (txHash) {
            await this.pool.execute('UPDATE wallet_deposits SET status = ?, tx_hash = ? WHERE id = ?', [status, txHash, depositId]);
        }
        else {
            await this.pool.execute('UPDATE wallet_deposits SET status = ? WHERE id = ?', [status, depositId]);
        }
    }
    // ========== KYC Operations ==========
    async createKYCVerification(userId, provider, providerId) {
        const verificationId = (0, uuid_1.v4)();
        const wallet = await this.getWalletByUserId(userId);
        await this.pool.execute(`INSERT INTO kyc_verifications 
       (id, user_id, wallet_id, provider, provider_id, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`, [verificationId, userId, wallet?.id || null, provider, providerId]);
        const verification = await this.getKYCVerification(verificationId);
        if (!verification)
            throw new Error('Failed to create KYC verification');
        return verification;
    }
    async getKYCVerification(verificationId) {
        const [rows] = await this.pool.query('SELECT * FROM kyc_verifications WHERE id = ?', [verificationId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getKYCByUserId(userId) {
        const [rows] = await this.pool.query('SELECT * FROM kyc_verifications WHERE user_id = ?', [userId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async updateKYCStatus(verificationId, status, kycData, rejectionReason) {
        const query = `UPDATE kyc_verifications SET status = ?, 
                   kyc_data = ${kycData ? '?' : 'kyc_data'}, 
                   verification_date = ${status === 'approved' ? 'NOW()' : 'verification_date'},
                   rejection_reason = ${rejectionReason ? '?' : 'rejection_reason'}
                   WHERE id = ?`;
        const params = [status];
        if (kycData)
            params.push(JSON.stringify(kycData));
        if (rejectionReason)
            params.push(rejectionReason);
        params.push(verificationId);
        await this.pool.execute(query, params);
    }
    async markKYCVerified(userId, walletId) {
        const connection = await this.pool.getConnection();
        try {
            // Update wallet KYC status
            await connection.execute('UPDATE user_wallets SET kyc_status = ?, kyc_verified_at = NOW() WHERE id = ?', ['verified', walletId]);
            // Update user KYC status
            await connection.execute('UPDATE users SET kyc_status = ?, kyc_verified_at = NOW() WHERE id = ?', ['verified', userId]);
            // Update KYC verification record
            const kyc = await this.getKYCByUserId(userId);
            if (kyc) {
                await connection.execute('UPDATE kyc_verifications SET status = ?, verification_date = NOW() WHERE id = ?', ['approved', kyc.id]);
            }
        }
        finally {
            connection.release();
        }
    }
    // ========== Withdrawal Operations ==========
    async createWithdrawalRequest(userId, walletId, amount, destinationAddress) {
        const requestId = (0, uuid_1.v4)();
        await this.pool.execute(`INSERT INTO withdrawal_requests 
       (id, user_id, wallet_id, amount, destination_address, status, requires_kyc)
       VALUES (?, ?, ?, ?, ?, 'pending', TRUE)`, [requestId, userId, walletId, amount, destinationAddress]);
        const request = await this.getWithdrawalRequest(requestId);
        if (!request)
            throw new Error('Failed to create withdrawal request');
        return request;
    }
    async getWithdrawalRequest(requestId) {
        const [rows] = await this.pool.query('SELECT * FROM withdrawal_requests WHERE id = ?', [requestId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getWithdrawalsByUserId(userId) {
        const [rows] = await this.pool.query('SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        return rows;
    }
    async updateWithdrawalStatus(requestId, status, txHash, rejectionReason) {
        const query = `UPDATE withdrawal_requests 
                   SET status = ?, 
                       tx_hash = ${txHash ? '?' : 'tx_hash'},
                       rejection_reason = ${rejectionReason ? '?' : 'rejection_reason'},
                       completed_at = ${status === 'completed' ? 'NOW()' : 'completed_at'}
                   WHERE id = ?`;
        const params = [status];
        if (txHash)
            params.push(txHash);
        if (rejectionReason)
            params.push(rejectionReason);
        params.push(requestId);
        await this.pool.execute(query, params);
    }
    async markWithdrawalKYCVerified(requestId) {
        await this.pool.execute('UPDATE withdrawal_requests SET kyc_verified = TRUE WHERE id = ?', [requestId]);
    }
    // ========== External Wallet Linking ==========
    async linkExternalWallet(userId, walletAddress) {
        const linkId = (0, uuid_1.v4)();
        try {
            await this.pool.execute(`INSERT INTO external_wallets (id, user_id, wallet_address, created_at)
         VALUES (?, ?, ?, NOW())`, [linkId, userId, walletAddress]);
        }
        catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                // Wallet already linked, just return
                return;
            }
            throw error;
        }
    }
    async getLinkedWallets(userId) {
        const [rows] = await this.pool.query('SELECT id, wallet_address, is_primary, created_at FROM external_wallets WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC', [userId]);
        return rows;
    }
    async unlinkExternalWallet(userId, walletAddress) {
        await this.pool.execute('DELETE FROM external_wallets WHERE user_id = ? AND wallet_address = ?', [userId, walletAddress]);
    }
    async getPrimaryExternalWallet(userId) {
        const [rows] = await this.pool.query('SELECT id, wallet_address FROM external_wallets WHERE user_id = ? AND is_primary = TRUE LIMIT 1', [userId]);
        return rows.length > 0 ? rows[0] : null;
    }
}
exports.WalletModel = WalletModel;
//# sourceMappingURL=walletModel.js.map