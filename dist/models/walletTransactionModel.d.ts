import { Pool, RowDataPacket } from 'mysql2/promise';
export interface WalletTransactionRecord extends RowDataPacket {
    id: string;
    user_id: string;
    wallet_id: string;
    transaction_type: 'deposit' | 'withdrawal' | 'transfer' | 'roi_disbursement' | 'subscription_payment' | 'refund';
    amount: number;
    balance_before: number;
    balance_after: number;
    from_address: string;
    to_address: string;
    tx_hash?: string;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    description?: string;
    metadata?: any;
    created_at: Date;
    updated_at: Date;
}
export interface TransactionMetadata {
    subscriptionId?: string;
    propertyId?: string;
    relatedTransactionId?: string;
    roiPercentage?: number;
    disbursementDate?: string;
    reason?: string;
    [key: string]: any;
}
export declare class WalletTransactionModel {
    private pool;
    constructor(pool: Pool);
    createTransaction(userId: string, walletId: string, type: WalletTransactionRecord['transaction_type'], amount: number, fromAddress: string, toAddress: string, status?: WalletTransactionRecord['status'], description?: string, metadata?: TransactionMetadata): Promise<WalletTransactionRecord>;
    getTransactionById(transactionId: string): Promise<WalletTransactionRecord | null>;
    getTransactionsByUserId(userId: string, limit?: number, offset?: number, types?: string[]): Promise<WalletTransactionRecord[]>;
    getTransactionsByWalletId(walletId: string, limit?: number, offset?: number): Promise<WalletTransactionRecord[]>;
    getTransactionsByType(userId: string, type: WalletTransactionRecord['transaction_type'], limit?: number): Promise<WalletTransactionRecord[]>;
    getTransactionsByStatus(status: WalletTransactionRecord['status'], limit?: number): Promise<WalletTransactionRecord[]>;
    updateTransactionStatus(transactionId: string, status: WalletTransactionRecord['status'], txHash?: string): Promise<void>;
    updateTransactionBalances(transactionId: string, balanceBefore: number, balanceAfter: number): Promise<void>;
    updateTransactionMetadata(transactionId: string, metadata: TransactionMetadata): Promise<void>;
    getTransactionStats(userId: string): Promise<{
        totalTransactions: number;
        totalDeposited: number;
        totalWithdrawn: number;
        totalSpent: number;
        averageTransaction: number;
    }>;
    getPendingTransactions(userId: string): Promise<WalletTransactionRecord[]>;
    getFailedTransactions(userId: string): Promise<WalletTransactionRecord[]>;
    searchTransactions(userId: string, query: string, limit?: number): Promise<WalletTransactionRecord[]>;
    private formatTransaction;
}
//# sourceMappingURL=walletTransactionModel.d.ts.map