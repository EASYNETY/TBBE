import { Pool } from 'mysql2/promise';

export interface Subscription {
    id?: number;
    propertyId: number;
    walletAddress: string;
    amount: number;
    transactionHash: string;
    createdAt?: Date;
}

export class SubscriptionModel {
    private db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    async create(subscription: Subscription): Promise<number> {
        const [result] = await this.db.execute(
            'INSERT INTO subscriptions (propertyId, walletAddress, amount, transactionHash) VALUES (?, ?, ?, ?)',
            [subscription.propertyId, subscription.walletAddress, subscription.amount, subscription.transactionHash]
        );
        return (result as any).insertId;
    }

    async findByPropertyId(propertyId: number): Promise<Subscription[]> {
        const [rows] = await this.db.query('SELECT * FROM subscriptions WHERE propertyId = ?', [propertyId]);
        return rows as Subscription[];
    }
}
