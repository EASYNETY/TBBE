import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export interface WalletTransactionRecord extends RowDataPacket {
  id: string;
  user_id: string;
  wallet_id: string;
  transaction_type: 'deposit' | 'withdrawal' | 'transfer' | 'roi_disbursement' | 'subscription_payment' | 'refund';
  amount: number;
  balance_before: number;
  balance_after: number;
  from_address: string;
  to_address: string;
  tx_hash?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description?: string;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface TransactionMetadata {
  subscriptionId?: string;
  propertyId?: string;
  relatedTransactionId?: string;
  roiPercentage?: number;
  disbursementDate?: string;
  reason?: string;
  [key: string]: any;
}

export class WalletTransactionModel {
  constructor(private pool: Pool) {}

  async createTransaction(
    userId: string,
    walletId: string,
    type: WalletTransactionRecord['transaction_type'],
    amount: number,
    fromAddress: string,
    toAddress: string,
    status: WalletTransactionRecord['status'] = 'pending',
    description?: string,
    metadata?: TransactionMetadata
  ): Promise<WalletTransactionRecord> {
    const transactionId = uuidv4();

    const [wallet] = await this.pool.query<any[]>(
      'SELECT balance_usdc FROM user_wallets WHERE id = ?',
      [walletId]
    );

    const balanceBefore = wallet?.[0]?.balance_usdc || 0;

    await this.pool.execute(
      `INSERT INTO wallet_transactions 
       (id, user_id, wallet_id, transaction_type, amount, balance_before, 
        from_address, to_address, status, description, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        transactionId,
        userId,
        walletId,
        type,
        amount,
        balanceBefore,
        fromAddress,
        toAddress,
        status,
        description,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    const transaction = await this.getTransactionById(transactionId);
    if (!transaction) throw new Error('Failed to create transaction');
    return transaction;
  }

  async getTransactionById(transactionId: string): Promise<WalletTransactionRecord | null> {
    const [rows] = await this.pool.query<WalletTransactionRecord[]>(
      'SELECT * FROM wallet_transactions WHERE id = ?',
      [transactionId]
    );
    return rows.length > 0 ? this.formatTransaction(rows[0]) : null;
  }

  async getTransactionsByUserId(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    types?: string[]
  ): Promise<WalletTransactionRecord[]> {
    let query = 'SELECT * FROM wallet_transactions WHERE user_id = ?';
    const params: any[] = [userId];

    if (types && types.length > 0) {
      query += ` AND transaction_type IN (${types.map(() => '?').join(',')})`;
      params.push(...types);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await this.pool.query<WalletTransactionRecord[]>(query, params);
    return rows.map(row => this.formatTransaction(row));
  }

  async getTransactionsByWalletId(
    walletId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<WalletTransactionRecord[]> {
    const [rows] = await this.pool.query<WalletTransactionRecord[]>(
      `SELECT * FROM wallet_transactions 
       WHERE wallet_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [walletId, limit, offset]
    );
    return rows.map(row => this.formatTransaction(row));
  }

  async getTransactionsByType(
    userId: string,
    type: WalletTransactionRecord['transaction_type'],
    limit: number = 50
  ): Promise<WalletTransactionRecord[]> {
    const [rows] = await this.pool.query<WalletTransactionRecord[]>(
      `SELECT * FROM wallet_transactions 
       WHERE user_id = ? AND transaction_type = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, type, limit]
    );
    return rows.map(row => this.formatTransaction(row));
  }

  async getTransactionsByStatus(
    status: WalletTransactionRecord['status'],
    limit: number = 50
  ): Promise<WalletTransactionRecord[]> {
    const [rows] = await this.pool.query<WalletTransactionRecord[]>(
      `SELECT * FROM wallet_transactions 
       WHERE status = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [status, limit]
    );
    return rows.map(row => this.formatTransaction(row));
  }

  async updateTransactionStatus(
    transactionId: string,
    status: WalletTransactionRecord['status'],
    txHash?: string
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE wallet_transactions 
       SET status = ?, tx_hash = ${txHash ? '?' : 'tx_hash'}, updated_at = NOW() 
       WHERE id = ?`,
      txHash ? [status, txHash, transactionId] : [status, transactionId]
    );
  }

  async updateTransactionBalances(
    transactionId: string,
    balanceBefore: number,
    balanceAfter: number
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE wallet_transactions 
       SET balance_before = ?, balance_after = ?, updated_at = NOW() 
       WHERE id = ?`,
      [balanceBefore, balanceAfter, transactionId]
    );
  }

  async updateTransactionMetadata(
    transactionId: string,
    metadata: TransactionMetadata
  ): Promise<void> {
    await this.pool.execute(
      'UPDATE wallet_transactions SET metadata = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(metadata), transactionId]
    );
  }

  async getTransactionStats(userId: string): Promise<{
    totalTransactions: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalSpent: number;
    averageTransaction: number;
  }> {
    const [stats] = await this.pool.query<any[]>(
      `SELECT 
        COUNT(*) as totalTransactions,
        COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END), 0) as totalDeposited,
        COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END), 0) as totalWithdrawn,
        COALESCE(SUM(CASE WHEN transaction_type IN ('subscription_payment', 'transfer') THEN amount ELSE 0 END), 0) as totalSpent,
        COALESCE(AVG(amount), 0) as averageTransaction
       FROM wallet_transactions 
       WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );

    return {
      totalTransactions: stats[0]?.totalTransactions || 0,
      totalDeposited: parseFloat(stats[0]?.totalDeposited || 0),
      totalWithdrawn: parseFloat(stats[0]?.totalWithdrawn || 0),
      totalSpent: parseFloat(stats[0]?.totalSpent || 0),
      averageTransaction: parseFloat(stats[0]?.averageTransaction || 0)
    };
  }

  async getPendingTransactions(userId: string): Promise<WalletTransactionRecord[]> {
    const [rows] = await this.pool.query<WalletTransactionRecord[]>(
      `SELECT * FROM wallet_transactions 
       WHERE user_id = ? AND status = 'pending' 
       ORDER BY created_at ASC`,
      [userId]
    );
    return rows.map(row => this.formatTransaction(row));
  }

  async getFailedTransactions(userId: string): Promise<WalletTransactionRecord[]> {
    const [rows] = await this.pool.query<WalletTransactionRecord[]>(
      `SELECT * FROM wallet_transactions 
       WHERE user_id = ? AND status = 'failed' 
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map(row => this.formatTransaction(row));
  }

  async searchTransactions(userId: string, query: string, limit: number = 50): Promise<WalletTransactionRecord[]> {
    const [rows] = await this.pool.query<WalletTransactionRecord[]>(
      `SELECT * FROM wallet_transactions 
       WHERE user_id = ? AND (
         description LIKE ? OR 
         tx_hash LIKE ? OR 
         from_address LIKE ? OR 
         to_address LIKE ?
       )
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit]
    );
    return rows.map(row => this.formatTransaction(row));
  }

  private formatTransaction(row: WalletTransactionRecord): WalletTransactionRecord {
    if (row.metadata && typeof row.metadata === 'string') {
      return {
        ...row,
        metadata: JSON.parse(row.metadata)
      };
    }
    return row;
  }
}
