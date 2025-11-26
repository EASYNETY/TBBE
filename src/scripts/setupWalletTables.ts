import { connectDB, getPool } from '../utils/database';
import fs from 'fs';
import path from 'path';

/**
 * Setup Wallet Tables Script
 * Creates all necessary tables for the wallet system
 */

async function setupWalletTables() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    const pool = getPool();

    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/001_create_wallet_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

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
      } catch (error: any) {
        // Some statements might fail if tables already exist, which is fine
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠ Table already exists (skipped)`);
        } else if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠ Column already exists (skipped)`);
        } else {
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
    `) as any[];

    console.log(`\nVerified tables created: ${tables.length}/5`);
    tables.forEach((table: any) => {
      console.log(`  ✓ ${table.TABLE_NAME}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error setting up wallet tables:', error);
    process.exit(1);
  }
}

setupWalletTables();
