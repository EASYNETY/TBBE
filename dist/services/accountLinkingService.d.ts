import { Pool } from 'mysql2/promise';
export interface LinkAccountRequest {
    userId: string;
    smartAccountAddress: string;
    walletAddress: string;
    isPrimary?: boolean;
}
export interface LinkAccountResponse {
    linkId: string;
    verificationCode: string;
    status: string;
    expiresIn: number;
}
export interface LinkedAccount {
    id: string;
    smartAccountAddress: string;
    walletAddress: string;
    isPrimary: boolean;
    status: string;
    verifiedAt: Date | null;
    linkedAt: Date;
}
export declare class AccountLinkingService {
    private pool;
    private model;
    private readonly VERIFICATION_TIMEOUT;
    constructor(pool: Pool);
    initiateAccountLink(request: LinkAccountRequest): Promise<LinkAccountResponse>;
    verifyAndActivateLink(linkId: string, verificationCode: string): Promise<LinkedAccount>;
    getLinkedAccounts(userId: string): Promise<LinkedAccount[]>;
    getPrimaryAccount(userId: string): Promise<LinkedAccount | null>;
    setPrimaryAccount(userId: string, linkId: string): Promise<LinkedAccount>;
    unlinkAccount(userId: string, linkId: string): Promise<void>;
    resendVerificationCode(linkId: string): Promise<{
        verificationCode: string;
        expiresIn: number;
    }>;
    validateAccountLink(smartAccountAddress: string): Promise<LinkedAccount | null>;
    isWalletLinked(walletAddress: string): Promise<boolean>;
    getLinkingAuditTrail(linkId: string, limit?: number): Promise<any[]>;
    private formatLinkedAccount;
    private isValidSmartAccountAddress;
    private isValidWalletAddress;
}
//# sourceMappingURL=accountLinkingService.d.ts.map