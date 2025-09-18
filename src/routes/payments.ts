import express from 'express';
import { query } from '../utils/database';

const router = express.Router();

// Public endpoint to get active payment options
router.get('/options', async (req, res) => {
  try {
    const options = await query('SELECT * FROM payment_options WHERE is_active = TRUE ORDER BY type, name');
    res.json({ paymentOptions: options });
  } catch (error) {
    console.error('Failed to fetch payment options:', error);
    res.status(500).json({ error: 'Failed to fetch payment options' });
  }
});

export default router;