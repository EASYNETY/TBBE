-- Add role-based access control to users table

-- Add role and permissions columns to users table
ALTER TABLE users 
ADD COLUMN role ENUM('super_admin', 'admin', 'account_manager', 'property_lawyer', 'auditor', 'compliance_officer', 'front_office', 'user') DEFAULT 'user',
ADD COLUMN permissions JSON,
ADD COLUMN department VARCHAR(100),
ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN last_login TIMESTAMP NULL,
ADD INDEX idx_role (role),
ADD INDEX idx_active (is_active);

-- Create user_roles table for more complex role assignments
CREATE TABLE IF NOT EXISTS user_roles (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('super_admin', 'admin', 'account_manager', 'property_lawyer', 'auditor', 'compliance_officer', 'front_office', 'user') NOT NULL,
  granted_by VARCHAR(36),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (granted_by) REFERENCES users(id),
  INDEX idx_user_role (user_id, role),
  INDEX idx_active (is_active)
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id VARCHAR(36) PRIMARY KEY,
  role ENUM('super_admin', 'admin', 'account_manager', 'property_lawyer', 'auditor', 'compliance_officer', 'front_office', 'user') NOT NULL,
  permission VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  action ENUM('create', 'read', 'update', 'delete', 'approve', 'reject', 'export') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_role_permission (role, permission, resource, action),
  INDEX idx_role (role),
  INDEX idx_permission (permission)
);

-- Insert default role permissions
INSERT INTO role_permissions (id, role, permission, resource, action) VALUES
-- Super Admin - Full access
(UUID(), 'super_admin', 'platform_management', 'all', 'create'),
(UUID(), 'super_admin', 'platform_management', 'all', 'read'),
(UUID(), 'super_admin', 'platform_management', 'all', 'update'),
(UUID(), 'super_admin', 'platform_management', 'all', 'delete'),
(UUID(), 'super_admin', 'user_management', 'all', 'create'),
(UUID(), 'super_admin', 'user_management', 'all', 'read'),
(UUID(), 'super_admin', 'user_management', 'all', 'update'),
(UUID(), 'super_admin', 'user_management', 'all', 'delete'),

-- Admin - Platform management
(UUID(), 'admin', 'property_management', 'properties', 'create'),
(UUID(), 'admin', 'property_management', 'properties', 'read'),
(UUID(), 'admin', 'property_management', 'properties', 'update'),
(UUID(), 'admin', 'property_management', 'properties', 'approve'),
(UUID(), 'admin', 'property_management', 'properties', 'reject'),
(UUID(), 'admin', 'user_management', 'users', 'read'),
(UUID(), 'admin', 'user_management', 'users', 'update'),
(UUID(), 'admin', 'analytics', 'reports', 'read'),
(UUID(), 'admin', 'analytics', 'reports', 'export'),

-- Account Manager - User and account management
(UUID(), 'account_manager', 'user_management', 'users', 'read'),
(UUID(), 'account_manager', 'user_management', 'users', 'update'),
(UUID(), 'account_manager', 'kyc_management', 'kyc', 'read'),
(UUID(), 'account_manager', 'kyc_management', 'kyc', 'approve'),
(UUID(), 'account_manager', 'kyc_management', 'kyc', 'reject'),
(UUID(), 'account_manager', 'support', 'tickets', 'read'),
(UUID(), 'account_manager', 'support', 'tickets', 'update'),

-- Property Lawyer - Legal and compliance
(UUID(), 'property_lawyer', 'property_verification', 'properties', 'read'),
(UUID(), 'property_lawyer', 'property_verification', 'properties', 'approve'),
(UUID(), 'property_lawyer', 'property_verification', 'properties', 'reject'),
(UUID(), 'property_lawyer', 'legal_documents', 'documents', 'read'),
(UUID(), 'property_lawyer', 'legal_documents', 'documents', 'create'),
(UUID(), 'property_lawyer', 'legal_documents', 'documents', 'update'),
(UUID(), 'property_lawyer', 'compliance', 'reports', 'read'),
(UUID(), 'property_lawyer', 'compliance', 'reports', 'export'),

-- Auditor - Financial oversight
(UUID(), 'auditor', 'financial_audit', 'transactions', 'read'),
(UUID(), 'auditor', 'financial_audit', 'revenue', 'read'),
(UUID(), 'auditor', 'financial_audit', 'reports', 'read'),
(UUID(), 'auditor', 'financial_audit', 'reports', 'export'),
(UUID(), 'auditor', 'compliance_audit', 'compliance', 'read'),
(UUID(), 'auditor', 'risk_assessment', 'risk', 'read'),

-- Compliance Officer - Regulatory compliance
(UUID(), 'compliance_officer', 'compliance_monitoring', 'compliance', 'read'),
(UUID(), 'compliance_officer', 'compliance_monitoring', 'compliance', 'update'),
(UUID(), 'compliance_officer', 'kyc_compliance', 'kyc', 'read'),
(UUID(), 'compliance_officer', 'kyc_compliance', 'kyc', 'approve'),
(UUID(), 'compliance_officer', 'kyc_compliance', 'kyc', 'reject'),
(UUID(), 'compliance_officer', 'regulatory_reports', 'reports', 'read'),
(UUID(), 'compliance_officer', 'regulatory_reports', 'reports', 'export'),

-- Front Office - Customer facing operations
(UUID(), 'front_office', 'customer_support', 'support', 'read'),
(UUID(), 'front_office', 'customer_support', 'support', 'update'),
(UUID(), 'front_office', 'property_listings', 'properties', 'read'),
(UUID(), 'front_office', 'user_assistance', 'users', 'read'),
(UUID(), 'front_office', 'transaction_support', 'transactions', 'read'),

-- User - Basic user permissions
(UUID(), 'user', 'portfolio', 'own_portfolio', 'read'),
(UUID(), 'user', 'properties', 'marketplace', 'read'),
(UUID(), 'user', 'transactions', 'own_transactions', 'read'),
(UUID(), 'user', 'profile', 'own_profile', 'update');
