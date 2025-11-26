"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../utils/database");
const createTables = async () => {
    try {
        console.log('Creating database tables...');
        // Users table
        await (0, database_1.query)(`
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
        role ENUM('super-admin', 'admin', 'account_manager', 'property_lawyer', 'auditor', 'compliance_officer', 'front_office', 'user') DEFAULT 'user',
        permissions JSON,
        department VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        is_whitelisted BOOLEAN DEFAULT FALSE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wallet (wallet_address),
        INDEX idx_smart_account (smart_account_address),
        INDEX idx_role (role)
      )
    `);
        // Properties table
        await (0, database_1.query)(`
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
      )
    `);
        // Add assessed_value column if not exists (compatible with older MySQL)
        const assessedValueExists = await (0, database_1.query)('SHOW COLUMNS FROM properties LIKE "assessed_value"');
        if (assessedValueExists.length === 0) {
            await (0, database_1.query)('ALTER TABLE properties ADD COLUMN assessed_value DECIMAL(15,2) DEFAULT NULL');
            console.log('Added assessed_value column to properties table');
        }
        else {
            console.log('assessed_value column already exists in properties table');
        }
        // Add is_featured column if not exists
        const featuredExists = await (0, database_1.query)('SHOW COLUMNS FROM properties LIKE "is_featured"');
        if (featuredExists.length === 0) {
            await (0, database_1.query)('ALTER TABLE properties ADD COLUMN is_featured BOOLEAN DEFAULT 0');
            console.log('Added is_featured column to properties table');
        }
        else {
            console.log('is_featured column already exists in properties table');
        }
        // Listings table
        await (0, database_1.query)(`
      CREATE TABLE IF NOT EXISTS listings (
        id VARCHAR(36) PRIMARY KEY,
        property_id VARCHAR(36) NOT NULL,
        seller_id VARCHAR(36) NOT NULL,
        listing_type ENUM('fixed_price', 'auction', 'collection_bid') NOT NULL,
        price DECIMAL(36,18),
        currency VARCHAR(10) DEFAULT 'ETH',
        start_time TIMESTAMP NULL,
        end_time TIMESTAMP NULL,
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
      )
    `);
        // Bids table
        await (0, database_1.query)(`
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
      )
    `);
        // Transactions table
        await (0, database_1.query)(`
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
      )
    `);
        // Payments table
        await (0, database_1.query)(`
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
      )
    `);
        // Notifications table
        await (0, database_1.query)(`
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
      )
    `);
        // Payment options table
        await (0, database_1.query)(`
      CREATE TABLE IF NOT EXISTS payment_options (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type ENUM('crypto', 'fiat') NOT NULL,
        currency VARCHAR(10),
        provider VARCHAR(100),
        fee_percentage DECIMAL(5,4) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        config JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_active (is_active)
      )
    `);
        // Seed initial payment options if none exist
        const existingOptions = await (0, database_1.query)('SELECT COUNT(*) as count FROM payment_options');
        if (existingOptions[0].count === 0) {
            await (0, database_1.query)(`
        INSERT INTO payment_options (id, name, type, currency, provider, fee_percentage, is_active, config) VALUES
        ('opt-1', 'Ethereum (ETH)', 'crypto', 'ETH', 'MetaMask', 0.0150, true, '{"network": "mainnet", "min_amount": 0.01}'),
        ('opt-2', 'Bitcoin (BTC)', 'crypto', 'BTC', 'WalletConnect', 0.0200, true, '{"network": "mainnet", "min_amount": 0.0005}'),
        ('opt-3', 'Credit Card', 'fiat', 'USD', 'Stripe', 0.0290, true, '{"api_key": "placeholder", "supported_countries": ["NZ", "US"]}'),
        ('opt-4', 'Bank Transfer', 'fiat', 'NZD', 'Direct Bank', 0.0050, true, '{"banks": ["ANZ", "BNZ"], "processing_time": "3-5 days"}'),
        ('opt-5', 'PayPal', 'fiat', 'USD', 'PayPal', 0.0300, false, '{"client_id": "placeholder"}')
      `);
            console.log('Payment options table created and seeded');
        }
        console.log('Database tables created successfully!');
    }
    catch (error) {
        console.error('Error creating database tables:', error);
        throw error;
    }
};
// Run the setup
(0, database_1.connectDB)()
    .then(() => {
    console.log('Connected to database, creating tables...');
    return createTables();
})
    .then(() => {
    console.log('Database setup completed!');
    process.exit(0);
})
    .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
});
//# sourceMappingURL=setup-db.js.map