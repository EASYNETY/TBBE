import { query } from '../utils/database';

async function addFeaturedColumn() {
  try {
    await query('ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE');
    console.log('Successfully added is_featured column to properties table.');
  } catch (error) {
    console.error('Failed to add is_featured column:', error);
  }
}

addFeaturedColumn();