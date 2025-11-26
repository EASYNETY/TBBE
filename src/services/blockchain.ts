import { ethers } from "ethers";
import TitleNFT_ABI from "../../artifacts/contracts/TitleNFT.sol/TitleNFT.json";

// --- Configuration from .env ---
const TITLE_NFT_ADDRESS = process.env.TITLE_NFT_ADDRESS || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

// --- Security Warning ---
// In a production environment, storing a raw private key in an .env file is not recommended.
// Consider using a more secure solution like a Key Management Service (KMS) or environment variables
// that are securely managed by your deployment platform.

if (!PRIVATE_KEY) {
  console.error("PRIVATE_KEY is not set in .env. Minting will not work.");
}
if (!TITLE_NFT_ADDRESS) {
  console.error("TITLE_NFT_ADDRESS is not set in .env. Minting will not work.");
}

const provider = new ethers.JsonRpcProvider(BASE_RPC_URL, { name: 'base', chainId: 8453 });
const wallet = new ethers.Wallet(PRIVATE_KEY);
const connectedWallet = wallet.connect(provider);

const titleNFTContract = new ethers.Contract(
  TITLE_NFT_ADDRESS,
  TitleNFT_ABI.abi,
  connectedWallet
);

export async function mintTitleNFT(
  toAddress: string,
  propertyId: string,
  legalDescription: string,
  assessedValue: number,
  jurisdiction: string,
  documentHash: string
): Promise<{ tokenId: string; transactionHash: string }> {
  if (!PRIVATE_KEY || !TITLE_NFT_ADDRESS) {
    throw new Error("Blockchain service not fully configured. Check .env variables.");
  }

  try {
    // Validate and normalize the address to prevent ENS resolution attempts
    let normalizedAddress: string;
    try {
      normalizedAddress = ethers.getAddress(toAddress);
    } catch (addressError) {
      throw new Error(`Invalid Ethereum address: ${toAddress}`);
    }

    // The mintTitle function on the smart contract
    // function mintTitle(
    //     address to,
    //     string memory propertyId,
    //     string memory legalDescription,
    //     uint256 assessedValue,
    //     string memory jurisdiction,
    //     bytes32 documentHash
    // ) public onlyRole(MINTER_ROLE) returns (uint256 tokenId)

    const tx = await titleNFTContract.mintTitle(
      normalizedAddress, // Use normalized address instead of toAddress
      propertyId,
      legalDescription,
      ethers.parseUnits(assessedValue.toString(), 0), // Assessed value as uint256
      jurisdiction,
      ethers.keccak256(ethers.toUtf8Bytes(documentHash)) // documentHash as bytes32
    );

    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      throw new Error("Transaction failed or was reverted.");
    }

    // Find the TitleMinted event to get the tokenId
    const iface = new ethers.Interface(TitleNFT_ABI.abi);
    let tokenId: string | undefined;

    for (const log of receipt.logs) {
      try {
        const parsedLog = iface.parseLog(log);
        if (parsedLog && parsedLog.name === "TitleMinted") {
          tokenId = parsedLog.args.tokenId.toString();
          break;
        }
      } catch (e) {
        // Not a log we're interested in, or parsing failed
      }
    }

    if (!tokenId) {
      throw new Error("Could not find TitleMinted event in transaction receipt.");
    }

    return {
      tokenId,
      transactionHash: receipt.hash,
    };
  } catch (error) {
    console.error("Error minting TitleNFT:", error);
    throw error;
  }
}