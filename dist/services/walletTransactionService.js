"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletTransactionService = void 0;
const walletTransactionModel_1 = require("../models/walletTransactionModel");
const walletModel_1 = require("../models/walletModel");
class WalletTransactionService {
    constructor(pool) {
        this.pool = pool;
        this.transactionModel = new walletTransactionModel_1.WalletTransactionModel(pool);
        this.walletModel = new walletModel_1.WalletModel(pool);
    }
    async recordDeposit(userId, walletId, amount, fromAddress, toAddress, txHash, metadata) {
        const transaction = await this.transactionModel.createTransaction(userId, walletId, 'deposit', amount, fromAddress, toAddress, txHash ? 'completed' : 'pending', `USDC deposit of ${amount}`, metadata);
        if (txHash) {
            await this.transactionModel.updateTransactionStatus(transaction.id, 'completed', txHash);
        }
        return this.formatTransactionDetails(transaction);
    }
    async recordWithdrawal(userId, walletId, amount, fromAddress, toAddress, txHash, metadata) {
        const transaction = await this.transactionModel.createTransaction(userId, walletId, 'withdrawal', amount, fromAddress, toAddress, txHash ? 'completed' : 'pending', `USDC withdrawal of ${amount}`, metadata);
        if (txHash) {
            await this.transactionModel.updateTransactionStatus(transaction.id, 'completed', txHash);
        }
        return this.formatTransactionDetails(transaction);
    }
    async recordTransfer(userId, walletId, amount, fromAddress, toAddress, metadata) {
        const transaction = await this.transactionModel.createTransaction(userId, walletId, 'transfer', amount, fromAddress, toAddress, 'completed', `Internal transfer of ${amount}`, metadata);
        return this.formatTransactionDetails(transaction);
    }
    async recordSubscriptionPayment(userId, walletId, amount, fromAddress, toAddress, subscriptionId, metadata) {
        const fullMetadata = {
            subscriptionId,
            ...metadata
        };
        const transaction = await this.transactionModel.createTransaction(userId, walletId, 'subscription_payment', amount, fromAddress, toAddress, 'completed', `Subscription payment for ${subscriptionId}`, fullMetadata);
        return this.formatTransactionDetails(transaction);
    }
    async recordROIDisbursement(userId, walletId, amount, subscriptionId, roiPercentage, metadata) {
        const wallet = await this.walletModel.getWalletById(walletId);
        if (!wallet)
            throw new Error('Wallet not found');
        const fullMetadata = {
            subscriptionId,
            roiPercentage,
            disbursementDate: new Date().toISOString(),
            ...metadata
        };
        const transaction = await this.transactionModel.createTransaction(userId, walletId, 'roi_disbursement', amount, 'system', wallet.wallet_address, 'completed', `ROI disbursement (${roiPercentage}%) for subscription`, fullMetadata);
        return this.formatTransactionDetails(transaction);
    }
    async recordRefund(userId, walletId, amount, fromAddress, toAddress, reason, metadata) {
        const fullMetadata = {
            reason,
            ...metadata
        };
        const transaction = await this.transactionModel.createTransaction(userId, walletId, 'refund', amount, fromAddress, toAddress, 'completed', `Refund: ${reason}`, fullMetadata);
        return this.formatTransactionDetails(transaction);
    }
    async getTransactionHistory(userId, limit = 50, offset = 0, types) {
        const transactions = await this.transactionModel.getTransactionsByUserId(userId, limit, offset, types);
        return transactions.map(tx => this.formatTransactionDetails(tx));
    }
    async getRecentTransactions(userId, days = 30) {
        const transactions = await this.transactionModel.getTransactionsByUserId(userId, 1000, 0);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        return transactions
            .filter(tx => new Date(tx.created_at) >= cutoffDate)
            .map(tx => this.formatTransactionDetails(tx))
            .slice(0, 50);
    }
    async getPendingTransactions(userId) {
        const transactions = await this.transactionModel.getPendingTransactions(userId);
        return transactions.map(tx => this.formatTransactionDetails(tx));
    }
    async getFailedTransactions(userId) {
        const transactions = await this.transactionModel.getFailedTransactions(userId);
        return transactions.map(tx => this.formatTransactionDetails(tx));
    }
    async searchTransactions(userId, query) {
        const transactions = await this.transactionModel.searchTransactions(userId, query);
        return transactions.map(tx => this.formatTransactionDetails(tx));
    }
    async getTransactionSummary(userId) {
        const [stats, recentTransactions] = await Promise.all([
            this.transactionModel.getTransactionStats(userId),
            this.transactionModel.getTransactionsByUserId(userId, 10, 0)
        ]);
        return {
            totalTransactions: stats.totalTransactions,
            totalDeposited: stats.totalDeposited,
            totalWithdrawn: stats.totalWithdrawn,
            totalSpent: stats.totalSpent,
            averageTransaction: stats.averageTransaction,
            recentTransactions: recentTransactions.map(tx => this.formatTransactionDetails(tx))
        };
    }
    async getTransactionsByType(userId, type) {
        const transactions = await this.transactionModel.getTransactionsByType(userId, type);
        return transactions.map(tx => this.formatTransactionDetails(tx));
    }
    async updateTransactionStatus(transactionId, status, txHash) {
        await this.transactionModel.updateTransactionStatus(transactionId, status, txHash);
    }
    async recordTransactionMetadata(transactionId, metadata) {
        await this.transactionModel.updateTransactionMetadata(transactionId, metadata);
    }
    formatTransactionDetails(transaction) {
        return {
            id: transaction.id,
            type: transaction.transaction_type,
            amount: transaction.amount,
            fromAddress: transaction.from_address,
            toAddress: transaction.to_address,
            status: transaction.status,
            description: transaction.description,
            txHash: transaction.tx_hash,
            balanceBefore: transaction.balance_before,
            balanceAfter: transaction.balance_after,
            createdAt: transaction.created_at
        };
    }
}
exports.WalletTransactionService = WalletTransactionService;
//# sourceMappingURL=walletTransactionService.js.map