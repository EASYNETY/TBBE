"use strict";
// Distribution model for the database schema
// Handles fractional share distributions, yield distributions, and revenue sharing
Object.defineProperty(exports, "__esModule", { value: true });
exports.shareholderQueries = exports.distributionQueries = void 0;
// SQL queries for distribution operations
exports.distributionQueries = {
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
exports.shareholderQueries = {
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
//# sourceMappingURL=distributionModel.js.map