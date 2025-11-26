import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export interface AccountLink extends RowDataPacket {
  id: string;
  user_id: string;
  smart_account_address: string;
  wallet_address: string;
  linked_at: Date;
  is_primary: boolean;
  status: 'active' | 'inactive' | 'pending';
  verification_code?: string;
  verified_at?: Date;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface AccountLinkingHistory extends RowDataPacket {
  id: string;
  account_link_id: string;
  action: string;
  performed_by: string;
  ip_address?: string;
  user_agent?: string;
  status: string;
  created_at: Date;
}

export class AccountLinkingModel {
  constructor(private pool: Pool) {}

  async linkWalletToAccount(
    userId: string,
    smartAccountAddress: string,
    walletAddress: string,
    isPrimary: boolean = false
  ): Promise<AccountLink> {
    const linkId = uuidv4();
    const verificationCode = this.generateVerificationCode();

    await this.pool.execute(
      `INSERT INTO account_links 
       (id, user_id, smart_account_address, wallet_address, is_primary, 
        status, verification_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())`,
      [linkId, userId, smartAccountAddress, walletAddress, isPrimary ? 1 : 0, verificationCode]
    );

    const link = await this.getLinkById(linkId);
    if (!link) throw new Error('Failed to create account link');
    return link;
  }

  async getLinkById(linkId: string): Promise<AccountLink | null> {
    const [rows] = await this.pool.query<AccountLink[]>(
      'SELECT * FROM account_links WHERE id = ?',
      [linkId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async getLinksByUserId(userId: string): Promise<AccountLink[]> {
    const [rows] = await this.pool.query<AccountLink[]>(
      'SELECT * FROM account_links WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC',
      [userId]
    );
    return rows;
  }

  async getPrimaryLink(userId: string): Promise<AccountLink | null> {
    const [rows] = await this.pool.query<AccountLink[]>(
      'SELECT * FROM account_links WHERE user_id = ? AND is_primary = 1 AND status = "active"',
      [userId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async getLinkBySmartAccount(smartAccountAddress: string): Promise<AccountLink | null> {
    const [rows] = await this.pool.query<AccountLink[]>(
      'SELECT * FROM account_links WHERE smart_account_address = ? AND status = "active" LIMIT 1',
      [smartAccountAddress]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async getLinkByWalletAddress(walletAddress: string): Promise<AccountLink | null> {
    const [rows] = await this.pool.query<AccountLink[]>(
      'SELECT * FROM account_links WHERE wallet_address = ? AND status = "active" LIMIT 1',
      [walletAddress]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async verifyLink(linkId: string, verificationCode: string): Promise<boolean> {
    const link = await this.getLinkById(linkId);
    if (!link || link.verification_code !== verificationCode) {
      return false;
    }

    await this.pool.execute(
      'UPDATE account_links SET status = ?, verified_at = NOW(), updated_at = NOW() WHERE id = ?',
      ['active', linkId]
    );

    return true;
  }

  async setPrimaryLink(userId: string, linkId: string): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      // Remove primary from all other links
      await connection.execute(
        'UPDATE account_links SET is_primary = 0 WHERE user_id = ? AND id != ?',
        [userId, linkId]
      );

      // Set this link as primary
      await connection.execute(
        'UPDATE account_links SET is_primary = 1, updated_at = NOW() WHERE id = ? AND user_id = ?',
        [linkId, userId]
      );
    } finally {
      connection.release();
    }
  }

  async updateLinkStatus(linkId: string, status: 'active' | 'inactive' | 'pending'): Promise<void> {
    await this.pool.execute(
      'UPDATE account_links SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, linkId]
    );
  }

  async deactivateLink(linkId: string): Promise<void> {
    await this.updateLinkStatus(linkId, 'inactive');
  }

  async recordLinkingHistory(
    linkId: string,
    action: string,
    performedBy: string,
    ipAddress?: string,
    userAgent?: string,
    status: string = 'success'
  ): Promise<void> {
    const historyId = uuidv4();
    await this.pool.execute(
      `INSERT INTO account_linking_history 
       (id, account_link_id, action, performed_by, ip_address, user_agent, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [historyId, linkId, action, performedBy, ipAddress, userAgent, status]
    );
  }

  async getLinkingHistory(linkId: string, limit: number = 50): Promise<AccountLinkingHistory[]> {
    const [rows] = await this.pool.query<AccountLinkingHistory[]>(
      `SELECT * FROM account_linking_history 
       WHERE account_link_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [linkId, limit]
    );
    return rows;
  }

  private generateVerificationCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
