import { ethers } from "ethers";

export function getProvider() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);

  const chainId = Number(process.env.CHAIN_ID || 31337);

  if (chainId !== 1 && chainId !== 8453) { // Not Ethereum mainnet or Base mainnet
    provider.getResolver = async () => null;
    provider.resolveName = async (name: string) => name;
  }

  return provider;
}
