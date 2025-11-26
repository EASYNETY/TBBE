"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProvider = getProvider;
const ethers_1 = require("ethers");
function getProvider() {
    const provider = new ethers_1.ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    const chainId = Number(process.env.CHAIN_ID || 31337);
    if (chainId !== 1 && chainId !== 8453) { // Not Ethereum mainnet or Base mainnet
        provider.getResolver = async () => null;
        provider.resolveName = async (name) => name;
    }
    return provider;
}
//# sourceMappingURL=ethersProvider.js.map