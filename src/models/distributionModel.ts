// Distribution model for the database schema
// Handles fractional share distributions, yield distributions, and revenue sharing

export interface DistributionAttributes {
  id: string;
  property_id: string;
  token_id?: number;
  amount: string; // Amount in wei/smallest unit
  currency: string; // USDC, dNZD, dAUD, etc.
  type: 'INITIAL' | 'YIELD' | 'REVENUE' | 'AIRDROP' | 'VESTING';
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  executed_at?: Date;
  tx_hash?: string;
  receiver_address: string;
  receiver_user_id?: string;
  distribution_data?: any; // JSON for additional data (vesting schedule, etc.)
  created_at?: Date;
  updated_at?: Date;
}

export interface DistributionCreationAttributes extends Omit<DistributionAttributes, 'id' | 'created_at' | 'updated_at'> {
  id?: string;
}

export interface ShareholderAttributes {
  id: string;
  property_id: string;
  token_id?: number;
  user_id: string;
  wallet_address: string;
  shares_owned: number; // Number of fractional shares
  percentage_owned: number; // Percentage ownership (0-100)
  acquisition_date: Date;
  acquisition_price?: string;
  vesting_schedule?: any; // JSON for vesting rules
  kyc_verified: boolean;
  created_at?: Date;
  updated_at?: Date;
}

// SQL queries for distribution operations
export const distributionQueries = {
  createTable: `
    CREATE TABLE IF NOT EXISTS distributions (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      property_id VARCHAR(36) NOT NULL,
      token_id BIGINT,
      amount VARCHAR(255) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      type ENUM('INITIAL', 'YIELD', 'REVENUE', 'AIRDROP', 'VESTING') DEFAULT 'INITIAL',
      status ENUM('PENDING', 'EXECUTED', 'FAILED') DEFAULT 'PENDING',
      executed_at TIMESTAMP NULL,
      tx_hash VARCHAR(66),
      receiver_address VARCHAR(42) NOT NULL,
      receiver_user_id VARCHAR(36),
      distribution_data JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_property_id (property_id),
      INDEX idx_token_id (token_id),
      INDEX idx_receiver_address (receiver_address),
      INDEX idx_status (status),
      INDEX idx_type (type)
    );
  `,

  insert: `
    INSERT INTO distributions (
      id, property_id, token_id, amount, currency, type, status,
      receiver_address, receiver_user_id, distribution_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  findByPropertyId: `
    SELECT * FROM distributions WHERE property_id = ? ORDER BY created_at DESC
  `,

  findByTokenId: `
    SELECT * FROM distributions WHERE token_id = ? ORDER BY created_at DESC
  `,

  findPending: `
    SELECT * FROM distributions WHERE status = 'PENDING' ORDER BY created_at ASC
  `,

  updateStatus: `
    UPDATE distributions SET status = ?, executed_at = CURRENT_TIMESTAMP, tx_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,

  findByReceiver: `
    SELECT * FROM distributions WHERE receiver_address = ? ORDER BY created_at DESC
  `,
};

// SQL queries for shareholder operations
export const shareholderQueries = {
  createTable: `
    CREATE TABLE IF NOT EXISTS shareholders (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      property_id VARCHAR(36) NOT NULL,
      token_id BIGINT,
      user_id VARCHAR(36) NOT NULL,
      wallet_address VARCHAR(42) NOT NULL,
      shares_owned BIGINT NOT NULL DEFAULT 0,
      percentage_owned DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      acquisition_date TIMESTAMP NOT NULL,
      acquisition_price VARCHAR(255),
      vesting_schedule JSON,
      kyc_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_property_id (property_id),
      INDEX idx_token_id (token_id),
      INDEX idx_user_id (user_id),
      INDEX idx_wallet_address (wallet_address),
      UNIQUE KEY unique_shareholder (property_id, user_id)
    );
  `,

  insert: `
    INSERT INTO shareholders (
      id, property_id, token_id, user_id, wallet_address, shares_owned,
      percentage_owned, acquisition_date, acquisition_price, vesting_schedule, kyc_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      shares_owned = shares_owned + VALUES(shares_owned),
      percentage_owned = percentage_owned + VALUES(percentage_owned),
      updated_at = CURRENT_TIMESTAMP
  `,

  findByPropertyId: `
    SELECT s.*, u.username, u.email
    FROM shareholders s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.property_id = ?
    ORDER BY s.percentage_owned DESC
  `,

  findByUserId: `
    SELECT s.*, p.title as property_title, p.address as property_address
    FROM shareholders s
    LEFT JOIN properties p ON s.property_id = p.id
    WHERE s.user_id = ?
    ORDER BY s.acquisition_date DESC
  `,

  updateShares: `
    UPDATE shareholders SET shares_owned = ?, percentage_owned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,

  updateKycStatus: `
    UPDATE shareholders SET kyc_verified = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,
};