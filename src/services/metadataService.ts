import { PinataSDK } from 'pinata-web3';
import { query } from '../utils/database';

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

export class MetadataService {
  private pinata: PinataSDK;

  constructor() {
    this.pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT!,
      pinataGateway: process.env.PINATA_GATEWAY || 'gateway.pinata.cloud',
    });
  }

  async prepareMetadata(propertyId: string): Promise<PropertyMetadata> {
    // Fetch property data from database
    const property = await query(
      `SELECT p.*, u.username as owner_username, u.wallet_address as owner_address
       FROM properties p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [propertyId]
    );

    if (!property || property.length === 0) {
      throw new Error(`Property ${propertyId} not found`);
    }

    const prop = property[0];

    // Upload images and documents to IPFS
    const imageUrls: string[] = [];
    if (prop.images && Array.isArray(prop.images)) {
      for (const image of prop.images) {
        if (image.url) {
          // If already IPFS, use as is
          if (image.url.startsWith('ipfs://')) {
            imageUrls.push(image.url);
          } else {
            // Upload to IPFS
            const upload = await this.pinata.upload.file(new File([], image.url));
            imageUrls.push(`ipfs://${upload.IpfsHash}`);
          }
        }
      }
    }

    const documentUrls: string[] = [];
    if (prop.documents && Array.isArray(prop.documents)) {
      for (const doc of prop.documents) {
        if (doc.url) {
          if (doc.url.startsWith('ipfs://')) {
            documentUrls.push(doc.url);
          } else {
            const upload = await this.pinata.upload.file(new File([], doc.url));
            documentUrls.push(`ipfs://${upload.IpfsHash}`);
          }
        }
      }
    }

    // Build metadata object
    const metadata: PropertyMetadata = {
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

  async uploadMetadataToIPFS(metadata: PropertyMetadata): Promise<string> {
    try {
      const upload = await this.pinata.upload.json(metadata);
      const cid = upload.IpfsHash;

      // Update property with metadata hash
      await query(
        'UPDATE properties SET metadata_hash = ? WHERE id = ?',
        [cid, metadata.propertyId]
      );

      return `ipfs://${cid}`;
    } catch (error) {
      console.error('Failed to upload metadata to IPFS:', error);
      throw new Error('IPFS upload failed');
    }
  }

  async getMetadataFromIPFS(cid: string): Promise<PropertyMetadata> {
    try {
      const data = await this.pinata.gateways.get(cid.replace('ipfs://', ''));
      return data.data as unknown as PropertyMetadata;
    } catch (error) {
      console.error('Failed to fetch metadata from IPFS:', error);
      throw new Error('IPFS fetch failed');
    }
  }
}

export const metadataService = new MetadataService();