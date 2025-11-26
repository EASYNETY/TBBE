export interface TBAResult {
    tbaAddress: string;
    transactionHash: string;
    blockNumber: number;
}
export interface PolicyModuleConfig {
    withdrawalRules: {
        maxDailyWithdrawal: string;
        maxMonthlyWithdrawal: string;
        kycRequired: boolean;
        voucherRequired: boolean;
    };
    extractionRoles: string[];
    stablecoinWhitelist: string[];
    projectRules: {
        projectId: string;
        withdrawalCap: string;
        allowedCurrencies: string[];
    };
}
export declare class TBAService {
    private provider;
    private signer;
    private registryContract;
    private accountImpl;
    constructor();
    createTBA(tokenId: number, owner: string): Promise<TBAResult>;
    initializePolicyModule(tbaAddress: string, config: PolicyModuleConfig): Promise<string>;
    getTBABalance(tbaAddress: string, tokenAddress: string): Promise<string>;
    generateWithdrawalVoucher(tbaAddress: string, recipient: string, amount: string, tokenAddress: string): Promise<{
        voucher: string;
        signature: string;
    }>;
    executeWithdrawal(tbaAddress: string, voucher: string, signature: string): Promise<string>;
}
export declare const tbaService: TBAService;
//# sourceMappingURL=tbaService.d.ts.map