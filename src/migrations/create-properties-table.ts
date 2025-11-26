import { connectDB, query } from '../utils/database';

const createPropertiesTableSQL = `
CREATE TABLE IF NOT EXISTS properties (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36),
  project_id VARCHAR(36),
  title VARCHAR(255) NOT NULL,
  address VARCHAR(512) NOT NULL,
  description TEXT,
  property_type VARCHAR(50),
  ownership_type VARCHAR(50),
  fractional BOOLEAN DEFAULT FALSE,
  supply INT DEFAULT 1,
  price DECIMAL(20,2),
  square_footage INT,
  bedrooms INT,
  bathrooms DECIMAL(3,1),
  year_built INT,
  lot_size DECIMAL(10,2),
  assessed_value DECIMAL(20,2),
  images JSON,
  documents JSON,
  video_tour_url VARCHAR(2048),
  metadata_tags JSON,
  metadata_hash VARCHAR(255),
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'MINTED', 'ACTIVE', 'HIDDEN') DEFAULT 'PENDING',
  verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  hidden BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  token_id BIGINT,
  rejection_reason TEXT,
  property_registry_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_owner_id (owner_id),
  INDEX idx_project_id (project_id),
  INDEX idx_status (status),
  INDEX idx_property_type (property_type),
  INDEX idx_metadata_hash (metadata_hash),
  INDEX idx_verification_status (verification_status),
  INDEX idx_is_featured (is_featured)
);
`;

async function createPropertiesTable() {
  try {
    await connectDB();
    await query(createPropertiesTableSQL);
    console.log('Properties table created successfully.');
  } catch (error) {
    console.error('Failed to create properties table:', error);
    throw error;
  }
}

createPropertiesTable();