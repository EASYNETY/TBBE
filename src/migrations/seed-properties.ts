import { query, connectDB } from '../utils/database';

const seedSQL = `
-- First, ensure a default seller user exists (admin user)
INSERT IGNORE INTO users (id, wallet_address, username, role, permissions, is_active, email) 
VALUES ('default-seller', '0x000000000000000000000000000000000000dead', 'Platform Admin', 'admin', '[]', true, 'admin@titlebase.com');

-- Insert 10 Buy properties (fixed_price listings)
INSERT IGNORE INTO properties (id, owner_id, title, description, address, property_type, square_footage, bedrooms, bathrooms, year_built, lot_size, assessed_value, images, verification_status, is_featured) VALUES
('buy-prop-1', 'default-seller', 'Modern Auckland Apartment', 'Luxury 2-bed apartment in Auckland CBD with city views', '123 Queen Street, Auckland CBD, Auckland 1010', 'residential', 850, 2, 2.0, 2020, 0.00, 500000.00, '["/modern-downtown-condo.png"]', 'verified', TRUE),
('buy-prop-2', 'default-seller', 'Waterfront Villa in Queenstown', 'Stunning lakeside villa with private dock', '45 Lake Esplanade, Queenstown 9300', 'residential', 2500, 4, 3.5, 2018, 0.50, 1200000.00, '["/luxury-beach-house.png"]', 'verified', TRUE),
('buy-prop-3', 'default-seller', 'Wellington Townhouse', 'Historic townhouse near waterfront', '78 Oriental Parade, Wellington 6011', 'residential', 1800, 3, 2.0, 1920, 0.00, 750000.00, '["/historic-brownstone.png"]', 'verified', FALSE),
('buy-prop-4', 'default-seller', 'Christchurch Family Home', 'Spacious suburban home with garden', '56 Fendalton Road, Christchurch 8041', 'residential', 2200, 4, 2.5, 2015, 0.25, 650000.00, '["/suburban-family-home.png"]', 'verified', FALSE),
('buy-prop-5', 'default-seller', 'Hamilton Modern Condo', 'Contemporary condo in city center', '90 Victoria Street, Hamilton 3204', 'residential', 1200, 2, 2.0, 2022, 0.00, 450000.00, '["/modern-condo-living-room.png"]', 'verified', TRUE),
('buy-prop-6', 'default-seller', 'Dunedin Heritage House', 'Restored Victorian home', '34 Princes Street, Dunedin 9016', 'residential', 1600, 3, 1.5, 1890, 0.00, 600000.00, '["/historic-villa.jpg"]', 'verified', FALSE),
('buy-prop-7', 'default-seller', 'Tauranga Beachfront', 'Direct beach access property', '12 Oceanview Road, Mount Maunganui, Tauranga 3118', 'residential', 2000, 3, 2.0, 2019, 0.10, 900000.00, '["/serene-lake-house.png"]', 'verified', TRUE),
('buy-prop-8', 'default-seller', 'Palmerston North Apartment', 'Central apartment with amenities', '45 Fitzherbert Avenue, Palmerston North 4410', 'residential', 900, 1, 1.0, 2021, 0.00, 350000.00, '["/modern-apartment-building.png"]', 'verified', FALSE),
('buy-prop-9', 'default-seller', 'Rotorua Lakeside Cabin', 'Cozy cabin by the lake', '78 Lake Road, Rotorua 3010', 'residential', 1400, 3, 2.0, 2017, 0.30, 550000.00, '["/mountain-cabin-retreat.png"]', 'verified', FALSE),
('buy-prop-10', 'default-seller', 'Napier Art Deco Home', 'Iconic Art Deco style house', '123 Tennyson Street, Napier 4110', 'residential', 1900, 3, 2.0, 1930, 0.00, 700000.00, '["/luxury-townhouse.png"]', 'verified', TRUE);

-- Create fixed_price listings for buy properties
INSERT IGNORE INTO listings (id, property_id, seller_id, listing_type, price, currency, start_time, status) VALUES
('buy-list-1', 'buy-prop-1', 'default-seller', 'fixed_price', 2.5, 'ETH', NOW(), 'active'),
('buy-list-2', 'buy-prop-2', 'default-seller', 'fixed_price', 5.2, 'ETH', NOW(), 'active'),
('buy-list-3', 'buy-prop-3', 'default-seller', 'fixed_price', 3.1, 'ETH', NOW(), 'active'),
('buy-list-4', 'buy-prop-4', 'default-seller', 'fixed_price', 1.8, 'ETH', NOW(), 'active'),
('buy-list-5', 'buy-prop-5', 'default-seller', 'fixed_price', 2.2, 'ETH', NOW(), 'active'),
('buy-list-6', 'buy-prop-6', 'default-seller', 'fixed_price', 2.0, 'ETH', NOW(), 'active'),
('buy-list-7', 'buy-prop-7', 'default-seller', 'fixed_price', 3.5, 'ETH', NOW(), 'active'),
('buy-list-8', 'buy-prop-8', 'default-seller', 'fixed_price', 1.5, 'ETH', NOW(), 'active'),
('buy-list-9', 'buy-prop-9', 'default-seller', 'fixed_price', 1.9, 'ETH', NOW(), 'active'),
('buy-list-10', 'buy-prop-10', 'default-seller', 'fixed_price', 2.8, 'ETH', NOW(), 'active');

-- Insert 10 Bid properties (auction listings)
INSERT IGNORE INTO properties (id, owner_id, title, description, address, property_type, square_footage, bedrooms, bathrooms, year_built, lot_size, assessed_value, images, verification_status, is_featured) VALUES
('bid-prop-1', 'default-seller', 'Urban Loft in Auckland', 'Industrial style loft with high ceilings', '56 Britomart Street, Auckland CBD', 'residential', 1500, 2, 2.0, 2010, 0.00, 750000.00, '["/urban-loft-space.png"]', 'verified', TRUE),
('bid-prop-2', 'default-seller', 'Mountain Retreat Wanaka', 'Secluded retreat with mountain views', '23 Cardrona Valley Road, Wanaka 9305', 'residential', 2800, 5, 3.0, 2016, 2.00, 1500000.00, '["/mountain-cabin-retreat.png"]', 'verified', FALSE),
('bid-prop-3', 'default-seller', 'Beach House Mount Maunganui', 'Prime beachfront location', '89 Marine Parade, Mount Maunganui 3118', 'residential', 2100, 4, 2.5, 2021, 0.15, 1100000.00, '["/luxury-beach-house.png"]', 'verified', TRUE),
('bid-prop-4', 'default-seller', 'Commercial Space Wellington', 'Retail space in busy area', '200 Lambton Quay, Wellington 6011', 'commercial', 3000, NULL, NULL, 2005, 0.00, 2000000.00, '["/modern-condo-exterior.png"]', 'verified', FALSE),
('bid-prop-5', 'default-seller', 'Land Plot Christchurch', 'Development land in growing suburb', 'Lot 45, Halswell Junction Road, Christchurch 8025', 'land', NULL, NULL, NULL, NULL, 1.50, 300000.00, '["/placeholder.jpg"]', 'verified', FALSE),
('bid-prop-6', 'default-seller', 'Luxury Condo Auckland', 'High-end condo with amenities', '12 Viaduct Harbour Avenue, Auckland 1010', 'residential', 1700, 3, 3.0, 2019, 0.00, 950000.00, '["/luxury-condo-interior.png"]', 'verified', TRUE),
('bid-prop-7', 'default-seller', 'Farm Land Waikato', 'Productive farmland with irrigation', '300 SH1, Te Awamutu 3800', 'land', NULL, NULL, NULL, NULL, 50.00, 800000.00, '["/placeholder.jpg"]', 'verified', FALSE),
('bid-prop-8', 'default-seller', 'Office Building Hamilton', 'Modern office space for lease/sale', '78 Anglesea Street, Hamilton 3204', 'commercial', 4000, NULL, NULL, 2018, 0.00, 2500000.00, '["/modern-condo-kitchen.png"]', 'verified', FALSE),
('bid-prop-9', 'default-seller', 'Villa in Nelson', 'Charming villa near beaches', '56 Nile Street, Nelson 7010', 'residential', 1300, 3, 1.5, 1950, 0.00, 650000.00, '["/suburban-family-home.png"]', 'verified', TRUE),
('bid-prop-10', 'default-seller', 'Industrial Warehouse Tauranga', 'Large warehouse with loading docks', '90 Maleme Street, Tauranga 3112', 'industrial', 10000, NULL, NULL, 2000, 1.00, 1800000.00, '["/placeholder.jpg"]', 'verified', FALSE);

-- Create auction listings for bid properties (duration 7 days)
INSERT IGNORE INTO listings (id, property_id, seller_id, listing_type, price, currency, start_time, end_time, status) VALUES
('bid-list-1', 'bid-prop-1', 'default-seller', 'auction', 1.0, 'ETH', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active'),
('bid-list-2', 'bid-prop-2', 'default-seller', 'auction', 3.0, 'ETH', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active'),
('bid-list-3', 'bid-prop-3', 'default-seller', 'auction', 4.0, 'ETH', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active'),
('bid-list-4', 'bid-prop-4', 'default-seller', 'auction', 2.5, 'ETH', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active'),
('bid-list-5', 'bid-prop-5', 'default-seller', 'auction', 0.5, 'ETH', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active'),
('bid-list-6', 'bid-prop-6', 'default-seller', 'auction', 3.5, 'ETH', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active'),
('bid-list-7', 'bid-prop-7', 'default-seller', 'auction', 1.2, 'ETH', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active'),
('bid-list-8', 'bid-prop-8', 'default-seller', 'auction', 2.0, 'ETH', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active'),
('bid-list-9', 'bid-prop-9', 'default-seller', 'auction', 1.8, 'ETH', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active'),
('bid-list-10', 'bid-prop-10', 'default-seller', 'auction', 2.5, 'ETH', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active');

-- Output confirmation
SELECT 'Seeding completed: 20 properties and 20 listings created' as message;

-- Update assessed_value for existing properties
UPDATE properties SET assessed_value = 500000.00 WHERE id = 'buy-prop-1';
UPDATE properties SET assessed_value = 1200000.00 WHERE id = 'buy-prop-2';
UPDATE properties SET assessed_value = 750000.00 WHERE id = 'buy-prop-3';
UPDATE properties SET assessed_value = 650000.00 WHERE id = 'buy-prop-4';
UPDATE properties SET assessed_value = 450000.00 WHERE id = 'buy-prop-5';
UPDATE properties SET assessed_value = 600000.00 WHERE id = 'buy-prop-6';
UPDATE properties SET assessed_value = 900000.00 WHERE id = 'buy-prop-7';
UPDATE properties SET assessed_value = 350000.00 WHERE id = 'buy-prop-8';
UPDATE properties SET assessed_value = 550000.00 WHERE id = 'buy-prop-9';
UPDATE properties SET assessed_value = 700000.00 WHERE id = 'buy-prop-10';
UPDATE properties SET assessed_value = 750000.00 WHERE id = 'bid-prop-1';
UPDATE properties SET assessed_value = 1500000.00 WHERE id = 'bid-prop-2';
UPDATE properties SET assessed_value = 1100000.00 WHERE id = 'bid-prop-3';
UPDATE properties SET assessed_value = 2000000.00 WHERE id = 'bid-prop-4';
UPDATE properties SET assessed_value = 300000.00 WHERE id = 'bid-prop-5';
UPDATE properties SET assessed_value = 950000.00 WHERE id = 'bid-prop-6';
UPDATE properties SET assessed_value = 800000.00 WHERE id = 'bid-prop-7';
UPDATE properties SET assessed_value = 2500000.00 WHERE id = 'bid-prop-8';
UPDATE properties SET assessed_value = 650000.00 WHERE id = 'bid-prop-9';
UPDATE properties SET assessed_value = 1800000.00 WHERE id = 'bid-prop-10';
`;

async function seedDatabase() {
  try {
    await connectDB();
    const statements = seedSQL.split(';').map(stmt => stmt.trim()).filter(stmt => stmt.length > 0);
    for (const stmt of statements) {
      await query(stmt);
    }
    console.log('Database seeded successfully with properties and listings.');
  } catch (error) {
    console.error('Seeding failed:', error);
  }
}

seedDatabase();