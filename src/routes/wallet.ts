import express from 'express';
import { Pool } from 'mysql2/promise';
import { WalletController } from '../controllers/walletController';
import { authenticateToken, AuthRequest } from '../middleware/auth';

export const createWalletRoutes = (db: Pool) => {
  const router = express.Router();
  const walletController = new WalletController(db);

  // ========== Wallet Management ==========

  // Create wallet for authenticated user
  router.post('/create', authenticateToken, (req: AuthRequest, res) =>
    walletController.createWallet(req, res)
  );

  // Get user's wallet information
  router.get('/info', authenticateToken, (req: AuthRequest, res) =>
    walletController.getWallet(req, res)
  );

  // Get wallet balance
  router.get('/balance', authenticateToken, (req: AuthRequest, res) =>
    walletController.getBalance(req, res)
  );

  // Get wallet summary (balance, recent transactions, KYC status)
  router.get('/summary', authenticateToken, (req: AuthRequest, res) =>
    walletController.getWalletSummary(req, res)
  );

  // ========== Deposits ==========

  // Initiate a deposit (user sends USDC from external wallet)
  router.post('/deposit/initiate', authenticateToken, (req: AuthRequest, res) =>
    walletController.initiateDeposit(req, res)
  );

  // Confirm a deposit was received
  router.post('/deposit/confirm', authenticateToken, (req: AuthRequest, res) =>
    walletController.confirmDeposit(req, res)
  );

  // ========== Withdrawals ==========

  // Request a withdrawal (requires KYC if not verified)
  router.post('/withdraw/request', authenticateToken, (req: AuthRequest, res) =>
    walletController.requestWithdrawal(req, res)
  );

  // Admin: Approve a withdrawal
  router.post('/withdraw/approve', authenticateToken, (req: AuthRequest, res) =>
    walletController.approveWithdrawal(req, res)
  );

  // Admin: Reject a withdrawal
  router.post('/withdraw/reject', authenticateToken, (req: AuthRequest, res) =>
    walletController.rejectWithdrawal(req, res)
  );

  // ========== Transfers ==========

  // Transfer USDC between in-app wallets
  router.post('/transfer', authenticateToken, (req: AuthRequest, res) =>
    walletController.transferBetweenWallets(req, res)
  );

  // ========== History & Reports ==========

  // Get transaction history
  router.get('/transactions', authenticateToken, (req: AuthRequest, res) =>
    walletController.getTransactionHistory(req, res)
  );

  // Get transaction summary
  router.get('/transactions/summary', authenticateToken, (req: AuthRequest, res) =>
    walletController.getTransactionSummary(req, res)
  );

  // ========== External Wallet Withdrawal ==========

  // Withdraw to external wallet
  router.post('/withdraw-external', authenticateToken, (req: AuthRequest, res) =>
    walletController.withdrawToExternalWallet(req, res)
  );

  // Get withdrawal status
  router.get('/withdrawal/:withdrawalId', authenticateToken, (req: AuthRequest, res) =>
    walletController.getWithdrawalStatus(req, res)
  );

  // Get withdrawal limits
  router.get('/withdrawal-limits', authenticateToken, (req: AuthRequest, res) =>
    walletController.getWithdrawalLimits(req, res)
  );

  // Get withdrawal fees
  router.get('/withdrawal-fees', authenticateToken, (req: AuthRequest, res) =>
    walletController.getWithdrawalFees(req, res)
  );

  // ========== Wallet Linking ==========

  // Link external wallet
  router.post('/link-external', authenticateToken, (req: AuthRequest, res) =>
    walletController.linkExternalWallet(req, res)
  );

  // Get linked wallets
  router.get('/linked-wallets', authenticateToken, (req: AuthRequest, res) =>
    walletController.getLinkedWallets(req, res)
  );

  return router;
};
