"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletController = void 0;
const walletService_1 = require("../services/walletService");
const walletModel_1 = require("../models/walletModel");
class WalletController {
    constructor(pool) {
        this.pool = pool;
        this.walletService = new walletService_1.WalletService(pool);
        this.walletModel = new walletModel_1.WalletModel(pool);
    }
    // ========== Wallet Creation & Management ==========
    async createWallet(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const wallet = await this.walletService.createWalletForUser(req.user.id);
            res.status(201).json({
                success: true,
                wallet: {
                    id: wallet.id,
                    address: wallet.wallet_address,
                    balance: wallet.balance_usdc,
                    kycStatus: wallet.kyc_status,
                    createdAt: wallet.created_at
                }
            });
        }
        catch (error) {
            console.error('Create wallet error:', error);
            res.status(500).json({ error: 'Failed to create wallet' });
        }
    }
    async getWallet(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const wallet = await this.walletService.getWalletInfo(req.user.id);
            if (!wallet) {
                res.status(404).json({ error: 'Wallet not found' });
                return;
            }
            res.json({
                success: true,
                wallet: {
                    id: wallet.id,
                    address: wallet.wallet_address,
                    balance: wallet.balance_usdc,
                    kycStatus: wallet.kyc_status,
                    kycVerifiedAt: wallet.kyc_verified_at,
                    nonce: wallet.nonce,
                    createdAt: wallet.created_at,
                    updatedAt: wallet.updated_at
                }
            });
        }
        catch (error) {
            console.error('Get wallet error:', error);
            res.status(500).json({ error: 'Failed to fetch wallet' });
        }
    }
    async getBalance(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const balance = await this.walletService.getWalletBalance(req.user.id);
            if (!balance) {
                res.status(404).json({ error: 'Wallet not found' });
                return;
            }
            res.json({
                success: true,
                balance: {
                    walletId: balance.walletId,
                    address: balance.address,
                    balanceUsdc: balance.balanceUsdc,
                    kycStatus: balance.kycStatus,
                    nonce: balance.nonce
                }
            });
        }
        catch (error) {
            console.error('Get balance error:', error);
            res.status(500).json({ error: 'Failed to fetch balance' });
        }
    }
    // ========== Deposit Handling ==========
    async initiateDeposit(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { amount, sourceAddress } = req.body;
            if (!amount || !sourceAddress) {
                res.status(400).json({ error: 'Missing required fields: amount, sourceAddress' });
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                res.status(400).json({ error: 'Amount must be a positive number' });
                return;
            }
            const deposit = await this.walletService.initiateDeposit(req.user.id, parseFloat(amount), sourceAddress);
            res.status(201).json({
                success: true,
                deposit: {
                    depositId: deposit.depositId,
                    depositAddress: deposit.depositAddress,
                    status: 'pending',
                    instructions: `Send ${amount} USDC from ${sourceAddress} to ${deposit.depositAddress}. Your balance will be updated once the transaction is confirmed.`
                }
            });
        }
        catch (error) {
            console.error('Initiate deposit error:', error);
            res.status(500).json({ error: error.message || 'Failed to initiate deposit' });
        }
    }
    async confirmDeposit(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { depositId, txHash, amount } = req.body;
            if (!depositId || !txHash) {
                res.status(400).json({ error: 'Missing required fields: depositId, txHash' });
                return;
            }
            await this.walletService.confirmDeposit(depositId, txHash, amount);
            res.json({
                success: true,
                message: 'Deposit confirmed successfully',
                depositId
            });
        }
        catch (error) {
            console.error('Confirm deposit error:', error);
            res.status(500).json({ error: error.message || 'Failed to confirm deposit' });
        }
    }
    // ========== Withdrawal Handling ==========
    async requestWithdrawal(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { amount, destinationAddress } = req.body;
            if (!amount || !destinationAddress) {
                res.status(400).json({ error: 'Missing required fields: amount, destinationAddress' });
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                res.status(400).json({ error: 'Amount must be a positive number' });
                return;
            }
            if (!destinationAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
                res.status(400).json({ error: 'Invalid Ethereum address' });
                return;
            }
            const result = await this.walletService.requestWithdrawal(req.user.id, parseFloat(amount), destinationAddress);
            if (result.requiresKYC) {
                res.status(202).json({
                    success: true,
                    withdrawalId: result.withdrawalId,
                    status: 'pending_kyc',
                    message: 'Withdrawal request created. KYC verification is required before processing.'
                });
            }
            else {
                res.status(201).json({
                    success: true,
                    withdrawalId: result.withdrawalId,
                    status: 'approved',
                    message: 'Withdrawal approved and will be processed shortly.'
                });
            }
        }
        catch (error) {
            console.error('Request withdrawal error:', error);
            res.status(400).json({ error: error.message || 'Failed to request withdrawal' });
        }
    }
    async approveWithdrawal(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            // Check if user is admin
            if (!['admin', 'super-admin'].includes(req.user.role)) {
                res.status(403).json({ error: 'Admin access required' });
                return;
            }
            const { withdrawalId, txHash } = req.body;
            if (!withdrawalId) {
                res.status(400).json({ error: 'Missing required field: withdrawalId' });
                return;
            }
            await this.walletService.approveWithdrawal(withdrawalId, txHash);
            res.json({
                success: true,
                message: 'Withdrawal approved and processed',
                withdrawalId
            });
        }
        catch (error) {
            console.error('Approve withdrawal error:', error);
            res.status(500).json({ error: error.message || 'Failed to approve withdrawal' });
        }
    }
    async rejectWithdrawal(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            // Check if user is admin
            if (!['admin', 'super-admin'].includes(req.user.role)) {
                res.status(403).json({ error: 'Admin access required' });
                return;
            }
            const { withdrawalId, reason } = req.body;
            if (!withdrawalId || !reason) {
                res.status(400).json({ error: 'Missing required fields: withdrawalId, reason' });
                return;
            }
            await this.walletService.rejectWithdrawal(withdrawalId, reason);
            res.json({
                success: true,
                message: 'Withdrawal rejected',
                withdrawalId
            });
        }
        catch (error) {
            console.error('Reject withdrawal error:', error);
            res.status(500).json({ error: error.message || 'Failed to reject withdrawal' });
        }
    }
    // ========== Internal Transfers ==========
    async transferBetweenWallets(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { toUserId, amount, reason } = req.body;
            if (!toUserId || !amount) {
                res.status(400).json({ error: 'Missing required fields: toUserId, amount' });
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                res.status(400).json({ error: 'Amount must be a positive number' });
                return;
            }
            const result = await this.walletService.transferBetweenWallets(req.user.id, toUserId, parseFloat(amount), reason || 'Internal transfer');
            res.json({
                success: true,
                transaction: {
                    transactionId: result.transactionId,
                    status: result.status,
                    amount: parseFloat(amount),
                    balanceBefore: result.balanceBefore,
                    balanceAfter: result.balanceAfter
                }
            });
        }
        catch (error) {
            console.error('Transfer error:', error);
            res.status(400).json({ error: error.message || 'Failed to complete transfer' });
        }
    }
    // ========== Transaction History ==========
    async getTransactionHistory(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { limit = '50', offset = '0' } = req.query;
            const limitNum = Math.min(parseInt(limit) || 50, 100);
            const offsetNum = parseInt(offset) || 0;
            const transactions = await this.walletService.getTransactionHistory(req.user.id, limitNum, offsetNum);
            res.json({
                success: true,
                transactions: transactions.map(tx => ({
                    id: tx.id,
                    type: tx.transaction_type,
                    amount: tx.amount,
                    status: tx.status,
                    from: tx.from_address,
                    to: tx.to_address,
                    txHash: tx.tx_hash,
                    description: tx.description,
                    createdAt: tx.created_at
                }))
            });
        }
        catch (error) {
            console.error('Get transaction history error:', error);
            res.status(500).json({ error: 'Failed to fetch transaction history' });
        }
    }
    // ========== Transaction Summary ==========
    async getTransactionSummary(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const summary = await this.walletService.getTransactionSummary(req.user.id);
            res.json({
                success: true,
                summary
            });
        }
        catch (error) {
            console.error('Get transaction summary error:', error);
            res.status(500).json({ error: 'Failed to fetch transaction summary' });
        }
    }
    // ========== Wallet Summary ==========
    async getWalletSummary(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const summary = await this.walletService.getWalletSummary(req.user.id);
            if (!summary) {
                res.status(404).json({ error: 'Wallet not found' });
                return;
            }
            res.json({
                success: true,
                summary: {
                    wallet: summary.wallet,
                    recentTransactions: summary.recentTransactions,
                    deposits: summary.deposits,
                    withdrawals: summary.withdrawals,
                    kyc: summary.kyc
                }
            });
        }
        catch (error) {
            console.error('Get wallet summary error:', error);
            res.status(500).json({ error: 'Failed to fetch wallet summary' });
        }
    }
    // ========== External Wallet Withdrawal ==========
    async withdrawToExternalWallet(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { amount, destinationAddress, currency = 'USDC' } = req.body;
            // Validate inputs
            if (!amount || !destinationAddress) {
                res.status(400).json({ error: 'Missing required fields: amount, destinationAddress' });
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                res.status(400).json({ error: 'Amount must be a positive number' });
                return;
            }
            // Validate Ethereum address format
            if (!destinationAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
                res.status(400).json({ error: 'Invalid Ethereum address format' });
                return;
            }
            // Check KYC status
            const wallet = await this.walletService.getWalletInfo(req.user.id);
            if (!wallet || wallet.kyc_status !== 'verified') {
                res.status(403).json({ error: 'KYC verification required for withdrawals' });
                return;
            }
            // Check balance
            const balance = await this.walletService.getWalletBalance(req.user.id);
            if (!balance || balance.balanceUsdc < amount) {
                res.status(400).json({ error: 'Insufficient balance' });
                return;
            }
            // Initiate withdrawal to external wallet
            const result = await this.walletService.requestWithdrawal(req.user.id, parseFloat(amount), destinationAddress);
            res.status(201).json({
                success: true,
                withdrawal: {
                    withdrawalId: result.withdrawalId,
                    amount: parseFloat(amount),
                    currency,
                    destinationAddress: destinationAddress.substring(0, 6) + '...' + destinationAddress.substring(38),
                    status: result.requiresKYC ? 'pending_approval' : 'processing',
                    createdAt: new Date().toISOString(),
                    estimatedTime: '1-2 business days'
                }
            });
        }
        catch (error) {
            console.error('Withdrawal to external wallet error:', error);
            res.status(500).json({ error: error.message || 'Failed to process withdrawal' });
        }
    }
    async getWithdrawalStatus(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { withdrawalId } = req.params;
            if (!withdrawalId) {
                res.status(400).json({ error: 'Missing required parameter: withdrawalId' });
                return;
            }
            // Query withdrawal status from database
            const withdrawal = await this.walletModel.getWithdrawalRequest(withdrawalId);
            if (!withdrawal) {
                res.status(404).json({ error: 'Withdrawal not found' });
                return;
            }
            // Check user authorization
            if (withdrawal.user_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
                res.status(403).json({ error: 'Unauthorized' });
                return;
            }
            res.json({
                success: true,
                withdrawal: {
                    id: withdrawal.id,
                    amount: withdrawal.amount,
                    destinationAddress: withdrawal.destination_address,
                    status: withdrawal.status,
                    txHash: withdrawal.tx_hash,
                    createdAt: withdrawal.created_at,
                    completedAt: withdrawal.completed_at,
                    reason: withdrawal.rejection_reason
                }
            });
        }
        catch (error) {
            console.error('Get withdrawal status error:', error);
            res.status(500).json({ error: 'Failed to fetch withdrawal status' });
        }
    }
    async getWithdrawalLimits(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            // Return withdrawal limits based on KYC tier
            const wallet = await this.walletService.getWalletInfo(req.user.id);
            const limits = {
                perTransaction: 50000, // Max per single withdrawal
                daily: 100000, // Max per day
                monthly: 500000, // Max per month
                kycTier: wallet?.kyc_status || 'unverified',
                used24h: 0, // Would be queried from DB
                used30d: 0 // Would be queried from DB
            };
            res.json({
                success: true,
                limits
            });
        }
        catch (error) {
            console.error('Get withdrawal limits error:', error);
            res.status(500).json({ error: 'Failed to fetch withdrawal limits' });
        }
    }
    async getWithdrawalFees(req, res) {
        try {
            const fees = {
                networkFee: 0.01, // 1% network fee
                minFee: 1, // Minimum $1
                maxFee: 100, // Maximum $100
                processingTime: '1-2 business days',
                networks: {
                    ethereum: { fee: 0.01, minAmount: 10 },
                    polygon: { fee: 0.005, minAmount: 5 },
                    base: { fee: 0.005, minAmount: 5 }
                }
            };
            res.json({
                success: true,
                fees
            });
        }
        catch (error) {
            console.error('Get withdrawal fees error:', error);
            res.status(500).json({ error: 'Failed to fetch withdrawal fees' });
        }
    }
    async linkExternalWallet(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { walletAddress, signature, message } = req.body;
            if (!walletAddress || !signature || !message) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            // Verify wallet ownership by signature
            // TODO: Implement signature verification logic
            // Link wallet to user account
            await this.walletModel.linkExternalWallet(req.user.id, walletAddress);
            res.json({
                success: true,
                message: 'Wallet linked successfully',
                walletAddress
            });
        }
        catch (error) {
            console.error('Link wallet error:', error);
            res.status(500).json({ error: error.message || 'Failed to link wallet' });
        }
    }
    async getLinkedWallets(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const linkedWallets = await this.walletModel.getLinkedWallets(req.user.id);
            res.json({
                success: true,
                wallets: linkedWallets.map((w) => ({
                    id: w.id,
                    address: w.wallet_address,
                    linkedAt: w.created_at,
                    isPrimary: w.is_primary
                }))
            });
        }
        catch (error) {
            console.error('Get linked wallets error:', error);
            res.status(500).json({ error: 'Failed to fetch linked wallets' });
        }
    }
}
exports.WalletController = WalletController;
//# sourceMappingURL=walletController.js.map