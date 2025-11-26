import express from 'express';
import { Pool } from 'mysql2/promise';
import { AccountLinkingService } from '../services/accountLinkingService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

export const createAccountLinkingRoutes = (db: Pool) => {
  const router = express.Router();
  const linkingService = new AccountLinkingService(db);

  // ========== Account Linking Endpoints ==========

  /**
   * POST /api/account-linking/initiate
   * Initiate account linking process
   * Requires: smartAccountAddress, walletAddress
   * Returns: linkId, verificationCode, expiresIn
   */
  router.post('/initiate', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { smartAccountAddress, walletAddress, isPrimary } = req.body;

      if (!smartAccountAddress || !walletAddress) {
        return res.status(400).json({
          error: 'smartAccountAddress and walletAddress are required'
        });
      }

      const result = await linkingService.initiateAccountLink({
        userId: req.user.id,
        smartAccountAddress,
        walletAddress,
        isPrimary
      });

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Account linking initiated. Please verify the code.'
      });
    } catch (error) {
      console.error('Account linking initiation error:', error);
      const message = error instanceof Error ? error.message : 'Failed to initiate account linking';
      return res.status(400).json({ error: message });
    }
  });

  /**
   * POST /api/account-linking/verify
   * Verify and activate account link
   * Requires: linkId, verificationCode
   */
  router.post('/verify', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { linkId, verificationCode } = req.body;

      if (!linkId || !verificationCode) {
        return res.status(400).json({
          error: 'linkId and verificationCode are required'
        });
      }

      const result = await linkingService.verifyAndActivateLink(linkId, verificationCode);

      return res.json({
        success: true,
        data: result,
        message: 'Account linked successfully'
      });
    } catch (error) {
      console.error('Account linking verification error:', error);
      const message = error instanceof Error ? error.message : 'Verification failed';
      return res.status(400).json({ error: message });
    }
  });

  /**
   * GET /api/account-linking/list
   * Get all linked accounts for user
   */
  router.get('/list', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const accounts = await linkingService.getLinkedAccounts(req.user.id);

      return res.json({
        success: true,
        data: accounts,
        count: accounts.length
      });
    } catch (error) {
      console.error('Get linked accounts error:', error);
      return res.status(500).json({ error: 'Failed to fetch linked accounts' });
    }
  });

  /**
   * GET /api/account-linking/primary
   * Get primary linked account
   */
  router.get('/primary', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const primaryAccount = await linkingService.getPrimaryAccount(req.user.id);

      if (!primaryAccount) {
        return res.status(404).json({
          error: 'No primary account linked',
          data: null
        });
      }

      return res.json({
        success: true,
        data: primaryAccount
      });
    } catch (error) {
      console.error('Get primary account error:', error);
      return res.status(500).json({ error: 'Failed to fetch primary account' });
    }
  });

  /**
   * POST /api/account-linking/set-primary
   * Set a linked account as primary
   * Requires: linkId
   */
  router.post('/set-primary', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { linkId } = req.body;

      if (!linkId) {
        return res.status(400).json({ error: 'linkId is required' });
      }

      const result = await linkingService.setPrimaryAccount(req.user.id, linkId);

      return res.json({
        success: true,
        data: result,
        message: 'Primary account updated successfully'
      });
    } catch (error) {
      console.error('Set primary account error:', error);
      const message = error instanceof Error ? error.message : 'Failed to set primary account';
      return res.status(400).json({ error: message });
    }
  });

  /**
   * POST /api/account-linking/unlink
   * Unlink a connected account
   * Requires: linkId
   */
  router.post('/unlink', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { linkId } = req.body;

      if (!linkId) {
        return res.status(400).json({ error: 'linkId is required' });
      }

      await linkingService.unlinkAccount(req.user.id, linkId);

      return res.json({
        success: true,
        message: 'Account unlinked successfully'
      });
    } catch (error) {
      console.error('Unlink account error:', error);
      const message = error instanceof Error ? error.message : 'Failed to unlink account';
      return res.status(400).json({ error: message });
    }
  });

  /**
   * POST /api/account-linking/resend-code
   * Resend verification code
   * Requires: linkId
   */
  router.post('/resend-code', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { linkId } = req.body;

      if (!linkId) {
        return res.status(400).json({ error: 'linkId is required' });
      }

      const result = await linkingService.resendVerificationCode(linkId);

      return res.json({
        success: true,
        data: result,
        message: 'Verification code resent'
      });
    } catch (error) {
      console.error('Resend code error:', error);
      const message = error instanceof Error ? error.message : 'Failed to resend code';
      return res.status(400).json({ error: message });
    }
  });

  /**
   * GET /api/account-linking/audit/:linkId
   * Get audit trail for a linked account
   */
  router.get('/audit/:linkId', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { linkId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      const auditTrail = await linkingService.getLinkingAuditTrail(linkId, limit);

      return res.json({
        success: true,
        data: auditTrail,
        count: auditTrail.length
      });
    } catch (error) {
      console.error('Get audit trail error:', error);
      return res.status(500).json({ error: 'Failed to fetch audit trail' });
    }
  });

  /**
   * GET /api/account-linking/validate/:smartAccountAddress
   * Validate if smart account is linked
   * Public endpoint (no auth required)
   */
  router.get('/validate/:smartAccountAddress', async (req, res) => {
    try {
      const { smartAccountAddress } = req.params;

      const account = await linkingService.validateAccountLink(smartAccountAddress);

      return res.json({
        success: true,
        isLinked: account !== null,
        data: account
      });
    } catch (error) {
      console.error('Validate account link error:', error);
      return res.status(500).json({ error: 'Failed to validate account link' });
    }
  });

  return router;
};
