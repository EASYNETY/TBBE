"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountLinkingService = void 0;
const accountLinkingModel_1 = require("../models/accountLinkingModel");
class AccountLinkingService {
    constructor(pool) {
        this.pool = pool;
        this.VERIFICATION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
        this.model = new accountLinkingModel_1.AccountLinkingModel(pool);
    }
    async initiateAccountLink(request) {
        // Validate inputs
        if (!this.isValidSmartAccountAddress(request.smartAccountAddress)) {
            throw new Error('Invalid smart account address format');
        }
        if (!this.isValidWalletAddress(request.walletAddress)) {
            throw new Error('Invalid wallet address format');
        }
        // Check if wallet is already linked to another account
        const existingLink = await this.model.getLinkByWalletAddress(request.walletAddress);
        if (existingLink && existingLink.user_id !== request.userId) {
            throw new Error('Wallet is already linked to another account');
        }
        // Check if smart account is already linked to another user
        const existingSmartAccountLink = await this.model.getLinkBySmartAccount(request.smartAccountAddress);
        if (existingSmartAccountLink && existingSmartAccountLink.user_id !== request.userId) {
            throw new Error('Smart account is already linked to another user');
        }
        // If user has no primary link, this should be primary
        const isPrimary = request.isPrimary !== false;
        const existingLinks = await this.model.getLinksByUserId(request.userId);
        const link = await this.model.linkWalletToAccount(request.userId, request.smartAccountAddress, request.walletAddress, isPrimary || existingLinks.length === 0);
        return {
            linkId: link.id,
            verificationCode: link.verification_code || '',
            status: 'pending_verification',
            expiresIn: Math.floor(this.VERIFICATION_TIMEOUT / 1000)
        };
    }
    async verifyAndActivateLink(linkId, verificationCode) {
        const link = await this.model.getLinkById(linkId);
        if (!link) {
            throw new Error('Account link not found');
        }
        if (link.status === 'active') {
            throw new Error('Link is already active');
        }
        const isVerified = await this.model.verifyLink(linkId, verificationCode);
        if (!isVerified) {
            throw new Error('Invalid verification code');
        }
        // Record history
        await this.model.recordLinkingHistory(linkId, 'account_verified', link.user_id, undefined, undefined, 'success');
        const verifiedLink = await this.model.getLinkById(linkId);
        if (!verifiedLink)
            throw new Error('Failed to verify link');
        return this.formatLinkedAccount(verifiedLink);
    }
    async getLinkedAccounts(userId) {
        const links = await this.model.getLinksByUserId(userId);
        return links.map(link => this.formatLinkedAccount(link));
    }
    async getPrimaryAccount(userId) {
        const link = await this.model.getPrimaryLink(userId);
        if (!link)
            return null;
        return this.formatLinkedAccount(link);
    }
    async setPrimaryAccount(userId, linkId) {
        const link = await this.model.getLinkById(linkId);
        if (!link || link.user_id !== userId) {
            throw new Error('Unauthorized or link not found');
        }
        if (link.status !== 'active') {
            throw new Error('Can only set active links as primary');
        }
        await this.model.setPrimaryLink(userId, linkId);
        // Record history
        await this.model.recordLinkingHistory(linkId, 'set_as_primary', userId, undefined, undefined, 'success');
        const updatedLink = await this.model.getLinkById(linkId);
        if (!updatedLink)
            throw new Error('Failed to update link');
        return this.formatLinkedAccount(updatedLink);
    }
    async unlinkAccount(userId, linkId) {
        const link = await this.model.getLinkById(linkId);
        if (!link || link.user_id !== userId) {
            throw new Error('Unauthorized or link not found');
        }
        // Cannot unlink if it's the only active link
        const activeLinks = await this.model.getLinksByUserId(userId);
        const activeCount = activeLinks.filter(l => l.status === 'active').length;
        if (activeCount <= 1) {
            throw new Error('Cannot unlink your only active account');
        }
        await this.model.deactivateLink(linkId);
        // Record history
        await this.model.recordLinkingHistory(linkId, 'account_unlinked', userId, undefined, undefined, 'success');
    }
    async resendVerificationCode(linkId) {
        const link = await this.model.getLinkById(linkId);
        if (!link) {
            throw new Error('Account link not found');
        }
        if (link.status === 'active') {
            throw new Error('Link is already verified');
        }
        // Generate new code - in real implementation, update the database
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        return {
            verificationCode: newCode,
            expiresIn: Math.floor(this.VERIFICATION_TIMEOUT / 1000)
        };
    }
    async validateAccountLink(smartAccountAddress) {
        const link = await this.model.getLinkBySmartAccount(smartAccountAddress);
        if (!link)
            return null;
        return this.formatLinkedAccount(link);
    }
    async isWalletLinked(walletAddress) {
        const link = await this.model.getLinkByWalletAddress(walletAddress);
        return link !== null && link.status === 'active';
    }
    async getLinkingAuditTrail(linkId, limit = 100) {
        return this.model.getLinkingHistory(linkId, limit);
    }
    formatLinkedAccount(link) {
        return {
            id: link.id,
            smartAccountAddress: link.smart_account_address,
            walletAddress: link.wallet_address,
            isPrimary: link.is_primary === 1 || link.is_primary === true,
            status: link.status,
            verifiedAt: link.verified_at || null,
            linkedAt: link.created_at
        };
    }
    isValidSmartAccountAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    isValidWalletAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
}
exports.AccountLinkingService = AccountLinkingService;
//# sourceMappingURL=accountLinkingService.js.map