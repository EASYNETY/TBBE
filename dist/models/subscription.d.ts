import { Pool } from 'mysql2/promise';
export interface Subscription {
    id?: number;
    propertyId: number;
    walletAddress: string;
    amount: number;
    transactionHash: string;
    createdAt?: Date;
}
export declare class SubscriptionModel {
    private db;
    constructor(db: Pool);
    create(subscription: Subscription): Promise<number>;
    findByPropertyId(propertyId: number): Promise<Subscription[]>;
}
//# sourceMappingURL=subscription.d.ts.map