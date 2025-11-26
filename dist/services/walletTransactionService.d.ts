import { Pool } from 'mysql2/promise';
import { WalletTransactionRecord, TransactionMetadata } from '../models/walletTransactionModel';
export interface TransactionDetails {
    id: string;
    type: string;
    amount: number;
    fromAddress: string;
    toAddress: string;
    status: string;
    description?: string;
    txHash?: string;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: Date;
}
export interface TransactionSummary {
    totalTransactions: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalSpent: number;
    averageTransaction: number;
    recentTransactions: TransactionDetails[];
}
export declare class WalletTransactionService {
    private pool;
    private transactionModel;
    private walletModel;
    constructor(pool: Pool);
    recordDeposit(userId: string, walletId: string, amount: number, fromAddress: string, toAddress: string, txHash?: string, metadata?: TransactionMetadata): Promise<TransactionDetails>;
    recordWithdrawal(userId: string, walletId: string, amount: number, fromAddress: string, toAddress: string, txHash?: string, metadata?: TransactionMetadata): Promise<TransactionDetails>;
    recordTransfer(userId: string, walletId: string, amount: number, fromAddress: string, toAddress: string, metadata?: TransactionMetadata): Promise<TransactionDetails>;
    recordSubscriptionPayment(userId: string, walletId: string, amount: number, fromAddress: string, toAddress: string, subscriptionId: string, metadata?: TransactionMetadata): Promise<TransactionDetails>;
    recordROIDisbursement(userId: string, walletId: string, amount: number, subscriptionId: string, roiPercentage: number, metadata?: TransactionMetadata): Promise<TransactionDetails>;
    recordRefund(userId: string, walletId: string, amount: number, fromAddress: string, toAddress: string, reason: string, metadata?: TransactionMetadata): Promise<TransactionDetails>;
    getTransactionHistory(userId: string, limit?: number, offset?: number, types?: string[]): Promise<TransactionDetails[]>;
    getRecentTransactions(userId: string, days?: number): Promise<TransactionDetails[]>;
    getPendingTransactions(userId: string): Promise<TransactionDetails[]>;
    getFailedTransactions(userId: string): Promise<TransactionDetails[]>;
    searchTransactions(userId: string, query: string): Promise<TransactionDetails[]>;
    getTransactionSummary(userId: string): Promise<TransactionSummary>;
    getTransactionsByType(userId: string, type: WalletTransactionRecord['transaction_type']): Promise<TransactionDetails[]>;
    updateTransactionStatus(transactionId: string, status: WalletTransactionRecord['status'], txHash?: string): Promise<void>;
    recordTransactionMetadata(transactionId: string, metadata: TransactionMetadata): Promise<void>;
    private formatTransactionDetails;
}
//# sourceMappingURL=walletTransactionService.d.ts.map