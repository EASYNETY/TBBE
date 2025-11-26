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
exports.distributionService = exports.DistributionService = void 0;
const ethers_1 = require("ethers");
const database_1 = require("../utils/database");
const tbaService_1 = require("./tbaService");
const distributionModel_1 = require("../models/distributionModel");
const ethersProvider_1 = require("../utils/ethersProvider");
class DistributionService {
    constructor() {
        this.provider = (0, ethersProvider_1.getProvider)();
        this.signer = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    }
    async distributeInitialShares(propertyId, tokenId) {
        try {
            // Get property details
            const property = await (0, database_1.query)('SELECT * FROM properties WHERE id = ?', [propertyId]);
            if (!property || property.length === 0) {
                throw new Error(`Property ${propertyId} not found`);
            }
            const prop = property[0];
            if (!prop.fractional || prop.supply <= 1) {
                console.log(`Property ${propertyId} is not fractional, skipping initial distribution`);
                return;
            }
            // Default distribution: 100% to owner initially
            const owner = await (0, database_1.query)('SELECT id, wallet_address FROM users WHERE id = ?', [prop.user_id]);
            if (!owner || owner.length === 0) {
                throw new Error(`Owner not found for property ${propertyId}`);
            }
            const distributionRequest = {
                propertyId,
                tokenId,
                amount: prop.supply.toString(),
                currency: 'SHARES',
                type: 'INITIAL',
                receivers: [{
                        address: owner[0].wallet_address,
                        userId: owner[0].id,
                        amount: prop.supply.toString(),
                    }],
            };
            await this.createDistribution(distributionRequest);
            // Record shareholders
            await this.recordShareholder({
                propertyId,
                tokenId,
                userId: owner[0].id,
                walletAddress: owner[0].wallet_address,
                sharesOwned: prop.supply,
                percentageOwned: 100.0,
                kycVerified: false, // Would be checked separately
            });
        }
        catch (error) {
            console.error('Initial share distribution failed:', error);
            throw error;
        }
    }
    async distributeYieldToTBA(tokenId, amount, currency) {
        try {
            // Get TBA address
            const property = await (0, database_1.query)('SELECT tba_address FROM properties WHERE token_id = ?', [tokenId]);
            if (!property || property.length === 0 || !property[0].tba_address) {
                throw new Error(`TBA not found for token ${tokenId}`);
            }
            const tbaAddress = property[0].tba_address;
            // Get token contract address
            const tokenAddress = this.getTokenAddress(currency);
            if (!tokenAddress) {
                throw new Error(`Unsupported currency: ${currency}`);
            }
            // Transfer tokens to TBA (assuming we have tokens to distribute)
            // In practice, this would be done by the revenue collection system
            const tokenContract = new ethers_1.ethers.Contract(tokenAddress, ["function transfer(address to, uint256 amount) external returns (bool)"], this.signer);
            const tx = await tokenContract.transfer(tbaAddress, ethers_1.ethers.parseEther(amount));
            const receipt = await tx.wait();
            // Record the distribution
            const distributionRequest = {
                propertyId: property[0].id,
                tokenId,
                amount,
                currency,
                type: 'YIELD',
                receivers: [{
                        address: tbaAddress,
                        amount,
                    }],
            };
            await this.createDistribution(distributionRequest);
            console.log(`Yield distributed to TBA: ${receipt.hash}`);
            return receipt.hash;
        }
        catch (error) {
            console.error('Yield distribution to TBA failed:', error);
            throw error;
        }
    }
    async distributeYield(tokenId) {
        try {
            // Get TBA balance for each supported currency
            const property = await (0, database_1.query)('SELECT id, tba_address FROM properties WHERE token_id = ?', [tokenId]);
            if (!property || property.length === 0 || !property[0].tba_address) {
                throw new Error(`TBA not found for token ${tokenId}`);
            }
            const tbaAddress = property[0].tba_address;
            const propertyId = property[0].id;
            // Get shareholders
            const shareholders = await this.getShareholders(propertyId);
            const currencies = ['USDC', 'dNZD', 'dAUD'];
            for (const currency of currencies) {
                const tokenAddress = this.getTokenAddress(currency);
                if (!tokenAddress)
                    continue;
                const balance = await tbaService_1.tbaService.getTBABalance(tbaAddress, tokenAddress);
                if (parseFloat(balance) <= 0)
                    continue;
                // Distribute proportionally to shareholders
                const totalShares = shareholders.reduce((sum, sh) => sum + sh.sharesOwned, 0);
                for (const shareholder of shareholders) {
                    const shareAmount = (parseFloat(balance) * shareholder.sharesOwned) / totalShares;
                    if (shareAmount > 0) {
                        // Generate voucher for withdrawal
                        const { voucher, signature } = await tbaService_1.tbaService.generateWithdrawalVoucher(tbaAddress, shareholder.walletAddress, shareAmount.toString(), tokenAddress);
                        // Record distribution
                        const distributionRequest = {
                            propertyId,
                            tokenId,
                            amount: shareAmount.toString(),
                            currency,
                            type: 'YIELD',
                            receivers: [{
                                    address: shareholder.walletAddress,
                                    userId: shareholder.userId,
                                    amount: shareAmount.toString(),
                                }],
                            distributionData: { voucher, signature },
                        };
                        await this.createDistribution(distributionRequest);
                    }
                }
            }
        }
        catch (error) {
            console.error('Yield distribution failed:', error);
            throw error;
        }
    }
    async airdropShares(propertyId, receivers) {
        try {
            const property = await (0, database_1.query)('SELECT token_id, supply FROM properties WHERE id = ?', [propertyId]);
            if (!property || property.length === 0) {
                throw new Error(`Property ${propertyId} not found`);
            }
            const tokenId = property[0].token_id;
            for (const receiver of receivers) {
                const distributionRequest = {
                    propertyId,
                    tokenId,
                    amount: receiver.amount.toString(),
                    currency: 'SHARES',
                    type: 'AIRDROP',
                    receivers: [{
                            address: receiver.address,
                            amount: receiver.amount.toString(),
                        }],
                };
                await this.createDistribution(distributionRequest);
                // Update shareholder records
                await this.recordShareholder({
                    propertyId,
                    tokenId,
                    userId: '', // Would need to resolve from address
                    walletAddress: receiver.address,
                    sharesOwned: receiver.amount,
                    percentageOwned: (receiver.amount / property[0].supply) * 100,
                    kycVerified: false,
                });
            }
        }
        catch (error) {
            console.error('Airdrop failed:', error);
            throw error;
        }
    }
    async lockReservedShares(propertyId, lockDuration) {
        try {
            // Implementation for locking reserved shares (advisors, treasury, etc.)
            // This would typically involve vesting schedules
            console.log(`Locking reserved shares for property ${propertyId} for ${lockDuration} seconds`);
            // Implementation details would depend on the vesting contract
        }
        catch (error) {
            console.error('Locking reserved shares failed:', error);
            throw error;
        }
    }
    async createDistribution(request) {
        const { v4: uuidv4 } = await Promise.resolve().then(() => __importStar(require('uuid')));
        for (const receiver of request.receivers) {
            const distributionId = uuidv4();
            await (0, database_1.query)(distributionModel_1.distributionQueries.insert, [
                distributionId,
                request.propertyId,
                request.tokenId || null,
                receiver.amount,
                request.currency,
                request.type,
                'PENDING',
                receiver.address,
                receiver.userId || null,
                request.distributionData || null,
            ]);
        }
    }
    async recordShareholder(shareholder) {
        const { v4: uuidv4 } = await Promise.resolve().then(() => __importStar(require('uuid')));
        await (0, database_1.query)(distributionModel_1.shareholderQueries.insert, [
            uuidv4(),
            shareholder.propertyId,
            shareholder.tokenId || null,
            shareholder.userId,
            shareholder.walletAddress,
            shareholder.sharesOwned,
            shareholder.percentageOwned,
            new Date(),
            null, // acquisition_price
            null, // vesting_schedule
            shareholder.kycVerified,
        ]);
    }
    async getShareholders(propertyId) {
        const shareholders = await (0, database_1.query)(distributionModel_1.shareholderQueries.findByPropertyId, [propertyId]);
        return shareholders.map((sh) => ({
            userId: sh.user_id,
            walletAddress: sh.wallet_address,
            sharesOwned: Number(sh.shares_owned),
            percentageOwned: Number(sh.percentage_owned),
            kycVerified: sh.kyc_verified,
        }));
    }
    getTokenAddress(currency) {
        const addresses = {
            'USDC': process.env.USDC_ADDRESS,
            'dNZD': process.env.DNZD_ADDRESS,
            'dAUD': process.env.DAUD_ADDRESS,
        };
        return addresses[currency] || null;
    }
    async recordDistributionEvent(propertyId, tokenId, amount, type, txHash, receivers) {
        // Update distribution status to EXECUTED
        for (const receiver of receivers) {
            await (0, database_1.query)(`UPDATE distributions SET status = 'EXECUTED', executed_at = CURRENT_TIMESTAMP, tx_hash = ? WHERE property_id = ? AND receiver_address = ? AND amount = ? AND type = ?`, [txHash, propertyId, receiver.address, receiver.amount, type]);
        }
    }
}
exports.DistributionService = DistributionService;
exports.distributionService = new DistributionService();
//# sourceMappingURL=distributionService.js.map