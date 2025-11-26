import { Pool } from 'mysql2/promise';
import { UserWallet } from '../models/walletModel';
export interface WalletBalance {
    walletId: string;
    address: string;
    balanceUsdc: number;
    kycStatus: string;
    nonce: number;
}
export interface TransactionResult {
    transactionId: string;
    status: string;
    balanceBefore: number;
    balanceAfter: number;
}
export declare class WalletService {
    private pool;
    private walletModel;
    private transactionModel;
    private provider;
    private USDC_CONTRACT;
    constructor(pool: Pool, rpcUrl?: string);
    createWalletForUser(userId: string): Promise<UserWallet>;
    getWalletBalance(userId: string): Promise<WalletBalance | null>;
    getWalletInfo(userId: string): Promise<UserWallet | null>;
    transferBetweenWallets(fromUserId: string, toUserId: string, amount: number, reason?: string): Promise<TransactionResult>;
    disburseROI(userId: string, amount: number, subscriptionId: string, roiPercentage: number): Promise<TransactionResult>;
    initiateDeposit(userId: string, amount: number, sourceAddress: string): Promise<{
        depositId: string;
        depositAddress: string;
    }>;
    confirmDeposit(depositId: string, txHash: string, amount?: number): Promise<void>;
    requestWithdrawal(userId: string, amount: number, destinationAddress: string): Promise<{
        withdrawalId: string;
        requiresKYC: boolean;
    }>;
    approveWithdrawal(withdrawalId: string, txHash?: string): Promise<void>;
    rejectWithdrawal(withdrawalId: string, reason: string): Promise<void>;
    getTransactionHistory(userId: string, limit?: number, offset?: number): Promise<import("../models/walletModel").WalletTransaction[]>;
    getTransactionSummary(userId: string): Promise<{
        totalDeposited: number;
        totalWithdrawn: number;
        totalTransferred: number;
        totalPayments: number;
        totalROI: number;
        netBalance: number;
    }>;
    getWalletSummary(userId: string): Promise<{
        wallet: {
            id: string;
            address: string;
            balance: number;
            kycStatus: "verified" | "pending" | "rejected";
            kycVerifiedAt: Date | null;
            createdAt: Date;
        };
        recentTransactions: import("../models/walletModel").WalletTransaction[];
        deposits: import("../models/walletModel").WalletDeposit[];
        withdrawals: import("../models/walletModel").WithdrawalRequest[];
        kyc: import("../models/walletModel").KYCVerification | null;
    } | null>;
}
//# sourceMappingURL=walletService.d.ts.map