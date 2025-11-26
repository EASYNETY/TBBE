-- Activity Logs Table
-- Tracks all user actions (subscriptions, disbursements, deposits, etc.)

CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255),
  wallet_address VARCHAR(255) NOT NULL,
  action_type VARCHAR(100) NOT NULL COMMENT 'SUBSCRIBE, CANCEL_SUBSCRIPTION, DISBURSE, DEPOSIT, WITHDRAW, KYC_VERIFY, CLAIM_DISBURSEMENT',
  entity_type VARCHAR(100) NOT NULL COMMENT 'SUBSCRIPTION, PROPERTY, WALLET, DISBURSEMENT',
  entity_id VARCHAR(255) NOT NULL,
  property_id VARCHAR(36),
  description TEXT NOT NULL,
  details JSON COMMENT 'Additional context about the action',
  amount DECIMAL(20, 8),
  currency VARCHAR(10),
  transaction_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'COMPLETED' COMMENT 'PENDING, COMPLETED, FAILED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for fast queries
  INDEX idx_user_id (user_id),
  INDEX idx_wallet_address (wallet_address),
  INDEX idx_property_id (property_id),
  INDEX idx_action_type (action_type),
  INDEX idx_entity_type (entity_type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_wallet_created (wallet_address, created_at),
  INDEX idx_property_created (property_id, created_at)
);

-- Create additional indexes for common queries
CREATE INDEX idx_action_entity ON activity_logs(action_type, entity_type);
CREATE INDEX idx_property_action ON activity_logs(property_id, action_type, created_at);
CREATE INDEX idx_wallet_action ON activity_logs(wallet_address, action_type, created_at);

COMMENT ON TABLE activity_logs = 'Activity audit log for all user actions on the platform';
