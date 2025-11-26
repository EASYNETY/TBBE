export interface Subscription {
    id: string;
    property_id: string;
    subscriber_user_id: string;
    subscriber_wallet_address: string;
    subscription_amount: string;
    subscription_date: Date;
    status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'EXPIRED';
    share_percentage: number;
    currency: string;
    transaction_hash?: string;
    kyc_verified: boolean;
    created_at?: Date;
    updated_at?: Date;
}
export interface SubscriptionCreationAttributes extends Omit<Subscription, 'id' | 'created_at' | 'updated_at'> {
    id?: string;
}
export interface DisbursementRecord {
    id: string;
    property_id: string;
    distribution_id: string;
    subscriber_id: string;
    subscriber_wallet_address: string;
    disbursement_amount: string;
    disbursement_date: Date;
    currency: string;
    type: 'YIELD' | 'RETURN' | 'REVENUE' | 'DIVIDEND';
    status: 'PENDING' | 'EXECUTED' | 'FAILED';
    transaction_hash?: string;
    executed_at?: Date;
    created_at?: Date;
    updated_at?: Date;
}
export interface DisbursementCreationAttributes extends Omit<DisbursementRecord, 'id' | 'created_at' | 'updated_at'> {
    id?: string;
}
export declare const subscriptionQueries: {
    createTable: string;
    insert: string;
    findById: string;
    findByPropertyId: string;
    findActiveSubscriptionsByProperty: string;
    findBySubscriberUserId: string;
    findBySubscriberWallet: string;
    updateStatus: string;
    updateKycStatus: string;
    updateSharePercentage: string;
    findTotalSubscribersByProperty: string;
    findTotalSubscriptionAmount: string;
};
export declare const disbursementQueries: {
    createTable: string;
    insert: string;
    findById: string;
    findByPropertyId: string;
    findByDistributionId: string;
    findBySubscriberId: string;
    findBySubscriberWallet: string;
    findPendingDisbursements: string;
    findPendingByProperty: string;
    updateStatus: string;
    findTotalDisbursedBySubscriber: string;
    findTotalDisbursedByProperty: string;
    findDisbursementsByDateRange: string;
};
//# sourceMappingURL=subscriptionModel.d.ts.map