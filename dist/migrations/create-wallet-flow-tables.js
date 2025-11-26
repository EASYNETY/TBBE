"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWalletFlowTables = createWalletFlowTables;
exports.seedWalletFlowData = seedWalletFlowData;
/**
 * Create comprehensive wallet flow database tables
 * Including account linking, transactions, and disbursements
 */
async function createWalletFlowTables(pool) {
    const connection = await pool.getConnection();
    try {
        // ========== Account Linking Tables ==========
        // Store linked wallets and smart accounts
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS account_links (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        smart_account_address VARCHAR(42) NOT NULL,
        wallet_address VARCHAR(42) NOT NULL,
        linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_primary TINYINT(1) DEFAULT 0,
        status ENUM('active', 'inactive', 'pending') DEFAULT 'pending',
        verification_code VARCHAR(8),
        verified_at TIMESTAMP NULL,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_wallet_per_user (user_id, wallet_address),
        UNIQUE KEY unique_smart_account (smart_account_address),
        KEY idx_user_id (user_id),
        KEY idx_status (status),
        KEY idx_wallet_address (wallet_address),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // Audit trail for account linking actions
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS account_linking_history (
        id VARCHAR(36) PRIMARY KEY,
        account_link_id VARCHAR(36) NOT NULL,
        action VARCHAR(255) NOT NULL,
        performed_by VARCHAR(36) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        status VARCHAR(20) DEFAULT 'success',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_link_id (account_link_id),
        KEY idx_performed_by (performed_by),
        KEY idx_created_at (created_at),
        FOREIGN KEY (account_link_id) REFERENCES account_links(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // ========== Enhanced Wallet Transaction Tables ==========
        // Comprehensive transaction records with metadata
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        wallet_id VARCHAR(36) NOT NULL,
        transaction_type ENUM(
          'deposit',
          'withdrawal',
          'transfer',
          'roi_disbursement',
          'subscription_payment',
          'refund'
        ) NOT NULL,
        amount DECIMAL(20, 8) NOT NULL,
        balance_before DECIMAL(20, 8) NOT NULL,
        balance_after DECIMAL(20, 8),
        from_address VARCHAR(42) NOT NULL,
        to_address VARCHAR(42) NOT NULL,
        tx_hash VARCHAR(66),
        status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
        description VARCHAR(255),
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_user_id (user_id),
        KEY idx_wallet_id (wallet_id),
        KEY idx_status (status),
        KEY idx_type (transaction_type),
        KEY idx_created_at (created_at),
        KEY idx_from_address (from_address),
        KEY idx_to_address (to_address),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (wallet_id) REFERENCES user_wallets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // ========== Disbursement Tables ==========
        // Individual disbursement records
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS disbursements (
        id VARCHAR(36) PRIMARY KEY,
        subscription_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        amount DECIMAL(20, 8) NOT NULL,
        roi_percentage DECIMAL(5, 2) NOT NULL,
        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        tx_hash VARCHAR(66),
        scheduled_for TIMESTAMP,
        processed_at TIMESTAMP NULL,
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_subscription_id (subscription_id),
        KEY idx_user_id (user_id),
        KEY idx_status (status),
        KEY idx_scheduled_for (scheduled_for),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // Recurring disbursement schedules
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS disbursement_schedules (
        id VARCHAR(36) PRIMARY KEY,
        subscription_id VARCHAR(36) NOT NULL UNIQUE,
        user_id VARCHAR(36) NOT NULL,
        amount DECIMAL(20, 8) NOT NULL,
        roi_percentage DECIMAL(5, 2) NOT NULL,
        frequency ENUM('monthly', 'quarterly', 'annually') DEFAULT 'monthly',
        next_disbursement TIMESTAMP,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_subscription_id (subscription_id),
        KEY idx_user_id (user_id),
        KEY idx_next_disbursement (next_disbursement),
        KEY idx_is_active (is_active),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // ========== Enhanced User Wallets Table ==========
        // Ensure wallet tables have all necessary columns
        const checkWalletColumns = await connection.query("DESCRIBE user_wallets");
        // Add smart account reference to users if not exists
        await connection.execute(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS smart_account_address VARCHAR(42),
      ADD UNIQUE KEY IF NOT EXISTS unique_smart_account (smart_account_address)
    `);
        console.log('Wallet flow tables created successfully');
    }
    catch (error) {
        console.error('Error creating wallet flow tables:', error);
        throw error;
    }
    finally {
        connection.release();
    }
}
async function seedWalletFlowData(pool) {
    // Optional: Add seed data if needed
    console.log('Wallet flow tables are ready');
}
//# sourceMappingURL=create-wallet-flow-tables.js.map