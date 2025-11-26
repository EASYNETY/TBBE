export interface DistributionAttributes {
    id: string;
    property_id: string;
    token_id?: number;
    amount: string;
    currency: string;
    type: 'INITIAL' | 'YIELD' | 'REVENUE' | 'AIRDROP' | 'VESTING';
    status: 'PENDING' | 'EXECUTED' | 'FAILED';
    executed_at?: Date;
    tx_hash?: string;
    receiver_address: string;
    receiver_user_id?: string;
    distribution_data?: any;
    created_at?: Date;
    updated_at?: Date;
}
export interface DistributionCreationAttributes extends Omit<DistributionAttributes, 'id' | 'created_at' | 'updated_at'> {
    id?: string;
}
export interface ShareholderAttributes {
    id: string;
    property_id: string;
    token_id?: number;
    user_id: string;
    wallet_address: string;
    shares_owned: number;
    percentage_owned: number;
    acquisition_date: Date;
    acquisition_price?: string;
    vesting_schedule?: any;
    kyc_verified: boolean;
    created_at?: Date;
    updated_at?: Date;
}
export declare const distributionQueries: {
    createTable: string;
    insert: string;
    findByPropertyId: string;
    findByTokenId: string;
    findPending: string;
    updateStatus: string;
    findByReceiver: string;
};
export declare const shareholderQueries: {
    createTable: string;
    insert: string;
    findByPropertyId: string;
    findByUserId: string;
    updateShares: string;
    updateKycStatus: string;
};
//# sourceMappingURL=distributionModel.d.ts.map