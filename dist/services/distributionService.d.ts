export interface DistributionRequest {
    propertyId: string;
    tokenId?: number;
    amount: string;
    currency: string;
    type: 'INITIAL' | 'YIELD' | 'REVENUE' | 'AIRDROP' | 'VESTING';
    receivers: Array<{
        address: string;
        userId?: string;
        amount: string;
    }>;
    distributionData?: any;
}
export interface ShareholderInfo {
    userId: string;
    walletAddress: string;
    sharesOwned: number;
    percentageOwned: number;
    kycVerified: boolean;
}
export declare class DistributionService {
    private provider;
    private signer;
    constructor();
    distributeInitialShares(propertyId: string, tokenId: number): Promise<void>;
    distributeYieldToTBA(tokenId: number, amount: string, currency: string): Promise<string>;
    distributeYield(tokenId: number): Promise<void>;
    airdropShares(propertyId: string, receivers: Array<{
        address: string;
        amount: number;
    }>): Promise<void>;
    lockReservedShares(propertyId: string, lockDuration: number): Promise<void>;
    private createDistribution;
    private recordShareholder;
    getShareholders(propertyId: string): Promise<ShareholderInfo[]>;
    private getTokenAddress;
    recordDistributionEvent(propertyId: string, tokenId: number, amount: string, type: string, txHash: string, receivers: Array<{
        address: string;
        amount: string;
    }>): Promise<void>;
}
export declare const distributionService: DistributionService;
//# sourceMappingURL=distributionService.d.ts.map