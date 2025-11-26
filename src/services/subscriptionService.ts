// Property Subscription Service
// Manages subscription flow, verification, and subscriber management

import { Pool } from 'mysql2/promise';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { Subscription, DisbursementRecord, subscriptionQueries, disbursementQueries } from '../models/subscriptionModel';
import { getProvider } from '../utils/ethersProvider';
import { query } from '../utils/database';
import { WalletService } from './walletService';

export interface CreateSubscriptionRequest {
  propertyId: string;
  subscriberUserId: string;
  subscriberWalletAddress: string;
  subscriptionAmount: string | number;
  currency: string;
  transactionHash?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  transferDetails?: any;
}

export interface CreateDisbursementRequest {
  propertyId: string;
  distributionId: string;
  subscriberId: string;
  disbursementAmount: string;
  currency: string;
  type: 'YIELD' | 'RETURN' | 'REVENUE' | 'DIVIDEND';
}

export interface DisbursementPayload {
  subscriberWalletAddress: string;
  amount: string;
}

export class SubscriptionService {
  private db: Pool;
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer;
  private walletService: WalletService;

  constructor(db: Pool) {
    this.db = db;
    this.provider = getProvider();
    this.signer = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);
    this.walletService = new WalletService(db);
  }

  /**
   * Create a new property subscription
   */
  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    try {
      // Validate property exists
      const propertyResult = await query(
        'SELECT id, owner_id, supply FROM properties WHERE id = ?',
        [request.propertyId]
      );

      if (!propertyResult || propertyResult.length === 0) {
        throw new Error(`Property ${request.propertyId} not found`);
      }

      const property = propertyResult[0];

      // Check if subscription already exists for this property and wallet
      const existingResult = await query(
        'SELECT id FROM subscriptions WHERE property_id = ? AND subscriber_wallet_address = ? AND status = ?',
        [request.propertyId, request.subscriberWalletAddress, 'ACTIVE']
      );

      if (existingResult && existingResult.length > 0) {
        console.log(`User already subscribed to property ${request.propertyId}`);
        throw new Error(`You are already subscribed to this property. Each wallet can only have one active subscription per property.`);
      }

      // Calculate share percentage
      const totalSupply = property.supply || 1;
      const subscriptionAmountStr = String(request.subscriptionAmount);
      const subscriptionAmountNum = parseFloat(subscriptionAmountStr);
      const sharePercentage = (subscriptionAmountNum / totalSupply) * 100;

      // Create subscription
      const subscriptionId = uuidv4();
      const subscription: Subscription = {
        id: subscriptionId,
        property_id: request.propertyId,
        subscriber_user_id: request.subscriberUserId,
        subscriber_wallet_address: request.subscriberWalletAddress,
        subscription_amount: subscriptionAmountStr,
        subscription_date: new Date(),
        status: 'ACTIVE',
        share_percentage: sharePercentage,
        currency: request.currency,
        transaction_hash: request.transactionHash,
        kyc_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await query(subscriptionQueries.insert, [
        subscription.id,
        subscription.property_id,
        subscription.subscriber_user_id,
        subscription.subscriber_wallet_address,
        subscription.subscription_amount,
        subscription.subscription_date,
        subscription.status,
        subscription.share_percentage,
        subscription.currency,
        subscription.transaction_hash,
        subscription.kyc_verified,
      ]);

      return subscription;
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw error;
    }
  }

  /**
   * Get all subscriptions for a property
   */
  async getSubscriptionsByProperty(propertyId: string): Promise<Subscription[]> {
    try {
      const subscriptions = await query(subscriptionQueries.findByPropertyId, [propertyId]);
      return subscriptions as Subscription[];
    } catch (error) {
      console.error('Failed to fetch subscriptions by property:', error);
      throw error;
    }
  }

  /**
   * Get active subscriptions for a property
   */
  async getActiveSubscriptionsByProperty(propertyId: string): Promise<Subscription[]> {
    try {
      const subscriptions = await query(subscriptionQueries.findActiveSubscriptionsByProperty, [
        propertyId,
      ]);
      return subscriptions as Subscription[];
    } catch (error) {
      console.error('Failed to fetch active subscriptions:', error);
      throw error;
    }
  }

  /**
   * Get subscriptions for a subscriber user
   */
  async getSubscriptionsBySubscriber(subscriberUserId: string): Promise<Subscription[]> {
    try {
      const subscriptions = await query(subscriptionQueries.findBySubscriberUserId, [
        subscriberUserId,
      ]);
      return subscriptions as Subscription[];
    } catch (error) {
      console.error('Failed to fetch subscriptions by subscriber:', error);
      throw error;
    }
  }

  /**
    * Get subscriptions by wallet address
    */
  async getSubscriptionsByWallet(walletAddress: string): Promise<Subscription[]> {
    try {
      const subscriptions = await query(subscriptionQueries.findBySubscriberWallet, [
        walletAddress,
      ]);
      return subscriptions as Subscription[];
    } catch (error) {
      console.error('Failed to fetch subscriptions by wallet:', error);
      throw error;
    }
  }

  /**
    * Get user's subscription to a specific property
    */
  async getUserSubscriptionForProperty(propertyId: string, walletAddress: string): Promise<Subscription> {
    try {
      const result = await query(
        'SELECT * FROM subscriptions WHERE property_id = ? AND subscriber_wallet_address = ?',
        [propertyId, walletAddress]
      );
      
      if (!result || result.length === 0) {
        throw new Error(`No subscription found for property ${propertyId} and wallet ${walletAddress}`);
      }

      return result[0] as Subscription;
    } catch (error) {
      console.error('Failed to fetch user subscription for property:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await query(subscriptionQueries.updateStatus, ['CANCELLED', subscriptionId]);
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  /**
   * Verify KYC for a subscription
   */
  async verifySubscriptionKYC(subscriptionId: string, verified: boolean): Promise<void> {
    try {
      await query(subscriptionQueries.updateKycStatus, [verified, subscriptionId]);
    } catch (error) {
      console.error('Failed to update KYC status:', error);
      throw error;
    }
  }

  /**
   * Get total number of subscribers for a property
   */
  async getTotalSubscriberCount(propertyId: string): Promise<number> {
    try {
      const result = await query(subscriptionQueries.findTotalSubscribersByProperty, [
        propertyId,
      ]);
      return result[0]?.total_subscribers || 0;
    } catch (error) {
      console.error('Failed to fetch total subscriber count:', error);
      throw error;
    }
  }

  /**
   * Get total subscription amount for a property
   */
  async getTotalSubscriptionAmount(propertyId: string): Promise<string> {
    try {
      const result = await query(subscriptionQueries.findTotalSubscriptionAmount, [propertyId]);
      return result[0]?.total_amount || '0';
    } catch (error) {
      console.error('Failed to fetch total subscription amount:', error);
      throw error;
    }
  }

  /**
   * Create a disbursement record for subscribers
   */
  async createDisbursement(request: CreateDisbursementRequest): Promise<DisbursementRecord> {
    try {
      const disbursementId = uuidv4();
      const disbursement: DisbursementRecord = {
        id: disbursementId,
        property_id: request.propertyId,
        distribution_id: request.distributionId,
        subscriber_id: request.subscriberId,
        subscriber_wallet_address: '',
        disbursement_amount: request.disbursementAmount,
        disbursement_date: new Date(),
        currency: request.currency,
        type: request.type,
        status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Get subscriber wallet address
      const subscriberResult = await query(subscriptionQueries.findById, [request.subscriberId]);
      if (subscriberResult && subscriberResult.length > 0) {
        disbursement.subscriber_wallet_address = subscriberResult[0].subscriber_wallet_address;
      }

      await query(disbursementQueries.insert, [
        disbursement.id,
        disbursement.property_id,
        disbursement.distribution_id,
        disbursement.subscriber_id,
        disbursement.subscriber_wallet_address,
        disbursement.disbursement_amount,
        disbursement.disbursement_date,
        disbursement.currency,
        disbursement.type,
        disbursement.status,
      ]);

      return disbursement;
    } catch (error) {
      console.error('Failed to create disbursement:', error);
      throw error;
    }
  }

  /**
   * Create multiple disbursements for all subscribers of a property
   */
  async createDisbursementsForAllSubscribers(
    propertyId: string,
    distributionId: string,
    disbursementAmountPerSubscriber: string,
    currency: string,
    type: 'YIELD' | 'RETURN' | 'REVENUE' | 'DIVIDEND'
  ): Promise<DisbursementRecord[]> {
    try {
      const activeSubscriptions = await this.getActiveSubscriptionsByProperty(propertyId);

      const disbursements: DisbursementRecord[] = [];

      for (const subscription of activeSubscriptions) {
        const disbursement = await this.createDisbursement({
          propertyId,
          distributionId,
          subscriberId: subscription.id!,
          disbursementAmount: disbursementAmountPerSubscriber,
          currency,
          type,
        });
        disbursements.push(disbursement);
      }

      return disbursements;
    } catch (error) {
      console.error('Failed to create disbursements for all subscribers:', error);
      throw error;
    }
  }

  /**
   * Get all disbursements for a property
   */
  async getDisbursementsByProperty(propertyId: string): Promise<DisbursementRecord[]> {
    try {
      const disbursements = await query(disbursementQueries.findByPropertyId, [propertyId]);
      return disbursements as DisbursementRecord[];
    } catch (error) {
      console.error('Failed to fetch disbursements by property:', error);
      throw error;
    }
  }

  /**
   * Get disbursements by distribution
   */
  async getDisbursementsByDistribution(distributionId: string): Promise<DisbursementRecord[]> {
    try {
      const disbursements = await query(disbursementQueries.findByDistributionId, [
        distributionId,
      ]);
      return disbursements as DisbursementRecord[];
    } catch (error) {
      console.error('Failed to fetch disbursements by distribution:', error);
      throw error;
    }
  }

  /**
   * Get disbursements for a subscriber
   */
  async getDisbursementsBySubscriber(subscriberId: string): Promise<DisbursementRecord[]> {
    try {
      const disbursements = await query(disbursementQueries.findBySubscriberId, [subscriberId]);
      return disbursements as DisbursementRecord[];
    } catch (error) {
      console.error('Failed to fetch disbursements by subscriber:', error);
      throw error;
    }
  }

  /**
   * Get disbursements by wallet address
   */
  async getDisbursementsByWallet(walletAddress: string): Promise<DisbursementRecord[]> {
    try {
      const disbursements = await query(disbursementQueries.findBySubscriberWallet, [
        walletAddress,
      ]);
      return disbursements as DisbursementRecord[];
    } catch (error) {
      console.error('Failed to fetch disbursements by wallet:', error);
      throw error;
    }
  }

  /**
   * Get pending disbursements
   */
  async getPendingDisbursements(): Promise<DisbursementRecord[]> {
    try {
      const disbursements = await query(disbursementQueries.findPendingDisbursements, []);
      return disbursements as DisbursementRecord[];
    } catch (error) {
      console.error('Failed to fetch pending disbursements:', error);
      throw error;
    }
  }

  /**
   * Get pending disbursements for a property
   */
  async getPendingDisbursementsByProperty(propertyId: string): Promise<DisbursementRecord[]> {
    try {
      const disbursements = await query(disbursementQueries.findPendingByProperty, [propertyId]);
      return disbursements as DisbursementRecord[];
    } catch (error) {
      console.error('Failed to fetch pending disbursements by property:', error);
      throw error;
    }
  }

  /**
   * Execute a disbursement on blockchain and credit in-app wallet
   */
  async executeDisbursement(
    disbursementId: string,
    tokenAddress: string,
    senderAddress: string
  ): Promise<string> {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      // Get disbursement details
      const disbursementResult = await query(disbursementQueries.findById, [disbursementId]);
      if (!disbursementResult || disbursementResult.length === 0) {
        throw new Error(`Disbursement ${disbursementId} not found`);
      }

      const disbursement = disbursementResult[0];

      // Create token contract instance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function transfer(address to, uint256 amount) external returns (bool)',
          'function decimals() public view returns (uint8)',
        ],
        this.signer
      );

      // Get token decimals
      const decimals = await tokenContract.decimals();

      // Parse the amount
      const parsedAmount = ethers.parseUnits(disbursement.disbursement_amount, decimals);

      // Execute transfer
      const tx = await tokenContract.transfer(disbursement.subscriber_wallet_address, parsedAmount);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction failed to execute');
      }

      // Update disbursement status
      await query(disbursementQueries.updateStatus, [
        'EXECUTED',
        receipt.hash,
        disbursementId,
      ]);

      // Credit the in-app wallet of the subscriber
      const disbursementAmount = parseFloat(disbursement.disbursement_amount);
      try {
        await this.walletService.disburseROI(
          disbursement.subscriber_user_id || '',
          disbursementAmount,
          disbursement.subscription_id || '',
          0 // ROI percentage (can be calculated if needed)
        );
        console.log(`In-app wallet credited for user ${disbursement.subscriber_user_id}: ${disbursementAmount} USDC`);
      } catch (walletError) {
        console.warn(`Failed to credit in-app wallet: ${walletError}. Continuing with blockchain transaction.`);
      }

      await connection.commit();

      console.log(`Disbursement executed: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      await connection.rollback();
      console.error('Failed to execute disbursement:', error);
      // Mark as failed
      await query(disbursementQueries.updateStatus, ['FAILED', null, disbursementId]);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute multiple disbursements in batch
   */
  async executeBatchDisbursements(
    disbursementIds: string[],
    tokenAddress: string
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const disbursementId of disbursementIds) {
      try {
        const txHash = await this.executeDisbursement(disbursementId, tokenAddress, '');
        results.set(disbursementId, txHash);
      } catch (error) {
        console.error(`Failed to execute disbursement ${disbursementId}:`, error);
        results.set(disbursementId, 'FAILED');
      }
    }

    return results;
  }

  /**
   * Get total disbursed amount for a subscriber
   */
  async getTotalDisbursedBySubscriber(subscriberId: string): Promise<string> {
    try {
      const result = await query(disbursementQueries.findTotalDisbursedBySubscriber, [
        subscriberId,
      ]);
      return result[0]?.total_disbursed || '0';
    } catch (error) {
      console.error('Failed to fetch total disbursed by subscriber:', error);
      throw error;
    }
  }

  /**
   * Get total disbursed amount for a property
   */
  async getTotalDisbursedByProperty(propertyId: string): Promise<string> {
    try {
      const result = await query(disbursementQueries.findTotalDisbursedByProperty, [propertyId]);
      return result[0]?.total_disbursed || '0';
    } catch (error) {
      console.error('Failed to fetch total disbursed by property:', error);
      throw error;
    }
  }

  /**
    * Get disbursements within a date range
    */
  async getDisbursementsByDateRange(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DisbursementRecord[]> {
    try {
      const disbursements = await query(disbursementQueries.findDisbursementsByDateRange, [
        propertyId,
        startDate,
        endDate,
      ]);
      return disbursements as DisbursementRecord[];
    } catch (error) {
      console.error('Failed to fetch disbursements by date range:', error);
      throw error;
    }
  }

  /**
   * Get property subscription allotments
   */
  async getPropertyAllotments(propertyId: string): Promise<any> {
    try {
      const result = await query(
        'SELECT * FROM property_allotments WHERE property_id = ?',
        [propertyId]
      );
      
      if (!result || result.length === 0) {
        return {
          propertyId,
          totalAllotment: 0,
          pricePerShare: 0,
          availableShares: 0,
          subscribedAmount: 0,
          remainingCapacity: 0,
        };
      }

      const allotment = result[0];
      const subscriptions = await this.getActiveSubscriptionsByProperty(propertyId);
      const subscribedAmount = subscriptions.reduce((sum: number, sub: any) => {
        return sum + parseFloat(sub.subscription_amount || 0);
      }, 0);

      return {
        propertyId,
        totalAllotment: allotment.total_allotment,
        pricePerShare: allotment.price_per_share,
        availableShares: allotment.available_shares,
        subscribedAmount,
        remainingCapacity: parseFloat(allotment.total_allotment) - subscribedAmount,
        remainingPercentage: ((parseFloat(allotment.total_allotment) - subscribedAmount) / parseFloat(allotment.total_allotment)) * 100,
      };
    } catch (error) {
      console.error('Failed to fetch property allotments:', error);
      throw error;
    }
  }

  /**
   * Set property subscription allotments
   */
  async setPropertyAllotments(allotmentData: any): Promise<any> {
    try {
      const { propertyId, totalAllotment, pricePerShare, availableShares } = allotmentData;

      // Check if allotment already exists
      const existingResult = await query(
        'SELECT id FROM property_allotments WHERE property_id = ?',
        [propertyId]
      );

      if (existingResult && existingResult.length > 0) {
        // Update existing
        await query(
          `UPDATE property_allotments 
          SET total_allotment = ?, price_per_share = ?, available_shares = ?, updated_at = NOW()
          WHERE property_id = ?`,
          [totalAllotment, pricePerShare, availableShares || totalAllotment, propertyId]
        );
      } else {
        // Create new
        await query(
          `INSERT INTO property_allotments 
          (property_id, total_allotment, price_per_share, available_shares, created_at, updated_at)
          VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [propertyId, totalAllotment, pricePerShare, availableShares || totalAllotment]
        );
      }

      return this.getPropertyAllotments(propertyId);
    } catch (error) {
      console.error('Failed to set property allotments:', error);
      throw error;
    }
  }

  /**
   * Check subscription availability
   */
  async checkAvailability(propertyId: string, requestedAmount?: number): Promise<any> {
    try {
      const allotments = await this.getPropertyAllotments(propertyId);

      // If no allotment is set, assume unlimited availability
      if (allotments.totalAllotment === 0) {
        return {
          isAvailable: true,
          totalCapacity: null,
          availableAmount: null,
          reason: 'No allotment limit set',
        };
      }

      const available = allotments.remainingCapacity > 0;

      if (requestedAmount && requestedAmount > allotments.remainingCapacity) {
        return {
          isAvailable: false,
          availableAmount: allotments.remainingCapacity,
          requestedAmount,
          reason: `Insufficient capacity. Available: ${allotments.remainingCapacity}, Requested: ${requestedAmount}`,
        };
      }

      return {
        isAvailable: available,
        totalCapacity: allotments.totalAllotment,
        subscribedAmount: allotments.subscribedAmount,
        availableAmount: allotments.remainingCapacity,
        remainingPercentage: allotments.remainingPercentage,
      };
    } catch (error) {
      console.error('Failed to check availability:', error);
      throw error;
    }
  }

  /**
   * Get transfer account details for a property
   */
  async getTransferAccountDetails(propertyId: string): Promise<any> {
    try {
      const result = await query(
        'SELECT * FROM property_transfer_accounts WHERE property_id = ?',
        [propertyId]
      );

      if (!result || result.length === 0) {
        return null;
      }

      return result[0];
    } catch (error) {
      console.error('Failed to fetch transfer account details:', error);
      throw error;
    }
  }

  /**
   * Setup transfer account for a property
   */
  async setupTransferAccount(accountData: any): Promise<any> {
    try {
      const {
        propertyId,
        accountHolder,
        bankName,
        accountNumber,
        routingNumber,
        swiftCode,
        iban,
        currency,
        reference,
      } = accountData;

      // Check if account already exists
      const existingResult = await query(
        'SELECT id FROM property_transfer_accounts WHERE property_id = ?',
        [propertyId]
      );

      if (existingResult && existingResult.length > 0) {
        // Update existing
        await query(
          `UPDATE property_transfer_accounts 
          SET account_holder = ?, bank_name = ?, account_number = ?, routing_number = ?, 
              swift_code = ?, iban = ?, currency = ?, reference = ?, updated_at = NOW()
          WHERE property_id = ?`,
          [
            accountHolder,
            bankName,
            accountNumber,
            routingNumber,
            swiftCode,
            iban,
            currency,
            reference,
            propertyId,
          ]
        );
      } else {
        // Create new
        await query(
          `INSERT INTO property_transfer_accounts 
          (property_id, account_holder, bank_name, account_number, routing_number, swift_code, iban, currency, reference, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            propertyId,
            accountHolder,
            bankName,
            accountNumber,
            routingNumber,
            swiftCode,
            iban,
            currency,
            reference,
          ]
        );
      }

      return this.getTransferAccountDetails(propertyId);
    } catch (error) {
      console.error('Failed to setup transfer account:', error);
      throw error;
    }
  }
}
