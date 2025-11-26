import { Pool } from 'mysql2/promise';
import { WalletTransactionModel, WalletTransactionRecord, TransactionMetadata } from '../models/walletTransactionModel';
import { WalletModel } from '../models/walletModel';
import { v4 as uuidv4 } from 'uuid';

export interface TransactionDetails {
  id: string;
  type: string;
  amount: number;
  fromAddress: string;
  toAddress: string;
  status: string;
  description?: string;
  txHash?: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
}

export interface TransactionSummary {
  totalTransactions: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalSpent: number;
  averageTransaction: number;
  recentTransactions: TransactionDetails[];
}

export class WalletTransactionService {
  private transactionModel: WalletTransactionModel;
  private walletModel: WalletModel;

  constructor(private pool: Pool) {
    this.transactionModel = new WalletTransactionModel(pool);
    this.walletModel = new WalletModel(pool);
  }

  async recordDeposit(
    userId: string,
    walletId: string,
    amount: number,
    fromAddress: string,
    toAddress: string,
    txHash?: string,
    metadata?: TransactionMetadata
  ): Promise<TransactionDetails> {
    const transaction = await this.transactionModel.createTransaction(
      userId,
      walletId,
      'deposit',
      amount,
      fromAddress,
      toAddress,
      txHash ? 'completed' : 'pending',
      `USDC deposit of ${amount}`,
      metadata
    );

    if (txHash) {
      await this.transactionModel.updateTransactionStatus(transaction.id, 'completed', txHash);
    }

    return this.formatTransactionDetails(transaction);
  }

  async recordWithdrawal(
    userId: string,
    walletId: string,
    amount: number,
    fromAddress: string,
    toAddress: string,
    txHash?: string,
    metadata?: TransactionMetadata
  ): Promise<TransactionDetails> {
    const transaction = await this.transactionModel.createTransaction(
      userId,
      walletId,
      'withdrawal',
      amount,
      fromAddress,
      toAddress,
      txHash ? 'completed' : 'pending',
      `USDC withdrawal of ${amount}`,
      metadata
    );

    if (txHash) {
      await this.transactionModel.updateTransactionStatus(transaction.id, 'completed', txHash);
    }

    return this.formatTransactionDetails(transaction);
  }

  async recordTransfer(
    userId: string,
    walletId: string,
    amount: number,
    fromAddress: string,
    toAddress: string,
    metadata?: TransactionMetadata
  ): Promise<TransactionDetails> {
    const transaction = await this.transactionModel.createTransaction(
      userId,
      walletId,
      'transfer',
      amount,
      fromAddress,
      toAddress,
      'completed',
      `Internal transfer of ${amount}`,
      metadata
    );

    return this.formatTransactionDetails(transaction);
  }

  async recordSubscriptionPayment(
    userId: string,
    walletId: string,
    amount: number,
    fromAddress: string,
    toAddress: string,
    subscriptionId: string,
    metadata?: TransactionMetadata
  ): Promise<TransactionDetails> {
    const fullMetadata: TransactionMetadata = {
      subscriptionId,
      ...metadata
    };

    const transaction = await this.transactionModel.createTransaction(
      userId,
      walletId,
      'subscription_payment',
      amount,
      fromAddress,
      toAddress,
      'completed',
      `Subscription payment for ${subscriptionId}`,
      fullMetadata
    );

    return this.formatTransactionDetails(transaction);
  }

  async recordROIDisbursement(
    userId: string,
    walletId: string,
    amount: number,
    subscriptionId: string,
    roiPercentage: number,
    metadata?: TransactionMetadata
  ): Promise<TransactionDetails> {
    const wallet = await this.walletModel.getWalletById(walletId);
    if (!wallet) throw new Error('Wallet not found');

    const fullMetadata: TransactionMetadata = {
      subscriptionId,
      roiPercentage,
      disbursementDate: new Date().toISOString(),
      ...metadata
    };

    const transaction = await this.transactionModel.createTransaction(
      userId,
      walletId,
      'roi_disbursement',
      amount,
      'system',
      wallet.wallet_address,
      'completed',
      `ROI disbursement (${roiPercentage}%) for subscription`,
      fullMetadata
    );

    return this.formatTransactionDetails(transaction);
  }

