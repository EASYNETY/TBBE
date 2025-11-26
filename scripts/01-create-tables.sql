-- Create database schema for title-backed NFT marketplace

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE,
  smart_account_address VARCHAR(42),
  email VARCHAR(255),
  username VARCHAR(50),
  avatar_url TEXT,
  kyc_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  kyc_data JSON,
  social_logins JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wallet (wallet_address),
  INDEX idx_smart_account (smart_account_address)
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id VARCHAR(36) PRIMARY KEY,
  token_id BIGINT UNIQUE,
  owner_id VARCHAR(36),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  property_type ENUM('residential', 'commercial', 'land', 'industrial') NOT NULL,
  square_footage INT,
  bedrooms INT,
  bathrooms DECIMAL(3,1),
  year_built INT,
  lot_size DECIMAL(10,2),
  images JSON,
  documents JSON,
  verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  verification_documents JSON,
  metadata_uri TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  INDEX idx_token_id (token_id),
  INDEX idx_owner (owner_id),
  INDEX idx_type (property_type)
);

-- Listings table
CREATE TABLE IF NOT EXISTS listings (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL,
  seller_id VARCHAR(36) NOT NULL,
  listing_type ENUM('fixed_price', 'auction', 'collection_bid') NOT NULL,
  price DECIMAL(36,18),
  currency VARCHAR(10) DEFAULT 'ETH',
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  status ENUM('active', 'sold', 'cancelled', 'expired') DEFAULT 'active',
  transaction_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id),
  FOREIGN KEY (seller_id) REFERENCES users(id),
  INDEX idx_property (property_id),
  INDEX idx_seller (seller_id),
  INDEX idx_status (status),
  INDEX idx_type (listing_type)
);

-- Bids table
CREATE TABLE IF NOT EXISTS bids (
  id VARCHAR(36) PRIMARY KEY,
  listing_id VARCHAR(36) NOT NULL,
  bidder_id VARCHAR(36) NOT NULL,
  amount DECIMAL(36,18) NOT NULL,
  currency VARCHAR(10) DEFAULT 'ETH',
  status ENUM('active', 'outbid', 'won', 'cancelled') DEFAULT 'active',
  transaction_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES listings(id),
  FOREIGN KEY (bidder_id) REFERENCES users(id),
  INDEX idx_listing (listing_id),
  INDEX idx_bidder (bidder_id),
  INDEX idx_status (status)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY,
  property_id VARCHAR(36) NOT NULL,
  from_user_id VARCHAR(36),
  to_user_id VARCHAR(36),
  transaction_type ENUM('mint', 'sale', 'transfer', 'bid', 'auction_end') NOT NULL,
  amount DECIMAL(36,18),
  currency VARCHAR(10),
  transaction_hash VARCHAR(66) UNIQUE,
  block_number BIGINT,
  gas_used BIGINT,
  gas_price DECIMAL(36,18),
  status ENUM('pending', 'confirmed', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id),
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id),
  INDEX idx_property (property_id),
  INDEX idx_from_user (from_user_id),
  INDEX idx_to_user (to_user_id),
  INDEX idx_hash (transaction_hash),
  INDEX idx_type (transaction_type)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  listing_id VARCHAR(36),
  payment_type ENUM('crypto', 'fiat') NOT NULL,
  payment_method VARCHAR(50),
  amount DECIMAL(36,18) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  payment_intent_id VARCHAR(255),
  transaction_hash VARCHAR(66),
  escrow_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (listing_id) REFERENCES listings(id),
  INDEX idx_user (user_id),
  INDEX idx_listing (listing_id),
  INDEX idx_status (status)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSON,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_read (read_at)
);
