import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
export declare class SubscriptionController {
    private subscriptionModel;
    private provider;
    private subscriptionContract;
    constructor(db: Pool);
    subscribe(req: Request, res: Response): Promise<void>;
    payout(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=subscription.d.ts.map