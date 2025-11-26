// Activity Log Model
// Defines the activity logging schema and queries

export interface ActivityLog {
  id: string;
  user_id?: string;
  wallet_address: string;
  action_type: 'SUBSCRIBE' | 'CANCEL_SUBSCRIPTION' | 'DISBURSE' | 'DEPOSIT' | 'WITHDRAW' | 'KYC_VERIFY' | 'CLAIM_DISBURSEMENT';
  entity_type: 'SUBSCRIPTION' | 'PROPERTY' | 'WALLET' | 'DISBURSEMENT';
  entity_id: string;
  property_id?: string;
  description: string;
  details?: Record<string, any>;
  amount?: string;
  currency?: string;
  transaction_hash?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  created_at: Date;
  updated_at: Date;
}

export const activityLogQueries = {
  // Create activity log
  insert: `
    INSERT INTO activity_logs (
      id,
      user_id,
      wallet_address,
      action_type,
      entity_type,
      entity_id,
      property_id,
      description,
      details,
      amount,
      currency,
      transaction_hash,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  // Get all activities for a user
  findByUserId: `
    SELECT * FROM activity_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
  `,

  // Get all activities by wallet address
  findByWalletAddress: `
    SELECT * FROM activity_logs
    WHERE wallet_address = ?
    ORDER BY created_at DESC
  `,

  // Get all activities for a property
  findByPropertyId: `
    SELECT * FROM activity_logs
    WHERE property_id = ?
    ORDER BY created_at DESC
  `,

  // Get recent activities (limit 50)
  findRecent: `
    SELECT * FROM activity_logs
    ORDER BY created_at DESC
    LIMIT 50
  `,

  // Get recent activities for a user
  findRecentByUser: `
    SELECT * FROM activity_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `,

  // Get activities by date range
  findByDateRange: `
    SELECT * FROM activity_logs
    WHERE created_at BETWEEN ? AND ?
    ORDER BY created_at DESC
  `,

  // Get activities by action type
  findByActionType: `
    SELECT * FROM activity_logs
    WHERE action_type = ?
    ORDER BY created_at DESC
  `,

  // Get activities for property by date range
  findPropertyActivitiesByDateRange: `
    SELECT * FROM activity_logs
    WHERE property_id = ? AND created_at BETWEEN ? AND ?
    ORDER BY created_at DESC
  `,

  // Update activity status (e.g., when PENDING becomes COMPLETED)
  updateStatus: `
    UPDATE activity_logs
    SET status = ?, transaction_hash = ?, updated_at = ?
    WHERE id = ?
  `,

  // Get activity count by action type for property
  countByPropertyAndAction: `
    SELECT action_type, COUNT(*) as count
    FROM activity_logs
    WHERE property_id = ?
    GROUP BY action_type
  `,
};

// Migration/Schema Creation Query
export const createActivityLogsTableQuery = `
CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255),
  wallet_address VARCHAR(255) NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  property_id VARCHAR(36),
  description TEXT NOT NULL,
  details JSON,
  amount DECIMAL(20, 8),
  currency VARCHAR(10),
  transaction_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'COMPLETED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_wallet_address (wallet_address),
  INDEX idx_property_id (property_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at),
  INDEX idx_user_created (user_id, created_at)
);
`;
