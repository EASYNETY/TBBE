"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../utils/database");
async function createPaymentOptionsTable() {
    try {
        await (0, database_1.connectDB)();
        // Create table
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
        // Insert initial data
        await (0, database_1.query)(`
      INSERT IGNORE INTO payment_options (id, name, type, currency, provider, fee_percentage, is_active, config) VALUES
      ('opt-1', 'Ethereum (ETH)', 'crypto', 'ETH', 'MetaMask', 0.0150, true, '{"network": "mainnet", "min_amount": 0.01}'),
      ('opt-2', 'Bitcoin (BTC)', 'crypto', 'BTC', 'WalletConnect', 0.0200, true, '{"network": "mainnet", "min_amount": 0.0005}'),
      ('opt-3', 'Credit Card', 'fiat', 'USD', 'Stripe', 0.0290, true, '{"api_key": "placeholder", "supported_countries": ["NZ", "US"]}'),
      ('opt-4', 'Bank Transfer', 'fiat', 'NZD', 'Direct Bank', 0.0050, true, '{"banks": ["ANZ", "BNZ"], "processing_time": "3-5 days"}'),
      ('opt-5', 'PayPal', 'fiat', 'USD', 'PayPal', 0.0300, false, '{"client_id": "placeholder"}')
    `);
        console.log('Payment options table created and initial data inserted successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}
createPaymentOptionsTable();
//# sourceMappingURL=create-payment-options.js.map