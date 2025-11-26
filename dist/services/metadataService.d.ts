export interface PropertyMetadata {
    name: string;
    description: string;
    image: string;
    attributes: Array<{
        trait_type: string;
        value: string | number;
    }>;
    fractional: boolean;
    supply: number;
    projectId?: string;
    propertyId: string;
    address: string;
    propertyType?: string;
    ownershipType?: string;
}
export declare class MetadataService {
    private pinata;
    constructor();
    prepareMetadata(propertyId: string): Promise<PropertyMetadata>;
    uploadMetadataToIPFS(metadata: PropertyMetadata): Promise<string>;
    getMetadataFromIPFS(cid: string): Promise<PropertyMetadata>;
}
export declare const metadataService: MetadataService;
//# sourceMappingURL=metadataService.d.ts.map