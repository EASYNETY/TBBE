// Migration script to create subscriptions and disbursements tables
// Run this after setting up the database connection

import { query } from '../utils/database';
import { subscriptionQueries, disbursementQueries } from '../models/subscriptionModel';

export async function createSubscriptionsTables(): Promise<void> {
  try {
    console.log('Creating subscriptions table...');
    await query(subscriptionQueries.createTable, []);
    console.log('✓ Subscriptions table created');

    console.log('Creating disbursements table...');
    await query(disbursementQueries.createTable, []);
    console.log('✓ Disbursements table created');

    console.log('All subscription tables created successfully!');
  } catch (error) {
    console.error('Error creating subscription tables:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  createSubscriptionsTables()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
