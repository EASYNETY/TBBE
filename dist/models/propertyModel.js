"use strict";
// Property model for the database schema
// Using raw SQL queries instead of Sequelize for consistency with existing codebase
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyQueries = void 0;
// SQL queries for property operations
exports.propertyQueries = {
    createTable: `
    CREATE TABLE IF NOT EXISTS properties (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id VARCHAR(36) NOT NULL,
      project_id VARCHAR(36),
      title VARCHAR(255) NOT NULL,
      address VARCHAR(512) NOT NULL,
      description TEXT,
      property_type VARCHAR(50),
      ownership_type VARCHAR(50),
      fractional BOOLEAN DEFAULT FALSE,
      supply INT DEFAULT 1,
      price DECIMAL(20,2),
      images JSON,
      documents JSON,
      video_tour_url VARCHAR(2048),
      metadata_tags JSON,
      metadata_hash VARCHAR(255),
      status ENUM('PENDING', 'APPROVED', 'REJECTED', 'MINTED', 'ACTIVE', 'HIDDEN') DEFAULT 'PENDING',
      hidden BOOLEAN DEFAULT FALSE,
      token_id BIGINT,
      rejection_reason TEXT,
      property_registry_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_project_id (project_id),
      INDEX idx_status (status),
      INDEX idx_property_type (property_type),
      INDEX idx_metadata_hash (metadata_hash)
    );
  `,
    insert: `
    INSERT INTO properties (
      id, user_id, project_id, title, address, description, property_type,
      ownership_type, fractional, supply, price, images, documents,
      video_tour_url, metadata_tags, metadata_hash, status, hidden
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    findById: `
    SELECT * FROM properties WHERE id = ?
  `,
    findByUserId: `
    SELECT * FROM properties WHERE user_id = ? ORDER BY created_at DESC
  `,
    findByStatus: `
    SELECT * FROM properties WHERE status = ? ORDER BY created_at DESC
  `,
    findPending: `
    SELECT p.*, u.username as owner_username, u.wallet_address as owner_address
    FROM properties p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.status = 'PENDING'
    ORDER BY p.created_at DESC
  `,
    updateStatus: `
    UPDATE properties SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,
    updateRejectionReason: `
    UPDATE properties SET status = 'REJECTED', rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,
    updateTokenId: `
    UPDATE properties SET token_id = ?, status = 'MINTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,
    updatePropertyRegistryId: `
    UPDATE properties SET property_registry_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,
    toggleVisibility: `
    UPDATE properties SET hidden = NOT hidden, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,
    updateMetadataHash: `
    UPDATE properties SET metadata_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `,
};
//# sourceMappingURL=propertyModel.js.map