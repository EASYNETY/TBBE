import express from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

  // Apply authentication and admin role check to all routes
  router.use(authenticateToken);
  router.use(requireRole(['admin', 'super-admin']));

  // Users routes
  router.get('/users', async (req: AuthRequest, res) => {
    try {
      const { page = '1', limit = '20' } = req.query;
      const pageNum = Number.parseInt(page as string);
      const limitNum = Number.parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const [users, countResult] = await Promise.all([
        query(`
          SELECT id, username, email, wallet_address, kyc_status, created_at
          FROM users
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `, [limitNum, offset]),
        query('SELECT COUNT(*) as total FROM users')
      ]);

      const total = countResult[0]?.total || 0;

      res.json({
        users: users.map((u: any) => ({
          ...u,
          wallet_address: u.wallet_address ? `${u.wallet_address.slice(0, 6)}...${u.wallet_address.slice(-4)}` : null,
          joinedAt: new Date(u.created_at).toISOString().split('T')[0],
          lastActive: u.last_login ? new Date(u.last_login).toISOString().split('T')[0] : null
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Properties routes
  router.get('/properties', async (req: AuthRequest, res) => {
    try {
      const { page = '1', limit = '20', status } = req.query;
      const pageNum = Number.parseInt(page as string);
      const limitNum = Number.parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let sqlQuery = `
        SELECT p.*, u.username as owner_username, u.wallet_address as owner_address
        FROM properties p
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status) {
        sqlQuery += " AND p.verification_status = ?";
        params.push(status);
      }

      sqlQuery += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
      params.push(limitNum, offset);

      const [properties, countResult] = await Promise.all([
        query(sqlQuery, params),
        query(`
          SELECT COUNT(*) as total FROM properties p
          WHERE 1=1 ${status ? 'AND p.verification_status = ?' : ''}
        `, status ? [status] : [])
      ]);

      const total = countResult[0]?.total || 0;

      res.json({
        properties: properties.map((p: any) => ({
          ...p,
          owner: p.owner_address ? `${p.owner_address.slice(0, 6)}...${p.owner_address.slice(-4)}` : p.owner_username,
          createdAt: new Date(p.created_at).toISOString().split('T')[0],
          images: p.images ? JSON.parse(p.images) : [],
          documents: p.documents ? JSON.parse(p.documents) : [],
          verification_documents: p.verification_documents ? JSON.parse(p.verification_documents) : []
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('Failed to fetch properties:', error);
      res.status(500).json({ error: 'Failed to fetch properties' });
    }
  });

  // Analytics routes
  router.get('/analytics', async (req: AuthRequest, res) => {
    try {
      const [totalUsers, activeProperties, pendingReviews, totalVolumeResult] = await Promise.all([
        query('SELECT COUNT(*) as count FROM users'),
        query('SELECT COUNT(*) as count FROM properties WHERE verification_status = "approved"'),
        query('SELECT COUNT(*) as count FROM properties WHERE verification_status = "pending"'),
        query('SELECT COALESCE(SUM(amount), 0) as total FROM payments')
      ]);

      res.json({
        stats: {
          totalUsers: totalUsers[0].count,
          activeProperties: activeProperties[0].count,
          totalVolume: `$${parseFloat(totalVolumeResult[0].total).toLocaleString()}`,
          pendingReviews: pendingReviews[0].count
        }
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // Distribution routes
  router.get('/distributions', (req: AuthRequest, res) => {
    res.json({ message: 'Distributions endpoint' });
  });

  router.post('/distributions/process', (req: AuthRequest, res) => {
    res.json({ message: 'Process distributions endpoint' });
  });

  router.get('/distributions/export', (req: AuthRequest, res) => {
    res.json({ message: 'Export distributions endpoint' });
  });

  // Activity routes
  router.get('/activity', async (req: AuthRequest, res) => {
    try {
      const [recentUsers, recentPayments, recentListings] = await Promise.all([
        query('SELECT username, wallet_address, created_at FROM users ORDER BY created_at DESC LIMIT 5'),
        query('SELECT amount, status, created_at FROM payments ORDER BY created_at DESC LIMIT 5'),
        query('SELECT l.property_title, l.created_at FROM listings l ORDER BY l.created_at DESC LIMIT 5'),
      ])

      const activities = [
        ...recentListings.map((l: any) => ({
          type: 'property',
          action: 'New property listed',
          details: l.property_title,
          time: new Date(l.created_at).toISOString(),
        })),
        ...recentUsers.map((u: any) => ({
          type: 'user',
          action: 'New user registered',
          details: u.username,
          time: new Date(u.created_at).toISOString(),
        })),
        ...recentPayments.map((p: any) => ({
          type: 'transaction',
          action: 'Transaction completed',
          details: `$${p.amount || 0}`,
          time: new Date(p.created_at).toISOString(),
        })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5)

      res.json({ activities })
    } catch (error) {
      console.error('Failed to fetch activity:', error)
      res.status(500).json({ error: 'Failed to fetch activity' })
    }
  })

  // Payment Options routes
  router.get('/payment-options', async (req: AuthRequest, res) => {
    try {
      const options = await query('SELECT * FROM payment_options ORDER BY created_at DESC');
      res.json({ paymentOptions: options });
    } catch (error) {
      console.error('Failed to fetch payment options:', error);
      res.status(500).json({ error: 'Failed to fetch payment options' });
    }
  })

  router.post('/payment-options', async (req: AuthRequest, res) => {
    try {
      const { name, type, currency, provider, fee_percentage, is_active, config } = req.body;
      if (!name || !type) {
        return res.status(400).json({ error: 'Name and type are required' });
      }
      const id = uuidv4();
      await query(
        'INSERT INTO payment_options (id, name, type, currency, provider, fee_percentage, is_active, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, name, type, currency || null, provider || null, fee_percentage || 0, is_active || false, JSON.stringify(config || {})]
      );
      res.status(201).json({ message: 'Payment option created successfully', id });
    } catch (error) {
      console.error('Failed to create payment option:', error);
      res.status(500).json({ error: 'Failed to create payment option' });
    }
  });

  router.put('/payment-options/:id', async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { name, type, currency, provider, fee_percentage, is_active, config } = req.body;
      if (!name || !type) {
        return res.status(400).json({ error: 'Name and type are required' });
      }
      await query(
        'UPDATE payment_options SET name = ?, type = ?, currency = ?, provider = ?, fee_percentage = ?, is_active = ?, config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, type, currency || null, provider || null, fee_percentage || 0, is_active || false, JSON.stringify(config || {}), id]
      );
      const updated = await query('SELECT * FROM payment_options WHERE id = ?', [id]);
      if (updated.length === 0) {
        return res.status(404).json({ error: 'Payment option not found' });
      }
      res.json({ message: 'Payment option updated successfully', option: updated[0] });
    } catch (error) {
      console.error('Failed to update payment option:', error);
      res.status(500).json({ error: 'Failed to update payment option' });
    }
  });

  // Settings routes
  router.get('/settings', async (req: AuthRequest, res) => {
    try {
      // Assume a settings table with a single row or use defaults
      const settingsResult = await query('SELECT * FROM platform_settings LIMIT 1');
      let settings = {
        platformName: 'TitleBase',
        maintenanceMode: false,
        newUserRegistration: true,
        kycRequired: true,
        emailNotifications: true,
        smsNotifications: false,
        marketplaceFee: '1.0',
        minimumInvestment: '100',
        maxPropertiesPerUser: '50',
        // Add more defaults as needed
      };

      if (settingsResult.length > 0) {
        settings = {
          ...settings,
          ...JSON.parse(settingsResult[0].config || '{}')
        };
      }

      res.json({ settings });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  router.put('/settings', async (req: AuthRequest, res) => {
    try {
      const settings = req.body;

      const [existing] = await query('SELECT * FROM platform_settings LIMIT 1');
      if (existing) {
        await query('UPDATE platform_settings SET config = ?, updated_at = CURRENT_TIMESTAMP', [JSON.stringify(settings)]);
      } else {
        const id = uuidv4();
        await query('INSERT INTO platform_settings (id, config) VALUES (?, ?)', [id, JSON.stringify(settings)]);
      }

      res.json({ message: 'Settings updated successfully', settings });
    } catch (error) {
      console.error('Failed to update settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // Property status update
  router.put('/properties/:id/status', async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const result = await query(
        'UPDATE properties SET verification_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Property not found' });
      }

      res.json({ message: `Property ${status} successfully`, status });
    } catch (error) {
      console.error('Failed to update property status:', error);
      res.status(500).json({ error: 'Failed to update property status' });
    }
  });

  // Property CRUD
  router.post('/properties', async (req: AuthRequest, res) => {
    try {
      const propertyData = req.body;
      const id = uuidv4();
      await query(
        'INSERT INTO properties (id, owner_id, title, description, address, property_type, square_footage, bedrooms, bathrooms, year_built, lot_size, images, documents, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending")',
        [id, propertyData.owner_id || null, propertyData.title, propertyData.description, propertyData.address, propertyData.property_type, propertyData.square_footage || null, propertyData.bedrooms || null, propertyData.bathrooms || null, propertyData.year_built || null, propertyData.lot_size || null, JSON.stringify(propertyData.images || []), JSON.stringify(propertyData.documents || [])]
      );
      res.status(201).json({ message: 'Property created successfully', id });
    } catch (error) {
      console.error('Failed to create property:', error);
      res.status(500).json({ error: 'Failed to create property' });
    }
  });

  router.put('/properties/:id', async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updateFields = Object.keys(updates).filter(key => key !== 'id' && updates[key] !== undefined);
      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      const values = updateFields.map(field => {
        if (['images', 'documents'].includes(field)) {
          return JSON.stringify(updates[field] || []);
        }
        return updates[field];
      });
      values.push(id);
      await query(`UPDATE properties SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
      res.json({ message: 'Property updated successfully' });
    } catch (error) {
      console.error('Failed to update property:', error);
      res.status(500).json({ error: 'Failed to update property' });
    }
  });

  router.delete('/properties/:id', async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const result = await query('DELETE FROM properties WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Property not found' });
      }
      res.json({ message: 'Property deleted successfully' });
    } catch (error) {
      console.error('Failed to delete property:', error);
      res.status(500).json({ error: 'Failed to delete property' });
    }
  });

  router.delete('/payment-options/:id', async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const result = await query('DELETE FROM payment_options WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Payment option not found' });
      }
      res.json({ message: 'Payment option deleted successfully' });
    } catch (error) {
      console.error('Failed to delete payment option:', error);
      res.status(500).json({ error: 'Failed to delete payment option' });
    }
  });

export default router;