  async recordRefund(
    userId: string,
    walletId: string,
    amount: number,
    fromAddress: string,
    toAddress: string,
    reason: string,
    metadata?: TransactionMetadata
  ): Promise<TransactionDetails> {
    const fullMetadata: TransactionMetadata = {
      reason,
      ...metadata
    };

    const transaction = await this.transactionModel.createTransaction(
      userId,
      walletId,
      'refund',
      amount,
      fromAddress,
      toAddress,
      'completed',
      `Refund: ${reason}`,
      fullMetadata
    );

    return this.formatTransactionDetails(transaction);
  }

  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    types?: string[]
  ): Promise<TransactionDetails[]> {
    const transactions = await this.transactionModel.getTransactionsByUserId(
      userId,
      limit,
      offset,
      types
    );

    return transactions.map(tx => this.formatTransactionDetails(tx));
  }

  async getRecentTransactions(userId: string, days: number = 30): Promise<TransactionDetails[]> {
    const transactions = await this.transactionModel.getTransactionsByUserId(userId, 1000, 0);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return transactions
      .filter(tx => new Date(tx.created_at) >= cutoffDate)
      .map(tx => this.formatTransactionDetails(tx))
      .slice(0, 50);
  }

  async getPendingTransactions(userId: string): Promise<TransactionDetails[]> {
    const transactions = await this.transactionModel.getPendingTransactions(userId);
    return transactions.map(tx => this.formatTransactionDetails(tx));
  }

  async getFailedTransactions(userId: string): Promise<TransactionDetails[]> {
    const transactions = await this.transactionModel.getFailedTransactions(userId);
    return transactions.map(tx => this.formatTransactionDetails(tx));
  }

  async searchTransactions(userId: string, query: string): Promise<TransactionDetails[]> {
    const transactions = await this.transactionModel.searchTransactions(userId, query);
    return transactions.map(tx => this.formatTransactionDetails(tx));
  }

  async getTransactionSummary(userId: string): Promise<TransactionSummary> {
    const [stats, recentTransactions] = await Promise.all([
      this.transactionModel.getTransactionStats(userId),
      this.transactionModel.getTransactionsByUserId(userId, 10, 0)
    ]);

    return {
      totalTransactions: stats.totalTransactions,
      totalDeposited: stats.totalDeposited,
      totalWithdrawn: stats.totalWithdrawn,
      totalSpent: stats.totalSpent,
      averageTransaction: stats.averageTransaction,
      recentTransactions: recentTransactions.map(tx => this.formatTransactionDetails(tx))
    };
  }

  async getTransactionsByType(
    userId: string,
    type: WalletTransactionRecord['transaction_type']
  ): Promise<TransactionDetails[]> {
    const transactions = await this.transactionModel.getTransactionsByType(userId, type);
    return transactions.map(tx => this.formatTransactionDetails(tx));
  }

  async updateTransactionStatus(
    transactionId: string,
    status: WalletTransactionRecord['status'],
    txHash?: string
  ): Promise<void> {
    await this.transactionModel.updateTransactionStatus(transactionId, status, txHash);
  }

  async recordTransactionMetadata(transactionId: string, metadata: TransactionMetadata): Promise<void> {
    await this.transactionModel.updateTransactionMetadata(transactionId, metadata);
  }

  private formatTransactionDetails(transaction: WalletTransactionRecord): TransactionDetails {
    return {
      id: transaction.id,
      type: transaction.transaction_type,
      amount: transaction.amount,
      fromAddress: transaction.from_address,
      toAddress: transaction.to_address,
      status: transaction.status,
      description: transaction.description,
      txHash: transaction.tx_hash,
      balanceBefore: transaction.balance_before,
      balanceAfter: transaction.balance_after,
      createdAt: transaction.created_at
    };
  }
}
