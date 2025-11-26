import { ethers } from 'ethers';
import { query } from '../utils/database';
import { tbaService } from './tbaService';
import { distributionQueries, shareholderQueries } from '../models/distributionModel';

import { getProvider } from '../utils/ethersProvider';
export interface DistributionRequest {
  propertyId: string;
  tokenId?: number;
  amount: string;
  currency: string;
  type: 'INITIAL' | 'YIELD' | 'REVENUE' | 'AIRDROP' | 'VESTING';
  receivers: Array<{
    address: string;
    userId?: string;
    amount: string;
  }>;
  distributionData?: any;
}

export interface ShareholderInfo {
  userId: string;
  walletAddress: string;
  sharesOwned: number;
  percentageOwned: number;
  kycVerified: boolean;
}

export class DistributionService {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer;

  constructor() {
    this.provider = getProvider();
    this.signer = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);
  }

  async distributeInitialShares(propertyId: string, tokenId: number): Promise<void> {
    try {
      // Get property details
      const property = await query(
        'SELECT * FROM properties WHERE id = ?',
        [propertyId]
      );

      if (!property || property.length === 0) {
        throw new Error(`Property ${propertyId} not found`);
      }

      const prop = property[0];

      if (!prop.fractional || prop.supply <= 1) {
        console.log(`Property ${propertyId} is not fractional, skipping initial distribution`);
        return;
      }

      // Default distribution: 100% to owner initially
      const owner = await query(
        'SELECT id, wallet_address FROM users WHERE id = ?',
        [prop.user_id]
      );

      if (!owner || owner.length === 0) {
        throw new Error(`Owner not found for property ${propertyId}`);
      }

      const distributionRequest: DistributionRequest = {
        propertyId,
        tokenId,
        amount: prop.supply.toString(),
        currency: 'SHARES',
        type: 'INITIAL',
        receivers: [{
          address: owner[0].wallet_address,
          userId: owner[0].id,
          amount: prop.supply.toString(),
        }],
      };

      await this.createDistribution(distributionRequest);

      // Record shareholders
      await this.recordShareholder({
        propertyId,
        tokenId,
        userId: owner[0].id,
        walletAddress: owner[0].wallet_address,
        sharesOwned: prop.supply,
        percentageOwned: 100.0,
        kycVerified: false, // Would be checked separately
      });

    } catch (error) {
      console.error('Initial share distribution failed:', error);
      throw error;
    }
  }

  async distributeYieldToTBA(tokenId: number, amount: string, currency: string): Promise<string> {
    try {
      // Get TBA address
      const property = await query(
        'SELECT tba_address FROM properties WHERE token_id = ?',
        [tokenId]
      );

      if (!property || property.length === 0 || !property[0].tba_address) {
        throw new Error(`TBA not found for token ${tokenId}`);
      }

      const tbaAddress = property[0].tba_address;

      // Get token contract address
      const tokenAddress = this.getTokenAddress(currency);
      if (!tokenAddress) {
        throw new Error(`Unsupported currency: ${currency}`);
      }

      // Transfer tokens to TBA (assuming we have tokens to distribute)
      // In practice, this would be done by the revenue collection system
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ["function transfer(address to, uint256 amount) external returns (bool)"],
        this.signer
      );

      const tx = await tokenContract.transfer(tbaAddress, ethers.parseEther(amount));
      const receipt = await tx.wait();

      // Record the distribution
      const distributionRequest: DistributionRequest = {
        propertyId: property[0].id,
        tokenId,
        amount,
        currency,
        type: 'YIELD',
        receivers: [{
          address: tbaAddress,
          amount,
        }],
      };

      await this.createDistribution(distributionRequest);

      console.log(`Yield distributed to TBA: ${receipt.hash}`);
      return receipt.hash;

    } catch (error) {
      console.error('Yield distribution to TBA failed:', error);
      throw error;
    }
  }

  async distributeYield(tokenId: number): Promise<void> {
    try {
      // Get TBA balance for each supported currency
      const property = await query(
        'SELECT id, tba_address FROM properties WHERE token_id = ?',
        [tokenId]
      );

      if (!property || property.length === 0 || !property[0].tba_address) {
        throw new Error(`TBA not found for token ${tokenId}`);
      }

      const tbaAddress = property[0].tba_address;
      const propertyId = property[0].id;

      // Get shareholders
      const shareholders = await this.getShareholders(propertyId);

      const currencies = ['USDC', 'dNZD', 'dAUD'];

      for (const currency of currencies) {
        const tokenAddress = this.getTokenAddress(currency);
        if (!tokenAddress) continue;

        const balance = await tbaService.getTBABalance(tbaAddress, tokenAddress);
        if (parseFloat(balance) <= 0) continue;

        // Distribute proportionally to shareholders
        const totalShares = shareholders.reduce((sum, sh) => sum + sh.sharesOwned, 0);

        for (const shareholder of shareholders) {
          const shareAmount = (parseFloat(balance) * shareholder.sharesOwned) / totalShares;

          if (shareAmount > 0) {
            // Generate voucher for withdrawal
            const { voucher, signature } = await tbaService.generateWithdrawalVoucher(
              tbaAddress,
              shareholder.walletAddress,
              shareAmount.toString(),
              tokenAddress
            );

            // Record distribution
            const distributionRequest: DistributionRequest = {
              propertyId,
              tokenId,
              amount: shareAmount.toString(),
              currency,
              type: 'YIELD',
              receivers: [{
                address: shareholder.walletAddress,
                userId: shareholder.userId,
                amount: shareAmount.toString(),
              }],
              distributionData: { voucher, signature },
            };

            await this.createDistribution(distributionRequest);
          }
        }
      }

    } catch (error) {
      console.error('Yield distribution failed:', error);
      throw error;
    }
  }

  async airdropShares(propertyId: string, receivers: Array<{ address: string; amount: number }>): Promise<void> {
    try {
      const property = await query(
        'SELECT token_id, supply FROM properties WHERE id = ?',
        [propertyId]
      );

      if (!property || property.length === 0) {
        throw new Error(`Property ${propertyId} not found`);
      }

      const tokenId = property[0].token_id;

      for (const receiver of receivers) {
        const distributionRequest: DistributionRequest = {
          propertyId,
          tokenId,
          amount: receiver.amount.toString(),
          currency: 'SHARES',
          type: 'AIRDROP',
          receivers: [{
            address: receiver.address,
            amount: receiver.amount.toString(),
          }],
        };

        await this.createDistribution(distributionRequest);

        // Update shareholder records
        await this.recordShareholder({
          propertyId,
          tokenId,
          userId: '', // Would need to resolve from address
          walletAddress: receiver.address,
          sharesOwned: receiver.amount,
          percentageOwned: (receiver.amount / property[0].supply) * 100,
          kycVerified: false,
        });
      }

    } catch (error) {
      console.error('Airdrop failed:', error);
      throw error;
    }
  }

  async lockReservedShares(propertyId: string, lockDuration: number): Promise<void> {
    try {
      // Implementation for locking reserved shares (advisors, treasury, etc.)
      // This would typically involve vesting schedules
      console.log(`Locking reserved shares for property ${propertyId} for ${lockDuration} seconds`);
      // Implementation details would depend on the vesting contract
    } catch (error) {
      console.error('Locking reserved shares failed:', error);
      throw error;
    }
  }

  private async createDistribution(request: DistributionRequest): Promise<void> {
    const { v4: uuidv4 } = await import('uuid');

    for (const receiver of request.receivers) {
      const distributionId = uuidv4();

      await query(distributionQueries.insert, [
        distributionId,
        request.propertyId,
        request.tokenId || null,
        receiver.amount,
        request.currency,
        request.type,
        'PENDING',
        receiver.address,
        receiver.userId || null,
        request.distributionData || null,
      ]);
    }
  }

  private async recordShareholder(shareholder: ShareholderInfo & { propertyId: string; tokenId?: number }): Promise<void> {
    const { v4: uuidv4 } = await import('uuid');

    await query(shareholderQueries.insert, [
      uuidv4(),
      shareholder.propertyId,
      shareholder.tokenId || null,
      shareholder.userId,
      shareholder.walletAddress,
      shareholder.sharesOwned,
      shareholder.percentageOwned,
      new Date(),
      null, // acquisition_price
      null, // vesting_schedule
      shareholder.kycVerified,
    ]);
  }

  async getShareholders(propertyId: string): Promise<ShareholderInfo[]> {
    const shareholders = await query(shareholderQueries.findByPropertyId, [propertyId]);
    return shareholders.map((sh: any) => ({
      userId: sh.user_id,
      walletAddress: sh.wallet_address,
      sharesOwned: Number(sh.shares_owned),
      percentageOwned: Number(sh.percentage_owned),
      kycVerified: sh.kyc_verified,
    }));
  }

  private getTokenAddress(currency: string): string | null {
    const addresses: { [key: string]: string } = {
      'USDC': process.env.USDC_ADDRESS!,
      'dNZD': process.env.DNZD_ADDRESS!,
      'dAUD': process.env.DAUD_ADDRESS!,
    };
    return addresses[currency] || null;
  }

  async recordDistributionEvent(
    propertyId: string,
    tokenId: number,
    amount: string,
    type: string,
    txHash: string,
    receivers: Array<{ address: string; amount: string }>
  ): Promise<void> {
    // Update distribution status to EXECUTED
    for (const receiver of receivers) {
      await query(
        `UPDATE distributions SET status = 'EXECUTED', executed_at = CURRENT_TIMESTAMP, tx_hash = ? WHERE property_id = ? AND receiver_address = ? AND amount = ? AND type = ?`,
        [txHash, propertyId, receiver.address, receiver.amount, type]
      );
    }
  }
}

export const distributionService = new DistributionService();