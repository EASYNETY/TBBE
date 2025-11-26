"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataService = exports.MetadataService = void 0;
const pinata_web3_1 = require("pinata-web3");
const database_1 = require("../utils/database");
class MetadataService {
    constructor() {
        this.pinata = new pinata_web3_1.PinataSDK({
            pinataJwt: process.env.PINATA_JWT,
            pinataGateway: process.env.PINATA_GATEWAY || 'gateway.pinata.cloud',
        });
    }
    async prepareMetadata(propertyId) {
        // Fetch property data from database
        const property = await (0, database_1.query)(`SELECT p.*, u.username as owner_username, u.wallet_address as owner_address
       FROM properties p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`, [propertyId]);
        if (!property || property.length === 0) {
            throw new Error(`Property ${propertyId} not found`);
        }
        const prop = property[0];
        // Upload images and documents to IPFS
        const imageUrls = [];
        if (prop.images && Array.isArray(prop.images)) {
            for (const image of prop.images) {
                if (image.url) {
                    // If already IPFS, use as is
                    if (image.url.startsWith('ipfs://')) {
                        imageUrls.push(image.url);
                    }
                    else {
                        // Upload to IPFS
                        const upload = await this.pinata.upload.file(new File([], image.url));
                        imageUrls.push(`ipfs://${upload.IpfsHash}`);
                    }
                }
            }
        }
        const documentUrls = [];
        if (prop.documents && Array.isArray(prop.documents)) {
            for (const doc of prop.documents) {
                if (doc.url) {
                    if (doc.url.startsWith('ipfs://')) {
                        documentUrls.push(doc.url);
                    }
                    else {
                        const upload = await this.pinata.upload.file(new File([], doc.url));
                        documentUrls.push(`ipfs://${upload.IpfsHash}`);
                    }
                }
            }
        }
        // Build metadata object
        const metadata = {
            name: prop.title,
            description: prop.description || `${prop.title} - ${prop.address}`,
            image: imageUrls.length > 0 ? imageUrls[0] : '',
            attributes: [
                {
                    trait_type: 'Property Type',
                    value: prop.property_type || 'Residential',
                },
                {
                    trait_type: 'Ownership Type',
                    value: prop.ownership_type || 'Full',
                },
                {
                    trait_type: 'Address',
                    value: prop.address,
                },
                {
                    trait_type: 'Fractional',
                    value: prop.fractional ? 'Yes' : 'No',
                },
                {
                    trait_type: 'Supply',
                    value: prop.supply,
                },
                {
                    trait_type: 'Project ID',
                    value: prop.project_id || '',
                },
                {
                    trait_type: 'Owner',
                    value: prop.owner_username || prop.owner_address || '',
                },
            ],
            fractional: prop.fractional,
            supply: prop.supply,
            projectId: prop.project_id,
            propertyId: prop.id,
            address: prop.address,
            propertyType: prop.property_type,
            ownershipType: prop.ownership_type,
        };
        return metadata;
    }
    async uploadMetadataToIPFS(metadata) {
        try {
            const upload = await this.pinata.upload.json(metadata);
            const cid = upload.IpfsHash;
            // Update property with metadata hash
            await (0, database_1.query)('UPDATE properties SET metadata_hash = ? WHERE id = ?', [cid, metadata.propertyId]);
            return `ipfs://${cid}`;
        }
        catch (error) {
            console.error('Failed to upload metadata to IPFS:', error);
            throw new Error('IPFS upload failed');
        }
    }
    async getMetadataFromIPFS(cid) {
        try {
            const data = await this.pinata.gateways.get(cid.replace('ipfs://', ''));
            return data.data;
        }
        catch (error) {
            console.error('Failed to fetch metadata from IPFS:', error);
            throw new Error('IPFS fetch failed');
        }
    }
}
exports.MetadataService = MetadataService;
exports.metadataService = new MetadataService();
//# sourceMappingURL=metadataService.js.map