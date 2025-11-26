export interface PropertyAttributes {
    id: string;
    user_id: string;
    project_id?: string;
    title: string;
    address: string;
    description?: string;
    property_type?: string;
    ownership_type?: string;
    fractional: boolean;
    supply: number;
    price?: number;
    images?: any[];
    documents?: any[];
    video_tour_url?: string;
    metadata_tags?: any[];
    metadata_hash?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MINTED' | 'ACTIVE' | 'HIDDEN';
    hidden: boolean;
    token_id?: number;
    rejection_reason?: string;
    property_registry_id?: number;
    created_at?: Date;
    updated_at?: Date;
}
export interface PropertyCreationAttributes extends Omit<PropertyAttributes, 'id' | 'created_at' | 'updated_at'> {
    id?: string;
}
export declare const propertyQueries: {
    createTable: string;
    insert: string;
    findById: string;
    findByUserId: string;
    findByStatus: string;
    findPending: string;
    updateStatus: string;
    updateRejectionReason: string;
    updateTokenId: string;
    updatePropertyRegistryId: string;
    toggleVisibility: string;
    updateMetadataHash: string;
};
//# sourceMappingURL=propertyModel.d.ts.map