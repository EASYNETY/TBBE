export interface MintingResult {
    tokenId: number;
    transactionHash: string;
    blockNumber: number;
    gasUsed: string;
}
export declare class MintingService {
    private provider;
    private signer;
    private titleRegistrarContract;
    constructor();
    mintToken(propertyId: string): Promise<MintingResult>;
    getMintingStatus(propertyId: string): Promise<{
        status: string;
        tokenId?: number;
        transactionHash?: string;
        error?: string;
    }>;
    retryMint(propertyId: string): Promise<MintingResult>;
}
export declare const mintingService: MintingService;
//# sourceMappingURL=mintingService.d.ts.map