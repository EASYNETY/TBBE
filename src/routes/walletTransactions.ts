import express from 'express';
import { Pool } from 'mysql2/promise';
import { WalletTransactionService } from '../services/walletTransactionService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

export const createWalletTransactionRoutes = (db: Pool) => {
  const router = express.Router();
  const transactionService = new WalletTransactionService(db);

  // ========== Transaction History & Reports ==========

  /**
   * GET /api/wallet/transactions
   * Get transaction history for authenticated user
   * Query params: limit, offset, type
   */
  router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const types = req.query.types ? (req.query.types as string).split(',') : undefined;

      const transactions = await transactionService.getTransactionHistory(
        req.user.id,
        limit,
        offset,
        types
      );

      return res.json({
        success: true,
        data: transactions,
        count: transactions.length,
        pagination: { limit, offset }
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  /**
   * GET /api/wallet/transactions/recent
   * Get recent transactions (last N days)
   * Query params: days (default: 30)
   */
  router.get('/recent', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const days = parseInt(req.query.days as string) || 30;

      const transactions = await transactionService.getRecentTransactions(req.user.id, days);

      return res.json({
        success: true,
        data: transactions,
        count: transactions.length,
        period: `${days} days`
      });
    } catch (error) {
      console.error('Get recent transactions error:', error);
      return res.status(500).json({ error: 'Failed to fetch recent transactions' });
    }
  });

  /**
   * GET /api/wallet/transactions/pending
   * Get pending transactions
   */
  router.get('/pending', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const transactions = await transactionService.getPendingTransactions(req.user.id);

      return res.json({
        success: true,
        data: transactions,
        count: transactions.length
      });
    } catch (error) {
      console.error('Get pending transactions error:', error);
      return res.status(500).json({ error: 'Failed to fetch pending transactions' });
    }
  });

  /**
   * GET /api/wallet/transactions/failed
   * Get failed transactions
   */
  router.get('/failed', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const transactions = await transactionService.getFailedTransactions(req.user.id);

      return res.json({
        success: true,
        data: transactions,
        count: transactions.length
      });
    } catch (error) {
      console.error('Get failed transactions error:', error);
      return res.status(500).json({ error: 'Failed to fetch failed transactions' });
    }
  });

  /**
   * GET /api/wallet/transactions/by-type/:type
   * Get transactions by type (deposit, withdrawal, transfer, etc.)
   */
  router.get('/by-type/:type', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { type } = req.params;
      const validTypes = ['deposit', 'withdrawal', 'transfer', 'roi_disbursement', 'subscription_payment', 'refund'];

      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      const transactions = await transactionService.getTransactionsByType(
        req.user.id,
        type as any
      );

      return res.json({
        success: true,
        data: transactions,
        count: transactions.length,
        type
      });
    } catch (error) {
      console.error('Get transactions by type error:', error);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  /**
   * GET /api/wallet/transactions/search
   * Search transactions
   * Query params: q (search query)
   */
  router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const query = req.query.q as string;

      if (!query || query.length < 2) {
        return res.status(400).json({
          error: 'Search query must be at least 2 characters'
        });
      }

      const transactions = await transactionService.searchTransactions(req.user.id, query);

      return res.json({
        success: true,
        data: transactions,
        count: transactions.length,
        query
      });
    } catch (error) {
      console.error('Search transactions error:', error);
      return res.status(500).json({ error: 'Failed to search transactions' });
    }
  });

  /**
   * GET /api/wallet/transactions/summary
   * Get transaction summary and statistics
   */
  router.get('/summary', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const summary = await transactionService.getTransactionSummary(req.user.id);

      return res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Get transaction summary error:', error);
      return res.status(500).json({ error: 'Failed to fetch transaction summary' });
    }
  });

  return router;
};
