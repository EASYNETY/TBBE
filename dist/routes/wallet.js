"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWalletRoutes = void 0;
const express_1 = __importDefault(require("express"));
const walletController_1 = require("../controllers/walletController");
const auth_1 = require("../middleware/auth");
const createWalletRoutes = (db) => {
    const router = express_1.default.Router();
    const walletController = new walletController_1.WalletController(db);
    // ========== Wallet Management ==========
    // Create wallet for authenticated user
    router.post('/create', auth_1.authenticateToken, (req, res) => walletController.createWallet(req, res));
    // Get user's wallet information
    router.get('/info', auth_1.authenticateToken, (req, res) => walletController.getWallet(req, res));
    // Get wallet balance
    router.get('/balance', auth_1.authenticateToken, (req, res) => walletController.getBalance(req, res));
    // Get wallet summary (balance, recent transactions, KYC status)
    router.get('/summary', auth_1.authenticateToken, (req, res) => walletController.getWalletSummary(req, res));
    // ========== Deposits ==========
    // Initiate a deposit (user sends USDC from external wallet)
    router.post('/deposit/initiate', auth_1.authenticateToken, (req, res) => walletController.initiateDeposit(req, res));
    // Confirm a deposit was received
    router.post('/deposit/confirm', auth_1.authenticateToken, (req, res) => walletController.confirmDeposit(req, res));
    // ========== Withdrawals ==========
    // Request a withdrawal (requires KYC if not verified)
    router.post('/withdraw/request', auth_1.authenticateToken, (req, res) => walletController.requestWithdrawal(req, res));
    // Admin: Approve a withdrawal
    router.post('/withdraw/approve', auth_1.authenticateToken, (req, res) => walletController.approveWithdrawal(req, res));
    // Admin: Reject a withdrawal
    router.post('/withdraw/reject', auth_1.authenticateToken, (req, res) => walletController.rejectWithdrawal(req, res));
    // ========== Transfers ==========
    // Transfer USDC between in-app wallets
    router.post('/transfer', auth_1.authenticateToken, (req, res) => walletController.transferBetweenWallets(req, res));
    // ========== History & Reports ==========
    // Get transaction history
    router.get('/transactions', auth_1.authenticateToken, (req, res) => walletController.getTransactionHistory(req, res));
    // Get transaction summary
    router.get('/transactions/summary', auth_1.authenticateToken, (req, res) => walletController.getTransactionSummary(req, res));
    // ========== External Wallet Withdrawal ==========
    // Withdraw to external wallet
    router.post('/withdraw-external', auth_1.authenticateToken, (req, res) => walletController.withdrawToExternalWallet(req, res));
    // Get withdrawal status
    router.get('/withdrawal/:withdrawalId', auth_1.authenticateToken, (req, res) => walletController.getWithdrawalStatus(req, res));
    // Get withdrawal limits
    router.get('/withdrawal-limits', auth_1.authenticateToken, (req, res) => walletController.getWithdrawalLimits(req, res));
    // Get withdrawal fees
    router.get('/withdrawal-fees', auth_1.authenticateToken, (req, res) => walletController.getWithdrawalFees(req, res));
    // ========== Wallet Linking ==========
    // Link external wallet
    router.post('/link-external', auth_1.authenticateToken, (req, res) => walletController.linkExternalWallet(req, res));
    // Get linked wallets
    router.get('/linked-wallets', auth_1.authenticateToken, (req, res) => walletController.getLinkedWallets(req, res));
    return router;
};
exports.createWalletRoutes = createWalletRoutes;
//# sourceMappingURL=wallet.js.map