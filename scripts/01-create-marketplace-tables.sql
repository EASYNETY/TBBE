-- Create marketplace tables for fractional real estate investment platform

-- Properties table - Updated for fractional ownership
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'US',
    property_type VARCHAR(50),
    square_feet INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3,1),
    lot_size DECIMAL(10,2),
    year_built INTEGER,
    images JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',
    legal_description TEXT,
    parcel_number VARCHAR(100),
    zoning VARCHAR(50),
    property_taxes DECIMAL(12,2),
    hoa_fees DECIMAL(10,2),
    utilities TEXT,
    amenities JSONB DEFAULT '[]',
    neighborhood_info TEXT,
    school_district VARCHAR(100),
    market_value DECIMAL(15,2),
    assessed_value DECIMAL(15,2),
    -- Added fractional ownership fields
    total_value DECIMAL(15,2) NOT NULL,
    total_shares BIGINT NOT NULL DEFAULT 1000000,
    available_shares BIGINT NOT NULL DEFAULT 1000000,
    share_price DECIMAL(15,8) GENERATED ALWAYS AS (total_value / total_shares) STORED,
    min_investment DECIMAL(15,2) NOT NULL DEFAULT 100,
    max_investment DECIMAL(15,2),
    expected_annual_return DECIMAL(5,2), -- Percentage
    rental_yield DECIMAL(5,2), -- Percentage
    occupancy_rate DECIMAL(5,2) DEFAULT 100.00, -- Percentage
    monthly_rental_income DECIMAL(12,2) DEFAULT 0,
    annual_expenses DECIMAL(12,2) DEFAULT 0,
    net_operating_income DECIMAL(12,2) DEFAULT 0,
    -- End fractional ownership fields
    token_id BIGINT UNIQUE,
    fractional_token_id BIGINT UNIQUE,
    contract_address VARCHAR(42),
    fractional_contract_address VARCHAR(42),
    owner_address VARCHAR(42),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_documents JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'sold_out', 'inactive'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- New table for tracking individual investments
CREATE TABLE IF NOT EXISTS property_investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    investor_address VARCHAR(42) NOT NULL,
    shares_owned BIGINT NOT NULL,
    total_invested DECIMAL(15,2) NOT NULL,
    average_share_price DECIMAL(15,8) NOT NULL,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_dividend_claim TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_dividends_received DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id, investor_address)
);

-- New table for revenue distributions
CREATE TABLE IF NOT EXISTS revenue_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    distribution_date DATE NOT NULL,
    total_revenue DECIMAL(15,2) NOT NULL,
    revenue_type VARCHAR(50) NOT NULL, -- 'rental', 'appreciation', 'other'
    revenue_per_share DECIMAL(15,8) NOT NULL,
    total_shares_eligible BIGINT NOT NULL,
    distribution_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'distributed', 'failed'
    transaction_hash VARCHAR(66),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    distributed_at TIMESTAMP
);

