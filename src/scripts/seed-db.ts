import { connectDB, query } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

async function seedData() {
  try {
    await connectDB();

    // Ensure default seller user exists
    const userId = 'default-seller';
    const walletAddress = '0x000000000000000000000000000000000000dead';
    const existingUser = await query('SELECT id FROM users WHERE id = ?', [userId]);
    if (existingUser.length === 0) {
      await query(
        'INSERT INTO users (id, wallet_address, username, role, permissions, is_active, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, walletAddress, 'Platform Admin', 'admin', JSON.stringify([]), true, 'admin@titlebase.com']
      );
      console.log('Default seller user created');
    }

    // Buy properties (fixed_price)
    const buyProperties = [
      { id: 'buy-prop-1', title: 'Modern Auckland Apartment', address: '123 Queen Street, Auckland CBD', price: 2.5, images: '["/modern-downtown-condo.png"]' },
      { id: 'buy-prop-2', title: 'Waterfront Villa in Queenstown', address: '45 Lake Esplanade, Queenstown', price: 5.2, images: '["/luxury-beach-house.png"]' },
      { id: 'buy-prop-3', title: 'Wellington Townhouse', address: '78 Oriental Parade, Wellington', price: 3.1, images: '["/historic-brownstone.png"]' },
      { id: 'buy-prop-4', title: 'Christchurch Family Home', address: '56 Fendalton Road, Christchurch', price: 1.8, images: '["/suburban-family-home.png"]' },
      { id: 'buy-prop-5', title: 'Hamilton Modern Condo', address: '90 Victoria Street, Hamilton', price: 2.2, images: '["/modern-condo-living-room.png"]' },
      { id: 'buy-prop-6', title: 'Dunedin Heritage House', address: '34 Princes Street, Dunedin', price: 2.0, images: '["/historic-villa.jpg"]' },
      { id: 'buy-prop-7', title: 'Tauranga Beachfront', address: '12 Oceanview Road, Mount Maunganui', price: 3.5, images: '["/serene-lake-house.png"]' },
      { id: 'buy-prop-8', title: 'Palmerston North Apartment', address: '45 Fitzherbert Avenue, Palmerston North', price: 1.5, images: '["/modern-apartment-building.png"]' },
      { id: 'buy-prop-9', title: 'Rotorua Lakeside Cabin', address: '78 Lake Road, Rotorua', price: 1.9, images: '["/mountain-cabin-retreat.png"]' },
      { id: 'buy-prop-10', title: 'Napier Art Deco Home', address: '123 Tennyson Street, Napier', price: 2.8, images: '["/luxury-townhouse.png"]' }
    ];

    for (const prop of buyProperties) {
      const existing = await query('SELECT id FROM properties WHERE id = ?', [prop.id]);
      if (existing.length === 0) {
        await query(
          'INSERT INTO properties (id, owner_id, title, description, address, property_type, square_footage, bedrooms, bathrooms, year_built, lot_size, images, verification_status) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?)',
          [prop.id, userId, prop.title, `Premium ${prop.title}`, prop.address, 'residential', prop.images, 'verified']
        );
        const listingId = uuidv4();
        await query(
          'INSERT INTO listings (id, property_id, seller_id, listing_type, price, currency, start_time, status) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)',
          [listingId, prop.id, userId, 'fixed_price', prop.price, 'ETH', 'active']
        );
        console.log(`Created buy property: ${prop.title}`);
      }
    }

    // Bid properties (auction)
    const bidProperties = [
      { id: 'bid-prop-1', title: 'Urban Loft in Auckland', address: '56 Britomart Street, Auckland CBD', price: 1.0, images: '["/urban-loft-space.png"]' },
      { id: 'bid-prop-2', title: 'Mountain Retreat Wanaka', address: '23 Cardrona Valley Road, Wanaka', price: 3.0, images: '["/mountain-cabin-retreat.png"]' },
      { id: 'bid-prop-3', title: 'Beach House Mount Maunganui', address: '89 Marine Parade, Mount Maunganui', price: 4.0, images: '["/luxury-beach-house.png"]' },
      { id: 'bid-prop-4', title: 'Commercial Space Wellington', address: '200 Lambton Quay, Wellington', price: 2.5, images: '["/modern-condo-exterior.png"]' },
      { id: 'bid-prop-5', title: 'Land Plot Christchurch', address: 'Lot 45, Halswell Junction Road, Christchurch', price: 0.5, images: '["/placeholder.jpg"]' },
      { id: 'bid-prop-6', title: 'Luxury Condo Auckland', address: '12 Viaduct Harbour Avenue, Auckland', price: 3.5, images: '["/luxury-condo-interior.png"]' },
      { id: 'bid-prop-7', title: 'Farm Land Waikato', address: '300 SH1, Te Awamutu', price: 1.2, images: '["/placeholder.jpg"]' },
      { id: 'bid-prop-8', title: 'Office Building Hamilton', address: '78 Anglesea Street, Hamilton', price: 2.0, images: '["/modern-condo-kitchen.png"]' },
      { id: 'bid-prop-9', title: 'Villa in Nelson', address: '56 Nile Street, Nelson', price: 1.8, images: '["/suburban-family-home.png"]' },
      { id: 'bid-prop-10', title: 'Industrial Warehouse Tauranga', address: '90 Maleme Street, Tauranga', price: 2.5, images: '["/placeholder.jpg"]' }
    ];

    for (const prop of bidProperties) {
      const existing = await query('SELECT id FROM properties WHERE id = ?', [prop.id]);
      if (existing.length === 0) {
        await query(
          'INSERT INTO properties (id, owner_id, title, description, address, property_type, square_footage, bedrooms, bathrooms, year_built, lot_size, images, verification_status) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?)',
          [prop.id, userId, prop.title, `Premium ${prop.title}`, prop.address, 'residential', prop.images, 'verified']
        );
        const listingId = uuidv4();
        const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await query(
          'INSERT INTO listings (id, property_id, seller_id, listing_type, price, currency, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)',
          [listingId, prop.id, userId, 'auction', prop.price, 'ETH', endTime, 'active']
        );
        console.log(`Created bid property: ${prop.title}`);
      }
    }

    console.log('Seeding completed: 20 properties and 20 listings created');
  } catch (error) {
    console.error('Seeding failed:', error);
  }
}

seedData();