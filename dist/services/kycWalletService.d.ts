import { Pool } from 'mysql2/promise';
/**
 * KYC Wallet Service
 * Handles KYC verification workflow integrated with wallet system
 * Supports mock KYC for testing and real providers (Sumsub, Blockpass, Persona)
 */
export interface KYCProvider {
    name: string;
    apiKey?: string;
    apiSecret?: string;
    webhookSecret?: string;
}
export declare class KYCWalletService {
    private pool;
    private walletModel;
    private kycProvider;
    constructor(pool: Pool);
    /**
     * Initialize KYC verification for a user
     */
    initiateKYCVerification(userId: string): Promise<{
        verificationId: string;
        kycUrl?: string;
        status: string;
    }>;
    /**
     * Mock KYC Provider (for testing)
     */
    private initiateMockKYCVerification;
    /**
     * Complete mock KYC verification (for testing)
     */
    completeMockKYCVerification(userId: string, verificationId: string, kycData: any): Promise<void>;
    /**
     * Sumsub Integration
     */
    private initiateSumsubVerification;
    /**
     * Blockpass Integration
     */
    private initiateBlockpassVerification;
    /**
     * Persona Integration
     */
    private initiatePersonaVerification;
    /**
     * Get KYC verification status for user
     */
    getKYCStatus(userId: string): Promise<{
        status: string;
        isVerified: boolean;
        verificationDate?: Date;
        expiryDate?: Date;
    }>;
    /**
     * Get detailed KYC information for user
     */
    getKYCDetails(userId: string): Promise<any>;
    /**
     * Check if user is KYC verified
     */
    isKYCVerified(userId: string): Promise<boolean>;
    /**
     * Verify KYC submission (for mock provider)
     */
    verifyKYCSubmission(userId: string, kycData: any): Promise<void>;
    /**
     * Reject KYC submission (admin action)
     */
    rejectKYCSubmission(userId: string, reason: string): Promise<void>;
    /**
     * Handle KYC webhook from provider
     */
    handleKYCWebhook(provider: string, payload: any): Promise<void>;
    /**
     * Handle Sumsub webhook
     */
    private handleSumsubWebhook;
    /**
     * Handle Blockpass webhook
     */
    private handleBlockpassWebhook;
    /**
     * Handle Persona webhook
     */
    private handlePersonaWebhook;
    /**
     * Get or create user wallet if it doesn't exist
     */
    private getOrCreateUserWallet;
}
//# sourceMappingURL=kycWalletService.d.ts.map