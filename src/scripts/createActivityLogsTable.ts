// Script to create activity_logs table
import { query } from '../utils/database';
import { createActivityLogsTableQuery } from '../models/activityLogModel';

export async function createActivityLogsTable() {
  try {
    console.log('Creating activity_logs table...');
    await query(createActivityLogsTableQuery, []);
    console.log('✅ activity_logs table created successfully');
  } catch (error) {
    console.error('Failed to create activity_logs table:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createActivityLogsTable()
    .then(() => {
      console.log('✅ Database setup complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database setup failed:', error);
      process.exit(1);
    });
}
