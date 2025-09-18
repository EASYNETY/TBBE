const { connectDB, query } = require('./../src/utils/database');

async function runMigration() {
  try {
    await connectDB();
    await query('ALTER TABLE users ADD COLUMN password VARCHAR(255)');
    console.log('Migration completed: Added password column to users table');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();