import { connectDB, query } from '../utils/database';
import { distributionQueries, shareholderQueries } from '../models/distributionModel';

export async function setupMintingTables(): Promise<void> {
  try {
    // Connect to database first
    await connectDB();
    console.log('Setting up minting-related database tables...');

    // Create distributions table
    await query(distributionQueries.createTable);
    console.log('✓ Created distributions table');

    // Create shareholders table
    await query(shareholderQueries.createTable);
    console.log('✓ Created shareholders table');

    // Create system_settings table for tracking sync state
    await query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        \`key\` VARCHAR(255) PRIMARY KEY,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Created system_settings table');

    // Create notifications table
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id VARCHAR(36) NOT NULL,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_type (type),
        INDEX idx_created_at (created_at)
      );
    `);
    console.log('✓ Created notifications table');

    // Add new columns to properties table if they don't exist
    const alterQueries = [
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS tba_address VARCHAR(42)',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS marketplace_registered BOOLEAN DEFAULT FALSE',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS trade_ready BOOLEAN DEFAULT FALSE',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS minted_at TIMESTAMP NULL',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP NULL',
    ];

    for (const alterQuery of alterQueries) {
      try {
        await query(alterQuery);
      } catch (error) {
        // Column might already exist, continue
        console.log(`Note: ${alterQuery.split('ADD COLUMN')[1]?.trim()} might already exist`);
      }
    }

    console.log('✓ Updated properties table with minting columns');

    console.log('Minting database setup completed successfully!');

  } catch (error) {
    console.error('Failed to setup minting tables:', error);
    throw error;
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupMintingTables()
    .then(() => {
      console.log('Setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}