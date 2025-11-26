-- Create user_wallets table for in-app wallet management
CREATE TABLE IF NOT EXISTS user_wallets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  private_key_encrypted VARCHAR(255),
  balance_usdc DECIMAL(18, 6) DEFAULT 0,
  nonce INT DEFAULT 0,
  kyc_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  kyc_verified_at TIMESTAMP NULL,
  kyc_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_wallet_address (wallet_address),
  INDEX idx_kyc_status (kyc_status)
);

-- Create wallet_transactions table for tracking all transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  wallet_id VARCHAR(36) NOT NULL,
  transaction_type ENUM('deposit', 'withdraw', 'transfer', 'subscription_payment', 'roi_disbursement', 'internal_transfer') NOT NULL,
  amount DECIMAL(18, 6) NOT NULL,
  balance_before DECIMAL(18, 6),
  balance_after DECIMAL(18, 6),
  from_address VARCHAR(42),
  to_address VARCHAR(42),
  tx_hash VARCHAR(66),
  status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  description TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (wallet_id) REFERENCES user_wallets(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_wallet_id (wallet_id),
  INDEX idx_tx_type (transaction_type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Create wallet_deposits table for tracking deposit requests
CREATE TABLE IF NOT EXISTS wallet_deposits (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  wallet_id VARCHAR(36) NOT NULL,
  amount DECIMAL(18, 6) NOT NULL,
  source_address VARCHAR(42) NOT NULL,
  deposit_address VARCHAR(42) NOT NULL,
  status ENUM('pending', 'confirmed', 'failed') DEFAULT 'pending',
  tx_hash VARCHAR(66),
  confirmations INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (wallet_id) REFERENCES user_wallets(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_tx_hash (tx_hash)
);

-- Create kyc_verifications table for storing KYC verification records
CREATE TABLE IF NOT EXISTS kyc_verifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  wallet_id VARCHAR(36),
  provider VARCHAR(50),
  provider_id VARCHAR(255),
  status ENUM('pending', 'approved', 'rejected', 'expired') DEFAULT 'pending',
  kyc_data JSON,
  verification_date TIMESTAMP NULL,
  expiry_date TIMESTAMP NULL,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (wallet_id) REFERENCES user_wallets(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_provider (provider)
);

-- Add withdrawal_requests table for KYC-gated withdrawals
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  wallet_id VARCHAR(36) NOT NULL,
  amount DECIMAL(18, 6) NOT NULL,
  destination_address VARCHAR(42) NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'completed', 'failed') DEFAULT 'pending',
  requires_kyc BOOLEAN DEFAULT TRUE,
  kyc_verified BOOLEAN DEFAULT FALSE,
  tx_hash VARCHAR(66),
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (wallet_id) REFERENCES user_wallets(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_kyc_verified (kyc_verified)
);

-- Update users table to include wallet-related fields if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42),
ADD COLUMN IF NOT EXISTS kyc_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS kyc_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS kyc_data JSON;
