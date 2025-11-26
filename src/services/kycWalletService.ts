import { Pool } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { WalletModel } from '../models/walletModel';

/**
 * KYC Wallet Service
 * Handles KYC verification workflow integrated with wallet system
 * Supports mock KYC for testing and real providers (Sumsub, Blockpass, Persona)
 */

export interface KYCProvider {
  name: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
}

export class KYCWalletService {
  private walletModel: WalletModel;
  private kycProvider: KYCProvider;

  constructor(private pool: Pool) {
    this.walletModel = new WalletModel(pool);
    this.kycProvider = {
      name: process.env.KYC_PROVIDER || 'mock',
      apiKey: process.env.KYC_API_KEY,
      apiSecret: process.env.KYC_API_SECRET,
      webhookSecret: process.env.KYC_WEBHOOK_SECRET
    };
  }

  /**
   * Initialize KYC verification for a user
   */
  async initiateKYCVerification(userId: string): Promise<{
    verificationId: string;
    kycUrl?: string;
    status: string;
  }> {
    try {
      // Check if user already has pending verification
      const existingKYC = await this.walletModel.getKYCByUserId(userId);
      if (existingKYC && existingKYC.status === 'pending') {
        return {
          verificationId: existingKYC.id,
          status: 'already_pending'
        };
      }

      // Get or create user wallet
      const wallet = await this.getOrCreateUserWallet(userId);

      // Create KYC verification record
      const verification = await this.walletModel.createKYCVerification(
        userId,
        this.kycProvider.name,
        uuidv4()
      );

      let kycUrl: string | undefined;

      // Route to appropriate provider
      switch (this.kycProvider.name) {
        case 'sumsub':
          kycUrl = await this.initiateSumsubVerification(userId, wallet.wallet_address, verification.id);
          break;
        case 'blockpass':
          kycUrl = await this.initiateBlockpassVerification(userId, verification.id);
          break;
        case 'persona':
          kycUrl = await this.initiatePersonaVerification(userId, verification.id);
          break;
        case 'mock':
        default:
          kycUrl = await this.initiateMockKYCVerification(userId, verification.id);
          break;
      }

      return {
        verificationId: verification.id,
        kycUrl,
        status: 'initiated'
      };
    } catch (error: any) {
      console.error('KYC initiation error:', error);
      throw new Error(`Failed to initiate KYC: ${error.message}`);
    }
  }

  /**
   * Mock KYC Provider (for testing)
   */
  private async initiateMockKYCVerification(userId: string, verificationId: string): Promise<string> {
    return `${process.env.FRONTEND_URL}/kyc/mock/${verificationId}`;
  }

  /**
   * Complete mock KYC verification (for testing)
   */
  async completeMockKYCVerification(userId: string, verificationId: string, kycData: any): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update KYC verification
      await this.walletModel.updateKYCStatus(verificationId, 'approved', kycData);

