import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
export interface AuthRequest extends Request {
    user?: any;
}
export declare class WalletController {
    private pool;
    private walletService;
    private walletModel;
    constructor(pool: Pool);
    createWallet(req: AuthRequest, res: Response): Promise<void>;
    getWallet(req: AuthRequest, res: Response): Promise<void>;
    getBalance(req: AuthRequest, res: Response): Promise<void>;
    initiateDeposit(req: AuthRequest, res: Response): Promise<void>;
    confirmDeposit(req: AuthRequest, res: Response): Promise<void>;
    requestWithdrawal(req: AuthRequest, res: Response): Promise<void>;
    approveWithdrawal(req: AuthRequest, res: Response): Promise<void>;
    rejectWithdrawal(req: AuthRequest, res: Response): Promise<void>;
    transferBetweenWallets(req: AuthRequest, res: Response): Promise<void>;
    getTransactionHistory(req: AuthRequest, res: Response): Promise<void>;
    getTransactionSummary(req: AuthRequest, res: Response): Promise<void>;
    getWalletSummary(req: AuthRequest, res: Response): Promise<void>;
    withdrawToExternalWallet(req: AuthRequest, res: Response): Promise<void>;
    getWithdrawalStatus(req: AuthRequest, res: Response): Promise<void>;
    getWithdrawalLimits(req: AuthRequest, res: Response): Promise<void>;
    getWithdrawalFees(req: AuthRequest, res: Response): Promise<void>;
    linkExternalWallet(req: AuthRequest, res: Response): Promise<void>;
    getLinkedWallets(req: AuthRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=walletController.d.ts.map