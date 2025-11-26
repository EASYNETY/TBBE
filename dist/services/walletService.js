"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const ethers_1 = require("ethers");
const uuid_1 = require("uuid");
const walletModel_1 = require("../models/walletModel");
const walletTransactionModel_1 = require("../models/walletTransactionModel");
class WalletService {
    constructor(pool, rpcUrl) {
        this.pool = pool;
        this.USDC_CONTRACT = process.env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base mainnet USDC
        this.walletModel = new walletModel_1.WalletModel(pool);
        this.transactionModel = new walletTransactionModel_1.WalletTransactionModel(pool);
        this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl || process.env.BASE_RPC_URL || 'https://mainnet.base.org');
    }
    // ========== Wallet Creation & Management ==========
    async createWalletForUser(userId) {
        // Check if wallet already exists
        const existingWallet = await this.walletModel.getWalletByUserId(userId);
        if (existingWallet) {
            return existingWallet;
        }
        // Create new random wallet
        const newWallet = ethers_1.ethers.Wallet.createRandom();
        const wallet = await this.walletModel.createWallet(userId, newWallet.address);
        return wallet;
    }
    async getWalletBalance(userId) {
        let wallet = await this.walletModel.getWalletByUserId(userId);
        // Auto-create wallet if it doesn't exist
        if (!wallet) {
            try {
                wallet = await this.createWalletForUser(userId);
            }
            catch (error) {
                console.error('Failed to auto-create wallet:', error);
                return null;
            }
        }
        return {
            walletId: wallet.id,
            address: wallet.wallet_address,
            balanceUsdc: wallet.balance_usdc,
            kycStatus: wallet.kyc_status,
            nonce: wallet.nonce
        };
    }
    async getWalletInfo(userId) {
        return this.walletModel.getWalletByUserId(userId);
    }
    // ========== Internal Transfers ==========
    async transferBetweenWallets(fromUserId, toUserId, amount, reason = 'internal_transfer') {
        const fromWallet = await this.walletModel.getWalletByUserId(fromUserId);
        const toWallet = await this.walletModel.getWalletByUserId(toUserId);
        if (!fromWallet || !toWallet) {
            throw new Error('One or both wallets not found');
        }
        if (fromWallet.balance_usdc < amount) {
            throw new Error('Insufficient balance');
        }
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const balanceBefore = fromWallet.balance_usdc;
            // Deduct from sender
            const fromNewBalance = await this.walletModel.decrementWalletBalance(fromWallet.id, amount);
            // Add to recipient
            const toNewBalance = await this.walletModel.incrementWalletBalance(toWallet.id, amount);
            // Create transaction record for sender
            const txId = (0, uuid_1.v4)();
            await connection.execute(`INSERT INTO wallet_transactions 
         (id, user_id, wallet_id, transaction_type, amount, balance_before, balance_after, from_address, to_address, status, description)
         VALUES (?, ?, ?, 'internal_transfer', ?, ?, ?, ?, ?, 'completed', ?)`, [
                txId,
                fromUserId,
                fromWallet.id,
                amount,
                balanceBefore,
                fromNewBalance,
                fromWallet.wallet_address,
                toWallet.wallet_address,
                reason
            ]);
            // Create transaction record for recipient
            const toTxId = (0, uuid_1.v4)();
            await connection.execute(`INSERT INTO wallet_transactions 
         (id, user_id, wallet_id, transaction_type, amount, balance_before, balance_after, from_address, to_address, status, description)
         VALUES (?, ?, ?, 'internal_transfer', ?, ?, ?, ?, ?, 'completed', ?)`, [
                toTxId,
                toUserId,
                toWallet.id,
                amount,
                toWallet.balance_usdc,
                toNewBalance,
                fromWallet.wallet_address,
                toWallet.wallet_address,
                reason
            ]);
            await connection.commit();
            return {
                transactionId: txId,
                status: 'completed',
                balanceBefore,
                balanceAfter: fromNewBalance
            };
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    // ========== ROI Disbursement ==========
    async disburseROI(userId, amount, subscriptionId, roiPercentage) {
        const wallet = await this.walletModel.getWalletByUserId(userId);
        if (!wallet) {
            throw new Error('User wallet not found');
        }
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const balanceBefore = wallet.balance_usdc;
            const newBalance = await this.walletModel.incrementWalletBalance(wallet.id, amount);
            // Create disbursement transaction
            const txId = (0, uuid_1.v4)();
            await connection.execute(`INSERT INTO wallet_transactions 
         (id, user_id, wallet_id, transaction_type, amount, balance_before, balance_after, 
          from_address, to_address, status, description, metadata)
         VALUES (?, ?, ?, 'roi_disbursement', ?, ?, ?, ?, ?, 'completed', ?, ?)`, [
                txId,
                userId,
                wallet.id,
                amount,
                balanceBefore,
                newBalance,
                'system',
                wallet.wallet_address,
                `ROI disbursement for subscription`,
                JSON.stringify({
                    subscriptionId,
                    roiPercentage,
                    disbursementDate: new Date().toISOString()
                })
            ]);
            await connection.commit();
            return {
                transactionId: txId,
                status: 'completed',
                balanceBefore,
                balanceAfter: newBalance
            };
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    // ========== Deposit Handling ==========
    async initiateDeposit(userId, amount, sourceAddress) {
        const wallet = await this.walletModel.getWalletByUserId(userId);
        if (!wallet) {
            throw new Error('User wallet not found');
        }
        const deposit = await this.walletModel.createDeposit(userId, wallet.id, amount, sourceAddress, wallet.wallet_address);
        return {
            depositId: deposit.id,
            depositAddress: wallet.wallet_address
        };
    }
    async confirmDeposit(depositId, txHash, amount) {
        const deposit = await this.walletModel.getDepositById(depositId);
        if (!deposit) {
            throw new Error('Deposit not found');
        }
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            // Update deposit status
            await this.walletModel.updateDepositStatus(depositId, 'confirmed', txHash);
            // Update wallet balance
            const wallet = await this.walletModel.getWalletById(deposit.wallet_id);
            if (!wallet)
                throw new Error('Wallet not found');
            const balanceBefore = wallet.balance_usdc;
            const depositAmount = amount || deposit.amount;
            const newBalance = await this.walletModel.incrementWalletBalance(wallet.id, depositAmount);
            // Create transaction record
            const txId = (0, uuid_1.v4)();
            await connection.execute(`INSERT INTO wallet_transactions 
         (id, user_id, wallet_id, transaction_type, amount, balance_before, balance_after, 
          from_address, to_address, tx_hash, status, description)
         VALUES (?, ?, ?, 'deposit', ?, ?, ?, ?, ?, ?, 'completed', ?)`, [
                txId,
                deposit.user_id,
                wallet.id,
                depositAmount,
                balanceBefore,
                newBalance,
                deposit.source_address,
                wallet.wallet_address,
                txHash,
                `USDC deposit from external wallet`
            ]);
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    // ========== Withdrawal Handling ==========
    async requestWithdrawal(userId, amount, destinationAddress) {
        const wallet = await this.walletModel.getWalletByUserId(userId);
        if (!wallet) {
            throw new Error('User wallet not found');
        }
        if (wallet.balance_usdc < amount) {
            throw new Error('Insufficient balance');
        }
        // Check if user is KYC verified
        const kycVerification = await this.walletModel.getKYCByUserId(userId);
        const isKYCVerified = kycVerification?.status === 'approved' && wallet.kyc_status === 'verified';
        if (!isKYCVerified) {
            // Create withdrawal request that's pending KYC
            const withdrawal = await this.walletModel.createWithdrawalRequest(userId, wallet.id, amount, destinationAddress);
            return {
                withdrawalId: withdrawal.id,
                requiresKYC: true
            };
        }
        // If KYC verified, create approved withdrawal
        const withdrawal = await this.walletModel.createWithdrawalRequest(userId, wallet.id, amount, destinationAddress);
        // Mark as KYC verified and auto-approve
        await this.walletModel.markWithdrawalKYCVerified(withdrawal.id);
        return {
            withdrawalId: withdrawal.id,
            requiresKYC: false
        };
    }
    async approveWithdrawal(withdrawalId, txHash) {
        const withdrawal = await this.walletModel.getWithdrawalRequest(withdrawalId);
        if (!withdrawal) {
            throw new Error('Withdrawal request not found');
        }
        // Check KYC requirement
        if (withdrawal.requires_kyc && !withdrawal.kyc_verified) {
            throw new Error('KYC verification required');
        }
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            // Deduct from wallet
            const wallet = await this.walletModel.getWalletById(withdrawal.wallet_id);
            if (!wallet)
                throw new Error('Wallet not found');
            const balanceBefore = wallet.balance_usdc;
            const newBalance = await this.walletModel.decrementWalletBalance(wallet.id, withdrawal.amount);
            // Update withdrawal status
            await this.walletModel.updateWithdrawalStatus(withdrawalId, 'completed', txHash);
            // Create transaction record
            const txId = (0, uuid_1.v4)();
            await connection.execute(`INSERT INTO wallet_transactions 
         (id, user_id, wallet_id, transaction_type, amount, balance_before, balance_after, 
          from_address, to_address, tx_hash, status, description)
         VALUES (?, ?, ?, 'withdraw', ?, ?, ?, ?, ?, ?, 'completed', ?)`, [
                txId,
                withdrawal.user_id,
                wallet.id,
                withdrawal.amount,
                balanceBefore,
                newBalance,
                wallet.wallet_address,
                withdrawal.destination_address,
                txHash || 'pending',
                `USDC withdrawal to external wallet`
            ]);
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async rejectWithdrawal(withdrawalId, reason) {
        await this.walletModel.updateWithdrawalStatus(withdrawalId, 'rejected', undefined, reason);
    }
    // ========== Transaction History ==========
    async getTransactionHistory(userId, limit = 50, offset = 0) {
        return this.walletModel.getTransactionsByUserId(userId, limit, offset);
    }
    async getTransactionSummary(userId) {
        // This will return transaction summary statistics
        const [deposits, withdrawals, transfers, roiDisbursements, subscriptionPayments] = await Promise.all([
            this.transactionModel.getTransactionsByType(userId, 'deposit'),
            this.transactionModel.getTransactionsByType(userId, 'withdrawal'),
            this.transactionModel.getTransactionsByType(userId, 'transfer'),
            this.transactionModel.getTransactionsByType(userId, 'roi_disbursement'),
            this.transactionModel.getTransactionsByType(userId, 'subscription_payment')
        ]);
        const totalDeposited = deposits.reduce((sum, tx) => sum + tx.amount, 0);
        const totalWithdrawn = withdrawals.reduce((sum, tx) => sum + tx.amount, 0);
        const totalTransferred = transfers.reduce((sum, tx) => sum + tx.amount, 0);
        const totalROI = roiDisbursements.reduce((sum, tx) => sum + tx.amount, 0);
        const totalPayments = subscriptionPayments.reduce((sum, tx) => sum + tx.amount, 0);
        return {
            totalDeposited,
            totalWithdrawn,
            totalTransferred,
            totalPayments,
            totalROI,
            netBalance: totalDeposited + totalROI - totalWithdrawn - totalTransferred - totalPayments
        };
    }
    // ========== Wallet Summary ==========
    async getWalletSummary(userId) {
        const wallet = await this.walletModel.getWalletByUserId(userId);
        if (!wallet)
            return null;
        const [transactions, deposits, withdrawals, kycStatus] = await Promise.all([
            this.walletModel.getTransactionsByWalletId(wallet.id, 10),
            this.walletModel.getDepositsByWalletId(wallet.id),
            this.walletModel.getWithdrawalsByUserId(userId),
            this.walletModel.getKYCByUserId(userId)
        ]);
        return {
            wallet: {
                id: wallet.id,
                address: wallet.wallet_address,
                balance: wallet.balance_usdc,
                kycStatus: wallet.kyc_status,
                kycVerifiedAt: wallet.kyc_verified_at,
                createdAt: wallet.created_at
            },
            recentTransactions: transactions,
            deposits: deposits,
            withdrawals: withdrawals,
            kyc: kycStatus
        };
    }
}
exports.WalletService = WalletService;
//# sourceMappingURL=walletService.js.map