-- New table for individual dividend payments
CREATE TABLE IF NOT EXISTS dividend_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_id UUID REFERENCES revenue_distributions(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    investor_address VARCHAR(42) NOT NULL,
    shares_owned BIGINT NOT NULL,
    dividend_amount DECIMAL(15,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    transaction_hash VARCHAR(66),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marketplace listings table
CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    seller_address VARCHAR(42) NOT NULL,
    listing_type VARCHAR(20) NOT NULL, -- 'shares', 'auction', 'bundle'
    shares_for_sale BIGINT, -- For fractional share sales
    price_per_share DECIMAL(20,8), -- Price per individual share
    total_price DECIMAL(20,8), -- Total listing price
    currency VARCHAR(10) DEFAULT 'ETH',
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    min_bid DECIMAL(20,8),
    reserve_price DECIMAL(20,8),
    buy_now_price DECIMAL(20,8),
    is_active BOOLEAN DEFAULT TRUE,
    total_bids INTEGER DEFAULT 0,
    highest_bid DECIMAL(20,8),
    highest_bidder VARCHAR(42),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bids table
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    bidder_address VARCHAR(42) NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'ETH',
    tx_hash VARCHAR(66),
    block_number BIGINT,
    is_winning BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id),
    listing_id UUID REFERENCES listings(id),
    buyer_address VARCHAR(42) NOT NULL,
    seller_address VARCHAR(42) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- 'share_purchase', 'dividend', 'transfer'
    shares_quantity BIGINT, -- Number of shares involved
    price_per_share DECIMAL(20,8), -- Price per share
    amount DECIMAL(20,8),
    currency VARCHAR(10) DEFAULT 'ETH',
    tx_hash VARCHAR(66) UNIQUE,
    block_number BIGINT,
    gas_used BIGINT,
    gas_price DECIMAL(20,8),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
    marketplace_fee DECIMAL(20,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP
);

-- User profiles table (extends the existing users_sync table)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) UNIQUE, -- References users_sync.id
    wallet_address VARCHAR(42) UNIQUE,
    smart_account_address VARCHAR(42),
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url TEXT,
    cover_image_url TEXT,
    social_links JSONB DEFAULT '{}',
    kyc_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    kyc_documents JSONB DEFAULT '[]',
    is_verified_seller BOOLEAN DEFAULT FALSE,
    total_sales INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    reputation_score DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id),
    payment_method VARCHAR(20) NOT NULL, -- 'crypto', 'card', 'bank_transfer'
    payment_provider VARCHAR(50), -- 'stripe', 'coinbase', 'metamask'
    amount DECIMAL(20,8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    provider_payment_id VARCHAR(255),
    provider_response JSONB,
    escrow_address VARCHAR(42),
    escrow_status VARCHAR(20), -- 'held', 'released', 'disputed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address VARCHAR(42) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- New table for property performance metrics
CREATE TABLE IF NOT EXISTS property_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    occupancy_rate DECIMAL(5,2),
    monthly_revenue DECIMAL(12,2),
    monthly_expenses DECIMAL(12,2),
    net_income DECIMAL(12,2),
    property_value DECIMAL(15,2),
    total_return DECIMAL(5,2), -- Percentage
    dividend_yield DECIMAL(5,2), -- Percentage
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id, metric_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_address);
CREATE INDEX IF NOT EXISTS idx_properties_token_id ON properties(token_id);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_address);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_bids_listing ON bids(listing_id);
CREATE INDEX IF NOT EXISTS idx_bids_bidder ON bids(bidder_address);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_address);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_address);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_address);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Additional indexes for fractional ownership queries
CREATE INDEX IF NOT EXISTS idx_property_investments_investor ON property_investments(investor_address);
CREATE INDEX IF NOT EXISTS idx_property_investments_property ON property_investments(property_id);
CREATE INDEX IF NOT EXISTS idx_property_investments_active ON property_investments(is_active);
CREATE INDEX IF NOT EXISTS idx_revenue_distributions_property ON revenue_distributions(property_id);
CREATE INDEX IF NOT EXISTS idx_revenue_distributions_date ON revenue_distributions(distribution_date);
CREATE INDEX IF NOT EXISTS idx_revenue_distributions_status ON revenue_distributions(distribution_status);
CREATE INDEX IF NOT EXISTS idx_dividend_payments_investor ON dividend_payments(investor_address);
CREATE INDEX IF NOT EXISTS idx_dividend_payments_distribution ON dividend_payments(distribution_id);
CREATE INDEX IF NOT EXISTS idx_dividend_payments_status ON dividend_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_property_metrics_property ON property_metrics(property_id);
CREATE INDEX IF NOT EXISTS idx_property_metrics_date ON property_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_listings_shares ON listings(shares_for_sale);
CREATE INDEX IF NOT EXISTS idx_transactions_shares ON transactions(shares_quantity);
