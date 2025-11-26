"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KYCWalletService = void 0;
const uuid_1 = require("uuid");
const walletModel_1 = require("../models/walletModel");
class KYCWalletService {
    constructor(pool) {
        this.pool = pool;
        this.walletModel = new walletModel_1.WalletModel(pool);
        this.kycProvider = {
            name: process.env.KYC_PROVIDER || 'mock',
            apiKey: process.env.KYC_API_KEY,
            apiSecret: process.env.KYC_API_SECRET,
            webhookSecret: process.env.KYC_WEBHOOK_SECRET
        };
    }
    /**
     * Initialize KYC verification for a user
     */
    async initiateKYCVerification(userId) {
        try {
            // Check if user already has pending verification
            const existingKYC = await this.walletModel.getKYCByUserId(userId);
            if (existingKYC && existingKYC.status === 'pending') {
                return {
                    verificationId: existingKYC.id,
                    status: 'already_pending'
                };
            }
            // Get or create user wallet
            const wallet = await this.getOrCreateUserWallet(userId);
            // Create KYC verification record
            const verification = await this.walletModel.createKYCVerification(userId, this.kycProvider.name, (0, uuid_1.v4)());
            let kycUrl;
            // Route to appropriate provider
            switch (this.kycProvider.name) {
                case 'sumsub':
                    kycUrl = await this.initiateSumsubVerification(userId, wallet.wallet_address, verification.id);
                    break;
                case 'blockpass':
                    kycUrl = await this.initiateBlockpassVerification(userId, verification.id);
                    break;
                case 'persona':
                    kycUrl = await this.initiatePersonaVerification(userId, verification.id);
                    break;
                case 'mock':
                default:
                    kycUrl = await this.initiateMockKYCVerification(userId, verification.id);
                    break;
            }
            return {
                verificationId: verification.id,
                kycUrl,
                status: 'initiated'
            };
        }
        catch (error) {
            console.error('KYC initiation error:', error);
            throw new Error(`Failed to initiate KYC: ${error.message}`);
        }
    }
    /**
     * Mock KYC Provider (for testing)
     */
    async initiateMockKYCVerification(userId, verificationId) {
        return `${process.env.FRONTEND_URL}/kyc/mock/${verificationId}`;
    }
    /**
     * Complete mock KYC verification (for testing)
     */
    async completeMockKYCVerification(userId, verificationId, kycData) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            // Update KYC verification
            await this.walletModel.updateKYCStatus(verificationId, 'approved', kycData);
            // Mark wallet as KYC verified
            const wallet = await this.walletModel.getWalletByUserId(userId);
            if (wallet) {
                await this.walletModel.markKYCVerified(userId, wallet.id);
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Sumsub Integration
     */
    async initiateSumsubVerification(userId, walletAddress, verificationId) {
        try {
            const applicantId = (0, uuid_1.v4)();
            return `https://sumsub.com/kyc/${applicantId}`;
        }
        catch (error) {
            throw new Error('Failed to initiate Sumsub verification');
        }
    }
    /**
     * Blockpass Integration
     */
    async initiateBlockpassVerification(userId, verificationId) {
        try {
            return `https://blockpass.org/kyc/${verificationId}`;
        }
        catch (error) {
            throw new Error('Failed to initiate Blockpass verification');
        }
    }
    /**
     * Persona Integration
     */
    async initiatePersonaVerification(userId, verificationId) {
        try {
            return `https://persona.com/kyc/${verificationId}`;
        }
        catch (error) {
            throw new Error('Failed to initiate Persona verification');
        }
    }
    /**
     * Get KYC verification status for user
     */
    async getKYCStatus(userId) {
        const kyc = await this.walletModel.getKYCByUserId(userId);
        const wallet = await this.walletModel.getWalletByUserId(userId);
        return {
            status: kyc?.status || 'pending',
            isVerified: wallet?.kyc_status === 'verified',
            verificationDate: kyc?.verification_date || undefined,
            expiryDate: kyc?.expiry_date || undefined
        };
    }
    /**
     * Get detailed KYC information for user
     */
    async getKYCDetails(userId) {
        const kyc = await this.walletModel.getKYCByUserId(userId);
        if (!kyc)
            return null;
        return {
            id: kyc.id,
            userId: kyc.user_id,
            provider: kyc.provider,
            status: kyc.status,
            kycData: kyc.kyc_data ? JSON.parse(kyc.kyc_data) : null,
            verificationDate: kyc.verification_date,
            expiryDate: kyc.expiry_date,
            rejectionReason: kyc.rejection_reason,
            createdAt: kyc.created_at,
            updatedAt: kyc.updated_at
        };
    }
    /**
     * Check if user is KYC verified
     */
    async isKYCVerified(userId) {
        const wallet = await this.walletModel.getWalletByUserId(userId);
        return wallet?.kyc_status === 'verified' || false;
    }
    /**
     * Verify KYC submission (for mock provider)
     */
    async verifyKYCSubmission(userId, kycData) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const wallet = await this.walletModel.getWalletByUserId(userId);
            if (!wallet) {
                throw new Error('Wallet not found for user');
            }
            // Get existing KYC verification or create new one
            let kyc = await this.walletModel.getKYCByUserId(userId);
            if (!kyc) {
                kyc = await this.walletModel.createKYCVerification(userId, 'mock', (0, uuid_1.v4)());
            }
            // Update KYC status
            await this.walletModel.updateKYCStatus(kyc.id, 'approved', kycData);
            // Mark wallet as KYC verified
            await this.walletModel.markKYCVerified(userId, wallet.id);
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Reject KYC submission (admin action)
     */
    async rejectKYCSubmission(userId, reason) {
        const kyc = await this.walletModel.getKYCByUserId(userId);
        if (!kyc) {
            throw new Error('KYC verification not found');
        }
        await this.walletModel.updateKYCStatus(kyc.id, 'rejected', undefined, reason);
    }
    /**
     * Handle KYC webhook from provider
     */
    async handleKYCWebhook(provider, payload) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            switch (provider) {
                case 'sumsub':
                    await this.handleSumsubWebhook(payload, connection);
                    break;
                case 'blockpass':
                    await this.handleBlockpassWebhook(payload, connection);
                    break;
                case 'persona':
                    await this.handlePersonaWebhook(payload, connection);
                    break;
                default:
                    throw new Error(`Unknown KYC provider: ${provider}`);
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Handle Sumsub webhook
     */
    async handleSumsubWebhook(payload, connection) {
        console.log('Handling Sumsub webhook:', payload);
    }
    /**
     * Handle Blockpass webhook
     */
    async handleBlockpassWebhook(payload, connection) {
        console.log('Handling Blockpass webhook:', payload);
    }
    /**
     * Handle Persona webhook
     */
    async handlePersonaWebhook(payload, connection) {
        console.log('Handling Persona webhook:', payload);
    }
    /**
     * Get or create user wallet if it doesn't exist
     */
    async getOrCreateUserWallet(userId) {
        let wallet = await this.walletModel.getWalletByUserId(userId);
        if (!wallet) {
            const { ethers } = await Promise.resolve().then(() => __importStar(require('ethers')));
            const newWallet = ethers.Wallet.createRandom();
            wallet = await this.walletModel.createWallet(userId, newWallet.address);
        }
        return wallet;
    }
}
exports.KYCWalletService = KYCWalletService;
//# sourceMappingURL=kycWalletService.js.map