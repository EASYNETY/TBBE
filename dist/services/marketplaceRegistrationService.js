"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketplaceRegistrationService = exports.MarketplaceRegistrationService = void 0;
const ethers_1 = require("ethers");
const database_1 = require("../utils/database");
const ethersProvider_1 = require("../utils/ethersProvider");
class MarketplaceRegistrationService {
    constructor() {
        if (!process.env.BASE_RPC_URL) {
            throw new Error('BASE_RPC_URL environment variable is required');
        }
        if (!process.env.PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY environment variable is required');
        }
        if (!process.env.MARKETPLACE_GUARD_ADDRESS) {
            throw new Error('MARKETPLACE_GUARD_ADDRESS environment variable is required');
        }
        if (!process.env.USDC_ADDRESS) {
            throw new Error('USDC_ADDRESS environment variable is required');
        }
        if (!process.env.DNZD_ADDRESS) {
            throw new Error('DNZD_ADDRESS environment variable is required');
        }
        if (!process.env.DAUD_ADDRESS) {
            throw new Error('DAUD_ADDRESS environment variable is required');
        }
        this.provider = (0, ethersProvider_1.getProvider)();
        this.signer = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        // MarketplaceGuard contract ABI
        const marketplaceGuardAbi = [
            "function registerToken(uint256 tokenId, string memory projectId) external",
            "function registerPaymentToken(uint256 tokenId, address paymentToken) external",
            "function setPolicyFlags(uint256 tokenId, uint256 flags) external",
            "function isTokenRegistered(uint256 tokenId) external view returns (bool)",
            "function getTokenPolicy(uint256 tokenId) external view returns (uint256)",
            "event TokenRegistered(uint256 indexed tokenId, string projectId, address indexed registrar)",
            "event PaymentTokenRegistered(uint256 indexed tokenId, address indexed paymentToken)",
            "event PolicyFlagsSet(uint256 indexed tokenId, uint256 flags)"
        ];
        this.marketplaceGuardContract = new ethers_1.ethers.Contract(process.env.MARKETPLACE_GUARD_ADDRESS, marketplaceGuardAbi, this.signer);
    }
    async registerToken(tokenId, projectId) {
        try {
            console.log(`Registering token ${tokenId} with MarketplaceGuard...`);
            // Estimate gas for registration
            const estimatedGas = await this.marketplaceGuardContract.registerToken.estimateGas(tokenId, projectId);
            const tx = await this.marketplaceGuardContract.registerToken(tokenId, projectId, {
                gasLimit: estimatedGas * BigInt(120) / BigInt(100), // 20% buffer
            });
            console.log(`Registration transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();
            // Verify registration
            const isRegistered = await this.marketplaceGuardContract.isTokenRegistered(tokenId);
            if (!isRegistered) {
                throw new Error('Token registration verification failed');
            }
            // Update property status (idempotent operation)
            await (0, database_1.query)('UPDATE properties SET marketplace_registered = TRUE WHERE token_id = ? AND marketplace_registered = FALSE', [tokenId]);
            const result = {
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
            };
            console.log(`Token ${tokenId} registered successfully`);
            return result;
        }
        catch (error) {
            console.error('Token registration failed:', error);
            throw error;
        }
    }
    async registerPaymentToken(tokenId, paymentTokenAddress) {
        try {
            console.log(`Registering payment token ${paymentTokenAddress} for token ${tokenId}...`);
            const tx = await this.marketplaceGuardContract.registerPaymentToken(tokenId, paymentTokenAddress);
            const receipt = await tx.wait();
            console.log(`Payment token registered: ${receipt.hash}`);
            return {
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
            };
        }
        catch (error) {
            console.error('Payment token registration failed:', error);
            throw error;
        }
    }
    async setPolicyFlags(tokenId, flags) {
        try {
            console.log(`Setting policy flags ${flags} for token ${tokenId}...`);
            const tx = await this.marketplaceGuardContract.setPolicyFlags(tokenId, flags);
            const receipt = await tx.wait();
            console.log(`Policy flags set: ${receipt.hash}`);
            return {
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
            };
        }
        catch (error) {
            console.error('Policy flags setting failed:', error);
            throw error;
        }
    }
    async setupMarketplaceReadiness(tokenId, projectId) {
        try {
            // Register the token
            const registration = await this.registerToken(tokenId, projectId);
            // Register common payment tokens (USDC, project stablecoins)
            const paymentTokens = [];
            const paymentTokenAddresses = [
                process.env.USDC_ADDRESS,
                process.env.DNZD_ADDRESS, // New Zealand Dollar stablecoin
                process.env.DAUD_ADDRESS,
            ];
            for (const tokenAddress of paymentTokenAddresses) {
                if (tokenAddress) {
                    const result = await this.registerPaymentToken(tokenId, tokenAddress);
                    paymentTokens.push(result);
                }
            }
            // Set policy flags (bitmask for various permissions)
            // Bit 0: Fixed price sales enabled
            // Bit 1: Collection bids enabled
            // Bit 2: Reserve auctions enabled
            // Bit 3: Batch buys enabled
            const policyFlags = 15; // All enabled (1111 in binary)
            const flagsResult = await this.setPolicyFlags(tokenId, policyFlags);
            // Mark property as TRADE-READY
            await (0, database_1.query)('UPDATE properties SET status = "ACTIVE", trade_ready = TRUE WHERE token_id = ?', [tokenId]);
            return {
                registration,
                paymentTokens,
                policyFlags: flagsResult,
            };
        }
        catch (error) {
            console.error('Marketplace readiness setup failed:', error);
            throw error;
        }
    }
    async checkRegistrationStatus(tokenId) {
        try {
            const isRegistered = await this.marketplaceGuardContract.isTokenRegistered(tokenId);
            let policyFlags;
            if (isRegistered) {
                policyFlags = Number(await this.marketplaceGuardContract.getTokenPolicy(tokenId));
            }
            return { isRegistered, policyFlags };
        }
        catch (error) {
            console.error('Failed to check registration status:', error);
            throw error;
        }
    }
    async reRegisterToken(tokenId, projectId) {
        try {
            // Check if already registered
            const status = await this.checkRegistrationStatus(tokenId);
            if (status.isRegistered) {
                console.log(`Token ${tokenId} already registered, skipping...`);
                return {
                    transactionHash: 'already-registered',
                    blockNumber: 0,
                };
            }
            return this.registerToken(tokenId, projectId);
        }
        catch (error) {
            console.error('Re-registration failed:', error);
            throw error;
        }
    }
}
exports.MarketplaceRegistrationService = MarketplaceRegistrationService;
exports.marketplaceRegistrationService = new MarketplaceRegistrationService();
//# sourceMappingURL=marketplaceRegistrationService.js.map