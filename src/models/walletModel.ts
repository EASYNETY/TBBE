import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export interface UserWallet extends RowDataPacket {
  id: string;
  user_id: string;
  wallet_address: string;
  balance_usdc: number;
  nonce: number;
  kyc_status: 'pending' | 'verified' | 'rejected';
  kyc_verified_at: Date | null;
  kyc_data: any;
  created_at: Date;
  updated_at: Date;
}

export interface WalletTransaction extends RowDataPacket {
  id: string;
  user_id: string;
  wallet_id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  from_address: string;
  to_address: string;
  tx_hash: string | null;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface WalletDeposit extends RowDataPacket {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  source_address: string;
  deposit_address: string;
  status: 'pending' | 'confirmed' | 'failed';
  tx_hash: string | null;
  confirmations: number;
  created_at: Date;
  updated_at: Date;
}

export interface KYCVerification extends RowDataPacket {
  id: string;
  user_id: string;
  wallet_id: string | null;
  provider: string;
  provider_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  kyc_data: any;
  verification_date: Date | null;
  expiry_date: Date | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WithdrawalRequest extends RowDataPacket {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  destination_address: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  requires_kyc: boolean;
  kyc_verified: boolean;
  tx_hash: string | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export class WalletModel {
  constructor(private pool: Pool) {}

  // ========== User Wallet Operations ==========

  async createWallet(userId: string, walletAddress: string): Promise<UserWallet> {
    const walletId = uuidv4();
    const connection = await this.pool.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO user_wallets (id, user_id, wallet_address, balance_usdc, kyc_status)
         VALUES (?, ?, ?, 0, 'pending')`,
        [walletId, userId, walletAddress]
      );

      const wallet = await this.getWalletById(walletId);
      if (!wallet) throw new Error('Failed to create wallet');
      return wallet;
    } finally {
      connection.release();
    }
  }

  async getWalletById(walletId: string): Promise<UserWallet | null> {
    const [rows] = await this.pool.query<UserWallet[]>(
      'SELECT * FROM user_wallets WHERE id = ?',
      [walletId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async getWalletByUserId(userId: string): Promise<UserWallet | null> {
    const [rows] = await this.pool.query<UserWallet[]>(
      'SELECT * FROM user_wallets WHERE user_id = ?',
      [userId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async getWalletByAddress(address: string): Promise<UserWallet | null> {
    const [rows] = await this.pool.query<UserWallet[]>(
      'SELECT * FROM user_wallets WHERE wallet_address = ?',
      [address]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async updateWalletBalance(walletId: string, newBalance: number): Promise<void> {
    await this.pool.execute(
      'UPDATE user_wallets SET balance_usdc = ? WHERE id = ?',
      [newBalance, walletId]
    );
  }

  async incrementWalletBalance(walletId: string, amount: number): Promise<number> {
    const connection = await this.pool.getConnection();
    try {
      const wallet = await this.getWalletById(walletId);
      if (!wallet) throw new Error('Wallet not found');

      const newBalance = wallet.balance_usdc + amount;
      await connection.execute(
        'UPDATE user_wallets SET balance_usdc = ? WHERE id = ?',
        [newBalance, walletId]
      );
      return newBalance;
    } finally {
      connection.release();
    }
  }

  async decrementWalletBalance(walletId: string, amount: number): Promise<number> {
    const connection = await this.pool.getConnection();
    try {
      const wallet = await this.getWalletById(walletId);
      if (!wallet) throw new Error('Wallet not found');

      if (wallet.balance_usdc < amount) {
        throw new Error('Insufficient balance');
      }

      const newBalance = wallet.balance_usdc - amount;
      await connection.execute(
        'UPDATE user_wallets SET balance_usdc = ? WHERE id = ?',
        [newBalance, walletId]
      );
      return newBalance;
    } finally {
      connection.release();
    }
  }

  async incrementNonce(walletId: string): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'UPDATE user_wallets SET nonce = nonce + 1 WHERE id = ? RETURNING nonce',
      [walletId]
    );
    const wallet = await this.getWalletById(walletId);
    return wallet?.nonce || 0;
  }

  // ========== Transaction Operations ==========

  async createTransaction(
    userId: string,
    walletId: string,
    type: string,
    amount: number,
    fromAddress: string,
    toAddress: string,
    description?: string,
    metadata?: any
  ): Promise<WalletTransaction> {
    const transactionId = uuidv4();
    const wallet = await this.getWalletById(walletId);
    if (!wallet) throw new Error('Wallet not found');

    await this.pool.execute(
      `INSERT INTO wallet_transactions 
       (id, user_id, wallet_id, transaction_type, amount, balance_before, from_address, to_address, status, description, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        transactionId,
        userId,
        walletId,
        type,
        amount,
        wallet.balance_usdc,
        fromAddress,
        toAddress,
        description,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    const transaction = await this.getTransactionById(transactionId);
    if (!transaction) throw new Error('Failed to create transaction');
    return transaction;
  }

  async getTransactionById(txId: string): Promise<WalletTransaction | null> {
    const [rows] = await this.pool.query<WalletTransaction[]>(
      'SELECT * FROM wallet_transactions WHERE id = ?',
      [txId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async getTransactionsByWalletId(
    walletId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<WalletTransaction[]> {
    const [rows] = await this.pool.query<WalletTransaction[]>(
      `SELECT * FROM wallet_transactions 
       WHERE wallet_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [walletId, limit, offset]
    );
    return rows;
  }

  async getTransactionsByUserId(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<WalletTransaction[]> {
    const [rows] = await this.pool.query<WalletTransaction[]>(
      `SELECT * FROM wallet_transactions 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    return rows;
  }

  async updateTransactionStatus(txId: string, status: string, txHash?: string): Promise<void> {
    if (txHash) {
      await this.pool.execute(
        'UPDATE wallet_transactions SET status = ?, tx_hash = ? WHERE id = ?',
        [status, txHash, txId]
      );
    } else {
      await this.pool.execute(
        'UPDATE wallet_transactions SET status = ? WHERE id = ?',
        [status, txId]
      );
    }
  }

  async updateTransactionBalances(txId: string, balanceBefore: number, balanceAfter: number): Promise<void> {
    await this.pool.execute(
      'UPDATE wallet_transactions SET balance_before = ?, balance_after = ? WHERE id = ?',
      [balanceBefore, balanceAfter, txId]
    );
  }

  // ========== Deposit Operations ==========

  async createDeposit(
    userId: string,
    walletId: string,
    amount: number,
    sourceAddress: string,
    depositAddress: string
  ): Promise<WalletDeposit> {
    const depositId = uuidv4();
    await this.pool.execute(
      `INSERT INTO wallet_deposits 
       (id, user_id, wallet_id, amount, source_address, deposit_address, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [depositId, userId, walletId, amount, sourceAddress, depositAddress]
    );

    const deposit = await this.getDepositById(depositId);
    if (!deposit) throw new Error('Failed to create deposit');
    return deposit;
  }

  async getDepositById(depositId: string): Promise<WalletDeposit | null> {
    const [rows] = await this.pool.query<WalletDeposit[]>(
      'SELECT * FROM wallet_deposits WHERE id = ?',
      [depositId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async getDepositsByWalletId(walletId: string): Promise<WalletDeposit[]> {
    const [rows] = await this.pool.query<WalletDeposit[]>(
      'SELECT * FROM wallet_deposits WHERE wallet_id = ? ORDER BY created_at DESC',
      [walletId]
    );
    return rows;
  }

  async updateDepositStatus(
    depositId: string,
    status: string,
    txHash?: string,
    confirmations?: number
  ): Promise<void> {
    if (txHash && confirmations !== undefined) {
      await this.pool.execute(
        'UPDATE wallet_deposits SET status = ?, tx_hash = ?, confirmations = ? WHERE id = ?',
        [status, txHash, confirmations, depositId]
      );
    } else if (txHash) {
      await this.pool.execute(
        'UPDATE wallet_deposits SET status = ?, tx_hash = ? WHERE id = ?',
        [status, txHash, depositId]
      );
    } else {
      await this.pool.execute(
        'UPDATE wallet_deposits SET status = ? WHERE id = ?',
        [status, depositId]
      );
    }
  }

  // ========== KYC Operations ==========

  async createKYCVerification(userId: string, provider: string, providerId: string): Promise<KYCVerification> {
    const verificationId = uuidv4();
    const wallet = await this.getWalletByUserId(userId);

    await this.pool.execute(
      `INSERT INTO kyc_verifications 
       (id, user_id, wallet_id, provider, provider_id, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [verificationId, userId, wallet?.id || null, provider, providerId]
    );

    const verification = await this.getKYCVerification(verificationId);
    if (!verification) throw new Error('Failed to create KYC verification');
    return verification;
  }

  async getKYCVerification(verificationId: string): Promise<KYCVerification | null> {
    const [rows] = await this.pool.query<KYCVerification[]>(
      'SELECT * FROM kyc_verifications WHERE id = ?',
      [verificationId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async getKYCByUserId(userId: string): Promise<KYCVerification | null> {
    const [rows] = await this.pool.query<KYCVerification[]>(
      'SELECT * FROM kyc_verifications WHERE user_id = ?',
      [userId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async updateKYCStatus(
    verificationId: string,
    status: string,
    kycData?: any,
    rejectionReason?: string
  ): Promise<void> {
    const query = `UPDATE kyc_verifications SET status = ?, 
                   kyc_data = ${kycData ? '?' : 'kyc_data'}, 
                   verification_date = ${status === 'approved' ? 'NOW()' : 'verification_date'},
                   rejection_reason = ${rejectionReason ? '?' : 'rejection_reason'}
                   WHERE id = ?`;
    
    const params: any[] = [status];
    if (kycData) params.push(JSON.stringify(kycData));
    if (rejectionReason) params.push(rejectionReason);
    params.push(verificationId);

    await this.pool.execute(query, params);
  }

  async markKYCVerified(userId: string, walletId: string): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      // Update wallet KYC status
      await connection.execute(
        'UPDATE user_wallets SET kyc_status = ?, kyc_verified_at = NOW() WHERE id = ?',
        ['verified', walletId]
      );

      // Update user KYC status
      await connection.execute(
        'UPDATE users SET kyc_status = ?, kyc_verified_at = NOW() WHERE id = ?',
        ['verified', userId]
      );

      // Update KYC verification record
      const kyc = await this.getKYCByUserId(userId);
      if (kyc) {
        await connection.execute(
          'UPDATE kyc_verifications SET status = ?, verification_date = NOW() WHERE id = ?',
          ['approved', kyc.id]
        );
      }
    } finally {
      connection.release();
    }
  }

  // ========== Withdrawal Operations ==========

  async createWithdrawalRequest(
    userId: string,
    walletId: string,
    amount: number,
    destinationAddress: string
  ): Promise<WithdrawalRequest> {
    const requestId = uuidv4();
    await this.pool.execute(
      `INSERT INTO withdrawal_requests 
       (id, user_id, wallet_id, amount, destination_address, status, requires_kyc)
       VALUES (?, ?, ?, ?, ?, 'pending', TRUE)`,
      [requestId, userId, walletId, amount, destinationAddress]
    );

    const request = await this.getWithdrawalRequest(requestId);
    if (!request) throw new Error('Failed to create withdrawal request');
    return request;
  }

  async getWithdrawalRequest(requestId: string): Promise<WithdrawalRequest | null> {
    const [rows] = await this.pool.query<WithdrawalRequest[]>(
      'SELECT * FROM withdrawal_requests WHERE id = ?',
      [requestId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async getWithdrawalsByUserId(userId: string): Promise<WithdrawalRequest[]> {
    const [rows] = await this.pool.query<WithdrawalRequest[]>(
      'SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }

  async updateWithdrawalStatus(
    requestId: string,
    status: string,
    txHash?: string,
    rejectionReason?: string
  ): Promise<void> {
    const query = `UPDATE withdrawal_requests 
                   SET status = ?, 
                       tx_hash = ${txHash ? '?' : 'tx_hash'},
                       rejection_reason = ${rejectionReason ? '?' : 'rejection_reason'},
                       completed_at = ${status === 'completed' ? 'NOW()' : 'completed_at'}
                   WHERE id = ?`;
    
    const params: any[] = [status];
    if (txHash) params.push(txHash);
    if (rejectionReason) params.push(rejectionReason);
    params.push(requestId);

    await this.pool.execute(query, params);
  }

  async markWithdrawalKYCVerified(requestId: string): Promise<void> {
    await this.pool.execute(
      'UPDATE withdrawal_requests SET kyc_verified = TRUE WHERE id = ?',
      [requestId]
    );
  }

  // ========== External Wallet Linking ==========

  async linkExternalWallet(userId: string, walletAddress: string): Promise<void> {
    const linkId = uuidv4();
    try {
      await this.pool.execute(
        `INSERT INTO external_wallets (id, user_id, wallet_address, created_at)
         VALUES (?, ?, ?, NOW())`,
        [linkId, userId, walletAddress]
      );
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        // Wallet already linked, just return
        return;
      }
      throw error;
    }
  }

  async getLinkedWallets(userId: string): Promise<any[]> {
    const [rows] = await this.pool.query(
      'SELECT id, wallet_address, is_primary, created_at FROM external_wallets WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC',
      [userId]
    );
    return rows as any[];
  }

  async unlinkExternalWallet(userId: string, walletAddress: string): Promise<void> {
    await this.pool.execute(
      'DELETE FROM external_wallets WHERE user_id = ? AND wallet_address = ?',
      [userId, walletAddress]
    );
  }

  async getPrimaryExternalWallet(userId: string): Promise<any | null> {
    const [rows] = await this.pool.query(
      'SELECT id, wallet_address FROM external_wallets WHERE user_id = ? AND is_primary = TRUE LIMIT 1',
      [userId]
    );
    return (rows as any[]).length > 0 ? (rows as any[])[0] : null;
  }
}
