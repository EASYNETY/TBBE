// Property Subscription Model
// Handles subscription records, subscriber management, and distribution tracking

export interface Subscription {
  id: string;
  property_id: string;
  subscriber_user_id: string;
  subscriber_wallet_address: string;
  subscription_amount: string; // In smallest unit (wei)
  subscription_date: Date;
  status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'EXPIRED';
  share_percentage: number; // Percentage ownership from this subscription
  currency: string; // USDC, ETH, dNZD, etc.
  transaction_hash?: string;
  kyc_verified: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface SubscriptionCreationAttributes
  extends Omit<Subscription, 'id' | 'created_at' | 'updated_at'> {
  id?: string;
}

export interface DisbursementRecord {
  id: string;
  property_id: string;
  distribution_id: string;
  subscriber_id: string;
  subscriber_wallet_address: string;
  disbursement_amount: string;
  disbursement_date: Date;
  currency: string;
  type: 'YIELD' | 'RETURN' | 'REVENUE' | 'DIVIDEND';
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  transaction_hash?: string;
  executed_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface DisbursementCreationAttributes
  extends Omit<DisbursementRecord, 'id' | 'created_at' | 'updated_at'> {
  id?: string;
}

// SQL queries for subscription operations
export const subscriptionQueries = {
  createTable: `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      property_id VARCHAR(36) NOT NULL,
      subscriber_user_id VARCHAR(36) NOT NULL,
      subscriber_wallet_address VARCHAR(42) NOT NULL,
      subscription_amount VARCHAR(255) NOT NULL,
      subscription_date TIMESTAMP NOT NULL,
      status ENUM('ACTIVE', 'INACTIVE', 'CANCELLED', 'EXPIRED') DEFAULT 'ACTIVE',
      share_percentage DECIMAL(10,4) NOT NULL,
      currency VARCHAR(20) NOT NULL DEFAULT 'USDC',
      transaction_hash VARCHAR(66),
      kyc_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_property_id (property_id),
      INDEX idx_subscriber_user_id (subscriber_user_id),
      INDEX idx_subscriber_wallet_address (subscriber_wallet_address),
      INDEX idx_status (status),
      INDEX idx_subscription_date (subscription_date),
      UNIQUE KEY unique_subscription (property_id, subscriber_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  insert: `
    INSERT INTO subscriptions (
      id, property_id, subscriber_user_id, subscriber_wallet_address,
      subscription_amount, subscription_date, status, share_percentage,
      currency, transaction_hash, kyc_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  findById: `
    SELECT * FROM subscriptions WHERE id = ?
  `,

  findByPropertyId: `
    SELECT s.*, u.username, u.email
    FROM subscriptions s
    LEFT JOIN users u ON s.subscriber_user_id = u.id
    WHERE s.property_id = ?
    ORDER BY s.subscription_date DESC
  `,

  findActiveSubscriptionsByProperty: `
    SELECT s.*, u.username, u.email
    FROM subscriptions s
    LEFT JOIN users u ON s.subscriber_user_id = u.id
    WHERE s.property_id = ? AND s.status = 'ACTIVE'
    ORDER BY s.share_percentage DESC
  `,

  findBySubscriberUserId: `
    SELECT s.*, p.title as property_title, p.address as property_address
    FROM subscriptions s
    LEFT JOIN properties p ON s.property_id = p.id
    WHERE s.subscriber_user_id = ?
    ORDER BY s.subscription_date DESC
  `,

  findBySubscriberWallet: `
    SELECT s.*, p.title as property_title, p.address as property_address
    FROM subscriptions s
    LEFT JOIN properties p ON s.property_id = p.id
    WHERE s.subscriber_wallet_address = ?
    ORDER BY s.subscription_date DESC
  `,

  updateStatus: `
    UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,

  updateKycStatus: `
    UPDATE subscriptions SET kyc_verified = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,

  updateSharePercentage: `
    UPDATE subscriptions SET share_percentage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,

  findTotalSubscribersByProperty: `
    SELECT COUNT(DISTINCT subscriber_user_id) as total_subscribers
    FROM subscriptions
    WHERE property_id = ? AND status = 'ACTIVE'
  `,

  findTotalSubscriptionAmount: `
    SELECT SUM(CAST(subscription_amount AS DECIMAL(20,8))) as total_amount
    FROM subscriptions
    WHERE property_id = ? AND status = 'ACTIVE'
  `,
};

// SQL queries for disbursement operations
export const disbursementQueries = {
  createTable: `
    CREATE TABLE IF NOT EXISTS disbursements (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      property_id VARCHAR(36) NOT NULL,
      distribution_id VARCHAR(36) NOT NULL,
      subscriber_id VARCHAR(36) NOT NULL,
      subscriber_wallet_address VARCHAR(42) NOT NULL,
      disbursement_amount VARCHAR(255) NOT NULL,
      disbursement_date TIMESTAMP NOT NULL,
      currency VARCHAR(20) NOT NULL,
      type ENUM('YIELD', 'RETURN', 'REVENUE', 'DIVIDEND') DEFAULT 'YIELD',
      status ENUM('PENDING', 'EXECUTED', 'FAILED') DEFAULT 'PENDING',
      transaction_hash VARCHAR(66),
      executed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_property_id (property_id),
      INDEX idx_distribution_id (distribution_id),
      INDEX idx_subscriber_id (subscriber_id),
      INDEX idx_subscriber_wallet_address (subscriber_wallet_address),
      INDEX idx_status (status),
      INDEX idx_type (type),
      INDEX idx_disbursement_date (disbursement_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  insert: `
    INSERT INTO disbursements (
      id, property_id, distribution_id, subscriber_id,
      subscriber_wallet_address, disbursement_amount, disbursement_date,
      currency, type, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  findById: `
    SELECT * FROM disbursements WHERE id = ?
  `,

  findByPropertyId: `
    SELECT d.*, s.subscriber_user_id
    FROM disbursements d
    LEFT JOIN subscriptions s ON d.subscriber_id = s.id
    WHERE d.property_id = ?
    ORDER BY d.disbursement_date DESC
  `,

  findByDistributionId: `
    SELECT * FROM disbursements WHERE distribution_id = ? ORDER BY disbursement_date DESC
  `,

  findBySubscriberId: `
    SELECT d.*, p.title as property_title
    FROM disbursements d
    LEFT JOIN properties p ON d.property_id = p.id
    WHERE d.subscriber_id = ?
    ORDER BY d.disbursement_date DESC
  `,

  findBySubscriberWallet: `
    SELECT d.*, p.title as property_title
    FROM disbursements d
    LEFT JOIN properties p ON d.property_id = p.id
    WHERE d.subscriber_wallet_address = ?
    ORDER BY d.disbursement_date DESC
  `,

  findPendingDisbursements: `
    SELECT * FROM disbursements WHERE status = 'PENDING' ORDER BY disbursement_date ASC
  `,

  findPendingByProperty: `
    SELECT * FROM disbursements
    WHERE property_id = ? AND status = 'PENDING'
    ORDER BY disbursement_date ASC
  `,

  updateStatus: `
    UPDATE disbursements
    SET status = ?, transaction_hash = ?, executed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,

  findTotalDisbursedBySubscriber: `
    SELECT SUM(CAST(disbursement_amount AS DECIMAL(20,8))) as total_disbursed
    FROM disbursements
    WHERE subscriber_id = ? AND status = 'EXECUTED'
  `,

  findTotalDisbursedByProperty: `
    SELECT SUM(CAST(disbursement_amount AS DECIMAL(20,8))) as total_disbursed
    FROM disbursements
    WHERE property_id = ? AND status = 'EXECUTED'
  `,

  findDisbursementsByDateRange: `
    SELECT * FROM disbursements
    WHERE property_id = ? AND disbursement_date BETWEEN ? AND ?
    ORDER BY disbursement_date DESC
  `,
};
