export interface RegistrationResult {
    transactionHash: string;
    blockNumber: number;
}
export declare class MarketplaceRegistrationService {
    private provider;
    private signer;
    private marketplaceGuardContract;
    constructor();
    registerToken(tokenId: number, projectId: string): Promise<RegistrationResult>;
    registerPaymentToken(tokenId: number, paymentTokenAddress: string): Promise<RegistrationResult>;
    setPolicyFlags(tokenId: number, flags: number): Promise<RegistrationResult>;
    setupMarketplaceReadiness(tokenId: number, projectId: string): Promise<{
        registration: RegistrationResult;
        paymentTokens: RegistrationResult[];
        policyFlags: RegistrationResult;
    }>;
    checkRegistrationStatus(tokenId: number): Promise<{
        isRegistered: boolean;
        policyFlags?: number;
    }>;
    reRegisterToken(tokenId: number, projectId: string): Promise<RegistrationResult>;
}
export declare const marketplaceRegistrationService: MarketplaceRegistrationService;
//# sourceMappingURL=marketplaceRegistrationService.d.ts.map