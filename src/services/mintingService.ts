require("dotenv").config(); 
import { ethers } from 'ethers';
import { query } from '../utils/database';
import { metadataService } from './metadataService';
import { getProvider } from '../utils/ethersProvider';

export interface MintingResult {
  tokenId: number;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
}

export class MintingService {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer;
  private titleRegistrarContract: ethers.Contract;

  constructor() {
    if (!process.env.BASE_RPC_URL) {
      throw new Error('BASE_RPC_URL environment variable is required');
    }
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }
    if (!process.env.TITLE_REGISTRAR_ADDRESS) {
      throw new Error('TITLE_REGISTRAR_ADDRESS environment variable is required');
    }

    this.provider = getProvider();
    this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);

    // TitleRegistrar contract ABI (simplified)
    const titleRegistrarAbi = [
      "function mintPropertyToken(address owner, string memory metadataURI, bool fractional, uint256 supply) external returns (uint256)",
      "event PropertyMinted(uint256 indexed tokenId, address indexed owner, string metadataURI, bool fractional, uint256 supply)"
    ];

    this.titleRegistrarContract = new ethers.Contract(
      process.env.TITLE_REGISTRAR_ADDRESS,
      titleRegistrarAbi,
      this.signer
    );
  }

  async mintToken(propertyId: string): Promise<MintingResult> {
    try {
      // Get property data
      const property = await query(
        'SELECT * FROM properties WHERE id = ?',
        [propertyId]
      );

      if (!property || property.length === 0) {
        throw new Error(`Property ${propertyId} not found`);
      }

      const prop = property[0];

      if (prop.status !== 'APPROVED') {
        throw new Error(`Property ${propertyId} is not approved for minting`);
      }

      // Prepare metadata if not already done
      let metadataURI = prop.metadata_hash;
      if (!metadataURI) {
        const metadata = await metadataService.prepareMetadata(propertyId);
        metadataURI = await metadataService.uploadMetadataToIPFS(metadata);
        metadataURI = metadataURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
      }

      // Get owner address
      const user = await query(
        'SELECT wallet_address FROM users WHERE id = ?',
        [prop.user_id]
      );

      if (!user || user.length === 0 || !user[0].wallet_address) {
        throw new Error(`User wallet address not found for property ${propertyId}`);
      }

      const ownerAddress = user[0].wallet_address;

      // Estimate gas before sending transaction
      const estimatedGas = await this.titleRegistrarContract.mintPropertyToken.estimateGas(
        ownerAddress,
        metadataURI,
        prop.fractional,
        prop.supply
      );

      // Mint the token with gas buffer
      console.log(`Minting token for property ${propertyId}...`);
      const tx = await this.titleRegistrarContract.mintPropertyToken(
        ownerAddress,
        metadataURI,
        prop.fractional,
        prop.supply,
        {
          gasLimit: estimatedGas * BigInt(120) / BigInt(100), // 20% buffer
        }
      );

      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();

      // Parse tokenId from events
      const mintEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = this.titleRegistrarContract.interface.parseLog(log);
          return parsed?.name === 'PropertyMinted';
        } catch {
          return false;
        }
      });

      if (!mintEvent) {
        throw new Error('Mint event not found in transaction receipt');
      }

      const parsedEvent = this.titleRegistrarContract.interface.parseLog(mintEvent);
      const tokenId = Number(parsedEvent?.args?.tokenId);

      // Update property with tokenId (idempotent operation)
      await query(
        'UPDATE properties SET token_id = ?, status = "MINTED", minted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (token_id IS NULL OR token_id = ?)',
        [tokenId, propertyId, tokenId]
      );

      const result: MintingResult = {
        tokenId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };

      console.log(`Token minted successfully: ${tokenId}`);
      return result;

    } catch (error) {
      console.error('Minting failed:', error);
      throw error;
    }
  }

  async getMintingStatus(propertyId: string): Promise<{
    status: string;
    tokenId?: number;
    transactionHash?: string;
    error?: string;
  }> {
    const property = await query(
      'SELECT status, token_id FROM properties WHERE id = ?',
      [propertyId]
    );

    if (!property || property.length === 0) {
      return { status: 'NOT_FOUND' };
    }

    const prop = property[0];
    return {
      status: prop.status,
      tokenId: prop.token_id,
    };
  }

  async retryMint(propertyId: string): Promise<MintingResult> {
    // Reset status to APPROVED to allow re-minting
    await query(
      'UPDATE properties SET status = "APPROVED", token_id = NULL WHERE id = ?',
      [propertyId]
    );

    return this.mintToken(propertyId);
  }
}

export const mintingService = new MintingService();