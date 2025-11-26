import { Pool } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { query } from '../utils/database';
import { WalletModel } from '../models/walletModel';

export interface KYCVerification {
  id: string;
  userId: string;
  provider: string;
  providerId?: string;
  status: 'pending' | 'approved' | 'rejected';
  kycData?: any;
  rejectionReason?: string;
  verificationDate?: Date;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class KYCIntegrationService {
  private pool: Pool;
  private walletModel: WalletModel;
  private provider: string;

  constructor(pool: Pool) {
    this.pool = pool;
    this.walletModel = new WalletModel(pool);
    this.provider = process.env.KYC_PROVIDER || 'mock';
  }

  /**
   * Initialize KYC verification with selected provider
   */
  async initializeVerification(userId: string, walletAddress: string): Promise<{
    verificationId: string;
    provider: string;
    redirectUrl: string;
  }> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const verificationId = uuidv4();

      // Create verification record
      await query(
        `INSERT INTO kyc_verifications 
         (id, user_id, provider, status, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', NOW(), NOW())`,
        [verificationId, userId, this.provider]
      );

      let redirectUrl = '';
      let providerId = '';

      // Route to appropriate provider
      switch (this.provider) {
        case 'sumsub':
          ({ redirectUrl, providerId } = await this.initiateSumsubVerification(
            userId,
            verificationId,
            walletAddress
          ));
          break;
        case 'blockpass':
          ({ redirectUrl, providerId } = await this.initiateBlockpassVerification(
            userId,
            verificationId
          ));
          break;
        case 'persona':
          ({ redirectUrl, providerId } = await this.initiatePersonaVerification(
            userId,
            verificationId
          ));
          break;
        case 'mock':
        default:
          ({ redirectUrl, providerId } = await this.initiateMockVerification(
            userId,
            verificationId
          ));
          break;
      }

      // Store provider ID if applicable
      if (providerId) {
        await query(
          `UPDATE kyc_verifications SET provider_id = ? WHERE id = ?`,
          [providerId, verificationId]
        );
      }

      await connection.commit();

      return {
        verificationId,
        provider: this.provider,
        redirectUrl
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Sumsub Provider Implementation
   */
  private async initiateSumsubVerification(
    userId: string,
    verificationId: string,
    walletAddress: string
  ): Promise<{ redirectUrl: string; providerId: string }> {
    try {
      const applicantId = uuidv4();
      const apiKey = process.env.SUMSUB_API_KEY;

      if (!apiKey) {
        throw new Error('Sumsub API key not configured');
      }

      // Create applicant via Sumsub API
      const response = await axios.post(
        'https://api.sumsub.com/resources/applicants?levelName=basic-kyc',
        {
          externalUserId: userId,
          email: '', // Would be retrieved from user data
          phone: ''
        },
        {
          headers: {
            'X-App-Token': apiKey,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      const sumsubApplicantId = response.data.id;

      // Get access token for web SDK
      const tokenResponse = await axios.post(
        `https://api.sumsub.com/resources/accessTokens?userId=${sumsubApplicantId}`,
        {},
        {
          headers: {
            'X-App-Token': apiKey
          }
        }
      );

      const accessToken = tokenResponse.data.token;

      return {
        redirectUrl: `${process.env.FRONTEND_URL}/kyc/sumsub?token=${accessToken}`,
        providerId: sumsubApplicantId
      };
    } catch (error: any) {
      console.error('Sumsub initialization failed:', error);
      throw new Error(`Sumsub initialization failed: ${error.message}`);
    }
  }

  /**
   * Blockpass Provider Implementation
   */
  private async initiateBlockpassVerification(
    userId: string,
    verificationId: string
  ): Promise<{ redirectUrl: string; providerId: string }> {
    try {
      const clientId = process.env.BLOCKPASS_CLIENT_ID;

      if (!clientId) {
        throw new Error('Blockpass Client ID not configured');
      }

      // Blockpass uses a simpler flow with client ID
      const state = uuidv4();

      // Store state for callback validation
      await query(
        `UPDATE kyc_verifications SET provider_metadata = ? WHERE id = ?`,
        [JSON.stringify({ blockpassState: state }), verificationId]
      );

      const redirectUrl = new URL('https://kyc.blockpass.org/kyc');
      redirectUrl.searchParams.set('clientId', clientId);
      redirectUrl.searchParams.set('refId', userId);
      redirectUrl.searchParams.set('state', state);
      redirectUrl.searchParams.set('redirectUrl', `${process.env.BACKEND_URL}/api/kyc/callback/blockpass`);

      return {
        redirectUrl: redirectUrl.toString(),
        providerId: userId
      };
    } catch (error: any) {
      console.error('Blockpass initialization failed:', error);
      throw new Error(`Blockpass initialization failed: ${error.message}`);
    }
  }

  /**
   * Persona Provider Implementation
   */
  private async initiatePersonaVerification(
    userId: string,
    verificationId: string
  ): Promise<{ redirectUrl: string; providerId: string }> {
    try {
      const clientId = process.env.PERSONA_CLIENT_ID;
      const apiKey = process.env.PERSONA_API_KEY;

      if (!clientId || !apiKey) {
        throw new Error('Persona credentials not configured');
      }

      // Create inquiry via Persona API
      const response = await axios.post(
        'https://api.withpersona.com/api/v1/inquiries',
        {
          data: {
            type: 'inquiry',
            attributes: {
              'reference-id': userId
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/vnd.api+json'
          }
        }
      );

      const inquiryId = response.data.data.id;

      return {
        redirectUrl: `https://withpersona.com/verify?inquiry-id=${inquiryId}&client-id=${clientId}`,
        providerId: inquiryId
      };
    } catch (error: any) {
      console.error('Persona initialization failed:', error);
      throw new Error(`Persona initialization failed: ${error.message}`);
    }
  }

  /**
   * Mock KYC Provider (for testing)
   */
  private async initiateMockVerification(
    userId: string,
    verificationId: string
  ): Promise<{ redirectUrl: string; providerId: string }> {
    return {
      redirectUrl: `${process.env.FRONTEND_URL}/kyc/mock/${verificationId}`,
      providerId: verificationId
    };
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(
    verificationId: string,
    userId: string
  ): Promise<KYCVerification | null> {
    const result = await query(
      `SELECT * FROM kyc_verifications WHERE id = ? AND user_id = ?`,
      [verificationId, userId]
    );

    if (result.length === 0) return null;

    const verification = result[0];
    return {
      id: verification.id,
      userId: verification.user_id,
      provider: verification.provider,
      providerId: verification.provider_id,
      status: verification.status,
      kycData: verification.kyc_data ? JSON.parse(verification.kyc_data) : undefined,
      rejectionReason: verification.rejection_reason,
      verificationDate: verification.verification_date,
      expiryDate: verification.expiry_date,
      createdAt: verification.created_at,
      updatedAt: verification.updated_at
    };
  }

  /**
   * Submit manual KYC data
   */
  async submitManualKYC(userId: string, kycData: any): Promise<{
    verificationId: string;
    status: string;
  }> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const verificationId = uuidv4();

      await query(
        `INSERT INTO kyc_verifications 
         (id, user_id, provider, status, kyc_data, created_at, updated_at)
         VALUES (?, ?, 'manual', 'pending', ?, NOW(), NOW())`,
        [verificationId, userId, JSON.stringify(kycData)]
      );

      // Create admin notification
      const adminUsers = await query(
        `SELECT id FROM users WHERE role IN ('admin', 'super-admin')`
      );

      for (const admin of adminUsers) {
        const notificationId = uuidv4();
        await query(
          `INSERT INTO notifications 
           (id, user_id, type, title, message, data, created_at)
           VALUES (?, ?, 'kyc_submission', 'New KYC Submission', ?, ?, NOW())`,
          [
            notificationId,
            admin.id,
            `User ${userId} submitted manual KYC verification`,
            JSON.stringify({ verificationId, userId })
          ]
        );
      }

      await connection.commit();

      return {
        verificationId,
        status: 'pending'
      };
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
  async handleSumsubWebhook(payload: any): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const { applicantId, status, reviewStatus } = payload;

      // Find verification by provider ID
      const verifications = await query(
        `SELECT * FROM kyc_verifications WHERE provider_id = ? AND provider = 'sumsub'`,
        [applicantId]
      );

      if (verifications.length === 0) {
        console.warn(`No verification found for Sumsub applicant ${applicantId}`);
        return;
      }

      const verification = verifications[0];
      const newStatus = reviewStatus === 'approved' ? 'approved' : reviewStatus === 'rejected' ? 'rejected' : 'pending';

      // Update verification status
      await query(
        `UPDATE kyc_verifications SET status = ?, verification_date = NOW(), updated_at = NOW() WHERE id = ?`,
        [newStatus, verification.id]
      );

      // If approved, mark wallet as KYC verified
      if (newStatus === 'approved') {
        const wallet = await this.walletModel.getWalletByUserId(verification.user_id);
        if (wallet) {
          await this.walletModel.markKYCVerified(verification.user_id, wallet.id);
        }
      }

      // Create notification for user
      const notificationId = uuidv4();
      await query(
        `INSERT INTO notifications 
         (id, user_id, type, title, message, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          notificationId,
          verification.user_id,
          newStatus === 'approved' ? 'kyc_approved' : 'kyc_rejected',
          newStatus === 'approved' ? 'KYC Approved' : 'KYC Rejected',
          newStatus === 'approved'
            ? 'Your KYC verification has been approved!'
            : 'Your KYC verification was rejected. Please resubmit.',
          JSON.stringify({ verificationId: verification.id, status: newStatus })
        ]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Sumsub webhook handling failed:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Handle Blockpass webhook
   */
  async handleBlockpassWebhook(payload: any): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const { referenceId, status } = payload;

      // Find verification
      const verifications = await query(
        `SELECT * FROM kyc_verifications WHERE provider_id = ? AND provider = 'blockpass'`,
        [referenceId]
      );

      if (verifications.length === 0) {
        console.warn(`No verification found for Blockpass reference ${referenceId}`);
        return;
      }

      const verification = verifications[0];
      const newStatus = status === 'approved' ? 'approved' : 'rejected';

      await query(
        `UPDATE kyc_verifications SET status = ?, verification_date = NOW(), updated_at = NOW() WHERE id = ?`,
        [newStatus, verification.id]
      );

      if (newStatus === 'approved') {
        const wallet = await this.walletModel.getWalletByUserId(verification.user_id);
        if (wallet) {
          await this.walletModel.markKYCVerified(verification.user_id, wallet.id);
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Blockpass webhook handling failed:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Handle Persona webhook
   */
  async handlePersonaWebhook(payload: any): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const { data } = payload;
      const { id: inquiryId, attributes } = data;
      const status = attributes['status'];

      const verifications = await query(
        `SELECT * FROM kyc_verifications WHERE provider_id = ? AND provider = 'persona'`,
        [inquiryId]
      );

      if (verifications.length === 0) {
        console.warn(`No verification found for Persona inquiry ${inquiryId}`);
        return;
      }

      const verification = verifications[0];
      const newStatus = status === 'completed' ? 'approved' : 'pending';

      await query(
        `UPDATE kyc_verifications SET status = ?, verification_date = NOW(), updated_at = NOW() WHERE id = ?`,
        [newStatus, verification.id]
      );

      if (newStatus === 'approved') {
        const wallet = await this.walletModel.getWalletByUserId(verification.user_id);
        if (wallet) {
          await this.walletModel.markKYCVerified(verification.user_id, wallet.id);
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Persona webhook handling failed:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get pending verifications (admin)
   */
  async getPendingVerifications(limit: number = 50, offset: number = 0): Promise<any[]> {
    return query(
      `SELECT kv.*, u.email, u.username, u.wallet_address
       FROM kyc_verifications kv
       LEFT JOIN users u ON kv.user_id = u.id
       WHERE kv.status = 'pending'
       ORDER BY kv.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  /**
   * Approve verification (admin)
   */
  async approveVerification(verificationId: string): Promise<{ walletVerified: boolean }> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const verifications = await query(
        `SELECT * FROM kyc_verifications WHERE id = ?`,
        [verificationId]
      );

      if (verifications.length === 0) {
        throw new Error('Verification not found');
      }

      const verification = verifications[0];

      await query(
        `UPDATE kyc_verifications SET status = 'approved', verification_date = NOW(), updated_at = NOW() WHERE id = ?`,
        [verificationId]
      );

      // Mark wallet as KYC verified
      let walletVerified = false;
      const wallet = await this.walletModel.getWalletByUserId(verification.user_id);
      if (wallet) {
        await this.walletModel.markKYCVerified(verification.user_id, wallet.id);
        walletVerified = true;
      }

      // Create notification
      const notificationId = uuidv4();
      await query(
        `INSERT INTO notifications 
         (id, user_id, type, title, message, created_at)
         VALUES (?, ?, 'kyc_approved', 'KYC Approved', 'Your KYC verification has been approved!', NOW())`,
        [notificationId, verification.user_id]
      );

      await connection.commit();

      return { walletVerified };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Reject verification (admin)
   */
  async rejectVerification(verificationId: string, reason: string): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const verifications = await query(
        `SELECT * FROM kyc_verifications WHERE id = ?`,
        [verificationId]
      );

      if (verifications.length === 0) {
        throw new Error('Verification not found');
      }

      const verification = verifications[0];

      await query(
        `UPDATE kyc_verifications SET status = 'rejected', rejection_reason = ?, updated_at = NOW() WHERE id = ?`,
        [reason, verificationId]
      );

      // Create notification
      const notificationId = uuidv4();
      await query(
        `INSERT INTO notifications 
         (id, user_id, type, title, message, created_at)
         VALUES (?, ?, 'kyc_rejected', 'KYC Rejected', ?, NOW())`,
        [
          notificationId,
          verification.user_id,
          `Your KYC verification was rejected: ${reason}. Please resubmit.`
        ]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
