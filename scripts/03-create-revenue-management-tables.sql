-- Create revenue management tables

-- Revenue streams table
CREATE TABLE IF NOT EXISTS revenue_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'marketplace_fee', 'subscription', 'premium_listing', 'transaction_fee'
    rate DECIMAL(10,4) NOT NULL,
    rate_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commission rules table
CREATE TABLE IF NOT EXISTS commission_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    property_type VARCHAR(50) NOT NULL,
    fee_rate DECIMAL(5,4) NOT NULL, -- Percentage rate
    minimum_fee DECIMAL(10,2) NOT NULL,
    maximum_fee DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Revenue tracking table
CREATE TABLE IF NOT EXISTS revenue_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revenue_stream_id UUID REFERENCES revenue_streams(id),
    property_id UUID REFERENCES properties(id),
    transaction_id UUID REFERENCES transactions(id),
    amount DECIMAL(15,2) NOT NULL,
    fee_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payout schedules table
CREATE TABLE IF NOT EXISTS payout_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_type VARCHAR(50) NOT NULL, -- 'property_owner', 'investor', 'referral_partner'
    recipient_id VARCHAR(255) NOT NULL,
    recipient_address VARCHAR(42),
    amount DECIMAL(15,2) NOT NULL,
    frequency VARCHAR(20) NOT NULL, -- 'weekly', 'monthly', 'quarterly'
    next_payout_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'completed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payout history table
CREATE TABLE IF NOT EXISTS payout_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES payout_schedules(id),
    recipient_address VARCHAR(42) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL, -- 'pending', 'completed', 'failed'
    transaction_hash VARCHAR(66),
    failure_reason TEXT,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Revenue forecasts table
CREATE TABLE IF NOT EXISTS revenue_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_period VARCHAR(20) NOT NULL, -- 'monthly', 'quarterly', 'annual'
    forecast_date DATE NOT NULL,
    projected_revenue DECIMAL(15,2) NOT NULL,
    actual_revenue DECIMAL(15,2),
    variance_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default revenue streams
INSERT INTO revenue_streams (name, type, rate, rate_type) VALUES
('Marketplace Fees', 'marketplace_fee', 1.0000, 'percentage'),
('Pro Subscriptions', 'subscription', 29.0000, 'fixed'),
('Enterprise Subscriptions', 'subscription', 99.0000, 'fixed'),
('Premium Listings', 'premium_listing', 99.0000, 'fixed')
ON CONFLICT DO NOTHING;

-- Insert default commission rules
INSERT INTO commission_rules (name, property_type, fee_rate, minimum_fee, maximum_fee) VALUES
('Residential Properties', 'residential', 1.0000, 100.00, 10000.00),
('Commercial Properties', 'commercial', 0.7500, 500.00, 25000.00),
('Industrial Properties', 'industrial', 0.5000, 1000.00, 50000.00),
('Land Properties', 'land', 1.2500, 200.00, 15000.00)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_revenue_streams_type ON revenue_streams(type);
CREATE INDEX IF NOT EXISTS idx_revenue_streams_active ON revenue_streams(is_active);
CREATE INDEX IF NOT EXISTS idx_commission_rules_property_type ON commission_rules(property_type);
CREATE INDEX IF NOT EXISTS idx_commission_rules_active ON commission_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_revenue_tracking_stream ON revenue_tracking(revenue_stream_id);
CREATE INDEX IF NOT EXISTS idx_revenue_tracking_date ON revenue_tracking(recorded_at);
CREATE INDEX IF NOT EXISTS idx_payout_schedules_recipient ON payout_schedules(recipient_id);
CREATE INDEX IF NOT EXISTS idx_payout_schedules_status ON payout_schedules(status);
CREATE INDEX IF NOT EXISTS idx_payout_schedules_next_date ON payout_schedules(next_payout_date);
CREATE INDEX IF NOT EXISTS idx_payout_history_schedule ON payout_history(schedule_id);
CREATE INDEX IF NOT EXISTS idx_payout_history_status ON payout_history(status);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_period ON revenue_forecasts(forecast_period);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_date ON revenue_forecasts(forecast_date);
