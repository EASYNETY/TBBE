import { Pool, RowDataPacket } from 'mysql2/promise';
export interface AccountLink extends RowDataPacket {
    id: string;
    user_id: string;
    smart_account_address: string;
    wallet_address: string;
    linked_at: Date;
    is_primary: boolean;
    status: 'active' | 'inactive' | 'pending';
    verification_code?: string;
    verified_at?: Date;
    metadata?: any;
    created_at: Date;
    updated_at: Date;
}
export interface AccountLinkingHistory extends RowDataPacket {
    id: string;
    account_link_id: string;
    action: string;
    performed_by: string;
    ip_address?: string;
    user_agent?: string;
    status: string;
    created_at: Date;
}
export declare class AccountLinkingModel {
    private pool;
    constructor(pool: Pool);
    linkWalletToAccount(userId: string, smartAccountAddress: string, walletAddress: string, isPrimary?: boolean): Promise<AccountLink>;
    getLinkById(linkId: string): Promise<AccountLink | null>;
    getLinksByUserId(userId: string): Promise<AccountLink[]>;
    getPrimaryLink(userId: string): Promise<AccountLink | null>;
    getLinkBySmartAccount(smartAccountAddress: string): Promise<AccountLink | null>;
    getLinkByWalletAddress(walletAddress: string): Promise<AccountLink | null>;
    verifyLink(linkId: string, verificationCode: string): Promise<boolean>;
    setPrimaryLink(userId: string, linkId: string): Promise<void>;
    updateLinkStatus(linkId: string, status: 'active' | 'inactive' | 'pending'): Promise<void>;
    deactivateLink(linkId: string): Promise<void>;
    recordLinkingHistory(linkId: string, action: string, performedBy: string, ipAddress?: string, userAgent?: string, status?: string): Promise<void>;
    getLinkingHistory(linkId: string, limit?: number): Promise<AccountLinkingHistory[]>;
    private generateVerificationCode;
}
//# sourceMappingURL=accountLinkingModel.d.ts.map