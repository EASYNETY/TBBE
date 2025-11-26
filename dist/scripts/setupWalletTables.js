"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../utils/database");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Setup Wallet Tables Script
 * Creates all necessary tables for the wallet system
 */
async function setupWalletTables() {
    try {
        console.log('Connecting to database...');
        await (0, database_1.connectDB)();
        const pool = (0, database_1.getPool)();
        // Read the migration file
        const migrationPath = path_1.default.join(__dirname, '../migrations/001_create_wallet_tables.sql');
        const migrationSQL = fs_1.default.readFileSync(migrationPath, 'utf8');
        // Split by statements (simple split by ; for basic SQL)
        const statements = migrationSQL
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        console.log(`Running ${statements.length} migration statements...`);
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            try {
                console.log(`Executing statement ${i + 1}/${statements.length}...`);
                await pool.query(statement);
                console.log(`✓ Statement ${i + 1} completed`);
            }
            catch (error) {
                // Some statements might fail if tables already exist, which is fine
                if (error.code === 'ER_TABLE_EXISTS_ERROR') {
                    console.log(`⚠ Table already exists (skipped)`);
                }
                else if (error.code === 'ER_DUP_FIELDNAME') {
                    console.log(`⚠ Column already exists (skipped)`);
                }
                else {
                    console.error(`✗ Error in statement ${i + 1}:`, error.message);
                    throw error;
                }
            }
        }
        console.log('\n✓ All wallet tables have been set up successfully!');
        // Verify tables exist
        const [tables] = await pool.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN (
        'user_wallets',
        'wallet_transactions',
        'wallet_deposits',
        'kyc_verifications',
        'withdrawal_requests'
      )
    `);
        console.log(`\nVerified tables created: ${tables.length}/5`);
        tables.forEach((table) => {
            console.log(`  ✓ ${table.TABLE_NAME}`);
        });
        process.exit(0);
    }
    catch (error) {
        console.error('Error setting up wallet tables:', error);
        process.exit(1);
    }
}
setupWalletTables();
//# sourceMappingURL=setupWalletTables.js.map