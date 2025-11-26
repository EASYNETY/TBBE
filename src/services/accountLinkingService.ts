import { Pool } from 'mysql2/promise';
import { AccountLinkingModel, AccountLink } from '../models/accountLinkingModel';

export interface LinkAccountRequest {
  userId: string;
  smartAccountAddress: string;
  walletAddress: string;
  isPrimary?: boolean;
}

export interface LinkAccountResponse {
  linkId: string;
  verificationCode: string;
  status: string;
  expiresIn: number; // seconds
}

export interface LinkedAccount {
  id: string;
  smartAccountAddress: string;
  walletAddress: string;
  isPrimary: boolean;
  status: string;
  verifiedAt: Date | null;
  linkedAt: Date;
}

export class AccountLinkingService {
  private model: AccountLinkingModel;
  private readonly VERIFICATION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

  constructor(private pool: Pool) {
    this.model = new AccountLinkingModel(pool);
  }

  async initiateAccountLink(request: LinkAccountRequest): Promise<LinkAccountResponse> {
    // Validate inputs
    if (!this.isValidSmartAccountAddress(request.smartAccountAddress)) {
      throw new Error('Invalid smart account address format');
    }

    if (!this.isValidWalletAddress(request.walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    // Check if wallet is already linked to another account
    const existingLink = await this.model.getLinkByWalletAddress(request.walletAddress);
    if (existingLink && existingLink.user_id !== request.userId) {
      throw new Error('Wallet is already linked to another account');
    }

    // Check if smart account is already linked to another user
    const existingSmartAccountLink = await this.model.getLinkBySmartAccount(request.smartAccountAddress);
    if (existingSmartAccountLink && existingSmartAccountLink.user_id !== request.userId) {
      throw new Error('Smart account is already linked to another user');
    }

    // If user has no primary link, this should be primary
    const isPrimary = request.isPrimary !== false;
    const existingLinks = await this.model.getLinksByUserId(request.userId);

    const link = await this.model.linkWalletToAccount(
      request.userId,
      request.smartAccountAddress,
      request.walletAddress,
      isPrimary || existingLinks.length === 0
    );

    return {
      linkId: link.id,
      verificationCode: link.verification_code || '',
      status: 'pending_verification',
      expiresIn: Math.floor(this.VERIFICATION_TIMEOUT / 1000)
    };
  }

  async verifyAndActivateLink(linkId: string, verificationCode: string): Promise<LinkedAccount> {
    const link = await this.model.getLinkById(linkId);
    if (!link) {
      throw new Error('Account link not found');
    }

    if (link.status === 'active') {
      throw new Error('Link is already active');
    }

    const isVerified = await this.model.verifyLink(linkId, verificationCode);
    if (!isVerified) {
      throw new Error('Invalid verification code');
    }

    // Record history
    await this.model.recordLinkingHistory(
      linkId,
      'account_verified',
      link.user_id,
      undefined,
      undefined,
      'success'
    );

    const verifiedLink = await this.model.getLinkById(linkId);
    if (!verifiedLink) throw new Error('Failed to verify link');

    return this.formatLinkedAccount(verifiedLink);
  }

  async getLinkedAccounts(userId: string): Promise<LinkedAccount[]> {
    const links = await this.model.getLinksByUserId(userId);
    return links.map(link => this.formatLinkedAccount(link));
  }

  async getPrimaryAccount(userId: string): Promise<LinkedAccount | null> {
    const link = await this.model.getPrimaryLink(userId);
    if (!link) return null;
    return this.formatLinkedAccount(link);
  }

  async setPrimaryAccount(userId: string, linkId: string): Promise<LinkedAccount> {
    const link = await this.model.getLinkById(linkId);
    if (!link || link.user_id !== userId) {
      throw new Error('Unauthorized or link not found');
    }

    if (link.status !== 'active') {
      throw new Error('Can only set active links as primary');
    }

    await this.model.setPrimaryLink(userId, linkId);

    // Record history
    await this.model.recordLinkingHistory(
      linkId,
      'set_as_primary',
      userId,
      undefined,
      undefined,
      'success'
    );

    const updatedLink = await this.model.getLinkById(linkId);
    if (!updatedLink) throw new Error('Failed to update link');

    return this.formatLinkedAccount(updatedLink);
  }

  async unlinkAccount(userId: string, linkId: string): Promise<void> {
    const link = await this.model.getLinkById(linkId);
    if (!link || link.user_id !== userId) {
      throw new Error('Unauthorized or link not found');
    }

    // Cannot unlink if it's the only active link
    const activeLinks = await this.model.getLinksByUserId(userId);
    const activeCount = activeLinks.filter(l => l.status === 'active').length;
    if (activeCount <= 1) {
      throw new Error('Cannot unlink your only active account');
    }

    await this.model.deactivateLink(linkId);

    // Record history
    await this.model.recordLinkingHistory(
      linkId,
      'account_unlinked',
      userId,
      undefined,
      undefined,
      'success'
    );
  }

  async resendVerificationCode(linkId: string): Promise<{ verificationCode: string; expiresIn: number }> {
    const link = await this.model.getLinkById(linkId);
    if (!link) {
      throw new Error('Account link not found');
    }

    if (link.status === 'active') {
      throw new Error('Link is already verified');
    }

    // Generate new code - in real implementation, update the database
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    return {
      verificationCode: newCode,
      expiresIn: Math.floor(this.VERIFICATION_TIMEOUT / 1000)
    };
  }

  async validateAccountLink(smartAccountAddress: string): Promise<LinkedAccount | null> {
    const link = await this.model.getLinkBySmartAccount(smartAccountAddress);
    if (!link) return null;
    return this.formatLinkedAccount(link);
  }

  async isWalletLinked(walletAddress: string): Promise<boolean> {
    const link = await this.model.getLinkByWalletAddress(walletAddress);
    return link !== null && link.status === 'active';
  }

  async getLinkingAuditTrail(linkId: string, limit: number = 100): Promise<any[]> {
    return this.model.getLinkingHistory(linkId, limit);
  }

  private formatLinkedAccount(link: AccountLink): LinkedAccount {
    return {
      id: link.id,
      smartAccountAddress: link.smart_account_address,
      walletAddress: link.wallet_address,
      isPrimary: link.is_primary === 1 || link.is_primary === true,
      status: link.status,
      verifiedAt: link.verified_at || null,
      linkedAt: link.created_at
    };
  }

  private isValidSmartAccountAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private isValidWalletAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}
