import { Pool } from 'mysql2/promise';
export interface KYCVerification {
    id: string;
    userId: string;
    provider: string;
    providerId?: string;
    status: 'pending' | 'approved' | 'rejected';
    kycData?: any;
    rejectionReason?: string;
    verificationDate?: Date;
    expiryDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare class KYCIntegrationService {
    private pool;
    private walletModel;
    private provider;
    constructor(pool: Pool);
    /**
     * Initialize KYC verification with selected provider
     */
    initializeVerification(userId: string, walletAddress: string): Promise<{
        verificationId: string;
        provider: string;
        redirectUrl: string;
    }>;
    /**
     * Sumsub Provider Implementation
     */
    private initiateSumsubVerification;
    /**
     * Blockpass Provider Implementation
     */
    private initiateBlockpassVerification;
    /**
     * Persona Provider Implementation
     */
    private initiatePersonaVerification;
    /**
     * Mock KYC Provider (for testing)
     */
    private initiateMockVerification;
    /**
     * Get verification status
     */
    getVerificationStatus(verificationId: string, userId: string): Promise<KYCVerification | null>;
    /**
     * Submit manual KYC data
     */
    submitManualKYC(userId: string, kycData: any): Promise<{
        verificationId: string;
        status: string;
    }>;
    /**
     * Handle Sumsub webhook
     */
    handleSumsubWebhook(payload: any): Promise<void>;
    /**
     * Handle Blockpass webhook
     */
    handleBlockpassWebhook(payload: any): Promise<void>;
    /**
     * Handle Persona webhook
     */
    handlePersonaWebhook(payload: any): Promise<void>;
    /**
     * Get pending verifications (admin)
     */
    getPendingVerifications(limit?: number, offset?: number): Promise<any[]>;
    /**
     * Approve verification (admin)
     */
    approveVerification(verificationId: string): Promise<{
        walletVerified: boolean;
    }>;
    /**
     * Reject verification (admin)
     */
    rejectVerification(verificationId: string, reason: string): Promise<void>;
}
//# sourceMappingURL=kycIntegrationService.d.ts.map