      // Mark wallet as KYC verified
      const wallet = await this.walletModel.getWalletByUserId(userId);
      if (wallet) {
        await this.walletModel.markKYCVerified(userId, wallet.id);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Sumsub Integration
   */
  private async initiateSumsubVerification(userId: string, walletAddress: string, verificationId: string): Promise<string> {
    try {
      const applicantId = uuidv4();
      return `https://sumsub.com/kyc/${applicantId}`;
    } catch (error) {
      throw new Error('Failed to initiate Sumsub verification');
    }
  }

  /**
   * Blockpass Integration
   */
  private async initiateBlockpassVerification(userId: string, verificationId: string): Promise<string> {
    try {
      return `https://blockpass.org/kyc/${verificationId}`;
    } catch (error) {
      throw new Error('Failed to initiate Blockpass verification');
    }
  }

  /**
   * Persona Integration
   */
  private async initiatePersonaVerification(userId: string, verificationId: string): Promise<string> {
    try {
      return `https://persona.com/kyc/${verificationId}`;
    } catch (error) {
      throw new Error('Failed to initiate Persona verification');
    }
  }

  /**
   * Get KYC verification status for user
   */
  async getKYCStatus(userId: string): Promise<{
    status: string;
    isVerified: boolean;
    verificationDate?: Date;
    expiryDate?: Date;
  }> {
    const kyc = await this.walletModel.getKYCByUserId(userId);
    const wallet = await this.walletModel.getWalletByUserId(userId);

    return {
      status: kyc?.status || 'pending',
      isVerified: wallet?.kyc_status === 'verified',
      verificationDate: kyc?.verification_date || undefined,
      expiryDate: kyc?.expiry_date || undefined
    };
  }

  /**
   * Get detailed KYC information for user
   */
  async getKYCDetails(userId: string): Promise<any> {
    const kyc = await this.walletModel.getKYCByUserId(userId);
    if (!kyc) return null;

    return {
      id: kyc.id,
      userId: kyc.user_id,
      provider: kyc.provider,
      status: kyc.status,
      kycData: kyc.kyc_data ? JSON.parse(kyc.kyc_data) : null,
      verificationDate: kyc.verification_date,
      expiryDate: kyc.expiry_date,
      rejectionReason: kyc.rejection_reason,
      createdAt: kyc.created_at,
      updatedAt: kyc.updated_at
    };
  }

  /**
   * Check if user is KYC verified
   */
  async isKYCVerified(userId: string): Promise<boolean> {
    const wallet = await this.walletModel.getWalletByUserId(userId);
    return wallet?.kyc_status === 'verified' || false;
  }

  /**
   * Verify KYC submission (for mock provider)
   */
  async verifyKYCSubmission(userId: string, kycData: any): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const wallet = await this.walletModel.getWalletByUserId(userId);
      if (!wallet) {
        throw new Error('Wallet not found for user');
      }

      // Get existing KYC verification or create new one
      let kyc = await this.walletModel.getKYCByUserId(userId);
      if (!kyc) {
        kyc = await this.walletModel.createKYCVerification(userId, 'mock', uuidv4());
      }

      // Update KYC status
      await this.walletModel.updateKYCStatus(kyc.id, 'approved', kycData);

      // Mark wallet as KYC verified
      await this.walletModel.markKYCVerified(userId, wallet.id);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Reject KYC submission (admin action)
   */
  async rejectKYCSubmission(userId: string, reason: string): Promise<void> {
    const kyc = await this.walletModel.getKYCByUserId(userId);
    if (!kyc) {
      throw new Error('KYC verification not found');
    }

    await this.walletModel.updateKYCStatus(kyc.id, 'rejected', undefined, reason);
  }

  /**
   * Handle KYC webhook from provider
   */
  async handleKYCWebhook(provider: string, payload: any): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      switch (provider) {
        case 'sumsub':
          await this.handleSumsubWebhook(payload, connection);
          break;
        case 'blockpass':
          await this.handleBlockpassWebhook(payload, connection);
          break;
        case 'persona':
          await this.handlePersonaWebhook(payload, connection);
          break;
        default:
          throw new Error(`Unknown KYC provider: ${provider}`);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Handle Sumsub webhook
   */
  private async handleSumsubWebhook(payload: any, connection: any): Promise<void> {
    console.log('Handling Sumsub webhook:', payload);
  }

  /**
   * Handle Blockpass webhook
   */
  private async handleBlockpassWebhook(payload: any, connection: any): Promise<void> {
    console.log('Handling Blockpass webhook:', payload);
  }

  /**
   * Handle Persona webhook
   */
  private async handlePersonaWebhook(payload: any, connection: any): Promise<void> {
    console.log('Handling Persona webhook:', payload);
  }

  /**
   * Get or create user wallet if it doesn't exist
   */
  private async getOrCreateUserWallet(userId: string): Promise<any> {
    let wallet = await this.walletModel.getWalletByUserId(userId);
    if (!wallet) {
      const { ethers } = await import('ethers');
      const newWallet = ethers.Wallet.createRandom();
      wallet = await this.walletModel.createWallet(userId, newWallet.address);
    }
    return wallet;
  }
}
