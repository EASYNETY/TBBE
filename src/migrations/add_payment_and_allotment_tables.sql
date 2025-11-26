-- Migration: Add Payment Gateway and Allotment Management Tables
-- Date: 2025-11-23
-- Purpose: Support multiple payment processors and subscription allotment management

-- Table for payment transactions (all gateways)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36),
  subscriber_user_id VARCHAR(36),
  amount DECIMAL(18, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'AUD',
  gateway VARCHAR(50) NOT NULL COMMENT 'STRIPE, EWAY, POLI, NZD, TRANSFER',
  gateway_transaction_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL COMMENT 'COMPLETED, PENDING, FAILED, REFUNDED',
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_subscriber (subscriber_user_id),
  INDEX idx_property (property_id),
  INDEX idx_gateway_tx (gateway_transaction_id),
  INDEX idx_status (status),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

-- Table for pending bank transfers (manual reconciliation)
CREATE TABLE IF NOT EXISTS pending_transfers (
  id VARCHAR(36) PRIMARY KEY,
  subscription_id VARCHAR(36) NOT NULL,
  amount DECIMAL(18, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'NZD',
  account_holder VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  reference VARCHAR(100),
  subscriber_user_id VARCHAR(36),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, RECONCILED, FAILED',
  reconciled_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_subscription (subscription_id),
  INDEX idx_status (status),
  INDEX idx_subscriber (subscriber_user_id),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Table for property subscription allotments
CREATE TABLE IF NOT EXISTS property_allotments (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL UNIQUE,
  total_allotment DECIMAL(18, 2) NOT NULL COMMENT 'Total subscription capacity',
  price_per_share DECIMAL(18, 2) NOT NULL,
  available_shares DECIMAL(18, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_property (property_id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

-- Table for property bank transfer accounts
CREATE TABLE IF NOT EXISTS property_transfer_accounts (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL UNIQUE,
  account_holder VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  routing_number VARCHAR(20),
  swift_code VARCHAR(20),
  iban VARCHAR(50),
  currency VARCHAR(3) NOT NULL DEFAULT 'NZD',
  reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_property (property_id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

-- Add payment method columns to subscriptions table if not exists
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'STRIPE';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS transfer_details JSON;
