import { Pool, RowDataPacket } from 'mysql2/promise';
export interface UserWallet extends RowDataPacket {
    id: string;
    user_id: string;
    wallet_address: string;
    balance_usdc: number;
    nonce: number;
    kyc_status: 'pending' | 'verified' | 'rejected';
    kyc_verified_at: Date | null;
    kyc_data: any;
    created_at: Date;
    updated_at: Date;
}
export interface WalletTransaction extends RowDataPacket {
    id: string;
    user_id: string;
    wallet_id: string;
    transaction_type: string;
    amount: number;
    balance_before: number;
    balance_after: number;
    from_address: string;
    to_address: string;
    tx_hash: string | null;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    description: string | null;
    metadata: any;
    created_at: Date;
    updated_at: Date;
}
export interface WalletDeposit extends RowDataPacket {
    id: string;
    user_id: string;
    wallet_id: string;
    amount: number;
    source_address: string;
    deposit_address: string;
    status: 'pending' | 'confirmed' | 'failed';
    tx_hash: string | null;
    confirmations: number;
    created_at: Date;
    updated_at: Date;
}
export interface KYCVerification extends RowDataPacket {
    id: string;
    user_id: string;
    wallet_id: string | null;
    provider: string;
    provider_id: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    kyc_data: any;
    verification_date: Date | null;
    expiry_date: Date | null;
    rejection_reason: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface WithdrawalRequest extends RowDataPacket {
    id: string;
    user_id: string;
    wallet_id: string;
    amount: number;
    destination_address: string;
    status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
    requires_kyc: boolean;
    kyc_verified: boolean;
    tx_hash: string | null;
    rejection_reason: string | null;
    created_at: Date;
    updated_at: Date;
    completed_at: Date | null;
}
export declare class WalletModel {
    private pool;
    constructor(pool: Pool);
    createWallet(userId: string, walletAddress: string): Promise<UserWallet>;
    getWalletById(walletId: string): Promise<UserWallet | null>;
    getWalletByUserId(userId: string): Promise<UserWallet | null>;
    getWalletByAddress(address: string): Promise<UserWallet | null>;
    updateWalletBalance(walletId: string, newBalance: number): Promise<void>;
    incrementWalletBalance(walletId: string, amount: number): Promise<number>;
    decrementWalletBalance(walletId: string, amount: number): Promise<number>;
    incrementNonce(walletId: string): Promise<number>;
    createTransaction(userId: string, walletId: string, type: string, amount: number, fromAddress: string, toAddress: string, description?: string, metadata?: any): Promise<WalletTransaction>;
    getTransactionById(txId: string): Promise<WalletTransaction | null>;
    getTransactionsByWalletId(walletId: string, limit?: number, offset?: number): Promise<WalletTransaction[]>;
    getTransactionsByUserId(userId: string, limit?: number, offset?: number): Promise<WalletTransaction[]>;
    updateTransactionStatus(txId: string, status: string, txHash?: string): Promise<void>;
    updateTransactionBalances(txId: string, balanceBefore: number, balanceAfter: number): Promise<void>;
    createDeposit(userId: string, walletId: string, amount: number, sourceAddress: string, depositAddress: string): Promise<WalletDeposit>;
    getDepositById(depositId: string): Promise<WalletDeposit | null>;
    getDepositsByWalletId(walletId: string): Promise<WalletDeposit[]>;
    updateDepositStatus(depositId: string, status: string, txHash?: string, confirmations?: number): Promise<void>;
    createKYCVerification(userId: string, provider: string, providerId: string): Promise<KYCVerification>;
    getKYCVerification(verificationId: string): Promise<KYCVerification | null>;
    getKYCByUserId(userId: string): Promise<KYCVerification | null>;
    updateKYCStatus(verificationId: string, status: string, kycData?: any, rejectionReason?: string): Promise<void>;
    markKYCVerified(userId: string, walletId: string): Promise<void>;
    createWithdrawalRequest(userId: string, walletId: string, amount: number, destinationAddress: string): Promise<WithdrawalRequest>;
    getWithdrawalRequest(requestId: string): Promise<WithdrawalRequest | null>;
    getWithdrawalsByUserId(userId: string): Promise<WithdrawalRequest[]>;
    updateWithdrawalStatus(requestId: string, status: string, txHash?: string, rejectionReason?: string): Promise<void>;
    markWithdrawalKYCVerified(requestId: string): Promise<void>;
    linkExternalWallet(userId: string, walletAddress: string): Promise<void>;
    getLinkedWallets(userId: string): Promise<any[]>;
    unlinkExternalWallet(userId: string, walletAddress: string): Promise<void>;
    getPrimaryExternalWallet(userId: string): Promise<any | null>;
}
//# sourceMappingURL=walletModel.d.ts.map