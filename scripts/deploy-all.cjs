// scripts/deploy-all.cjs
require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  const isLocal = (process.env.NETWORK === "localhost") || (process.env.HARDHAT_NETWORK === "localhost") || (!process.env.BASE_RPC_URL && !process.env.BASE_SEPOLIA_RPC_URL);

  // provider — prefer explicit RPC env for remote; fallback to localhost
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || "http://127.0.0.1:8545");

  let deployer;
  if (isLocal) {
    // Use unlocked signer from Hardhat node for localhost
    const signers = await ethers.getSigners();
    if (!signers || signers.length === 0) throw new Error("No local signers available. Start `npx hardhat node`.");
    deployer = signers[0];
    console.log("Using local signer:", await deployer.getAddress ? await deployer.getAddress() : deployer.address);
  } else {
    if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env for remote network");
    deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log("Using wallet deployer:", deployer.address);
  }

  // Make sure deployer has balance
  const balance = await provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Get and display current nonce
  const currentNonce = await provider.getTransactionCount(deployer.address, "pending");
  console.log("Current nonce:", currentNonce);

  // helper to deploy with explicit nonce management
  async function deploy(factory, args = [], contractName = "") {
    const nonce = await provider.getTransactionCount(deployer.address, "pending");
    console.log(`\nDeploying ${contractName} with nonce ${nonce}...`);
    
    const contract = await factory.deploy(...args, {
      nonce: nonce,
      gasLimit: 5000000, // Explicit gas limit
    });
    
    console.log(`${contractName} deployment tx sent:`, contract.deploymentTransaction().hash);
    
    // Wait for deployment with multiple confirmations
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log(`${contractName} deployed at:`, address);
    
    // Wait for confirmations
    await contract.deploymentTransaction().wait(2);
    console.log(`${contractName} confirmed`);
    
    // Add delay to ensure network sync
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return contract;
  }

  try {
    // Deploy contracts one by one with proper nonce handling
    const MarketplaceGuardFactory = await ethers.getContractFactory("MarketplaceGuard", deployer);
    const marketplaceGuard = await deploy(MarketplaceGuardFactory, [deployer.address], "MarketplaceGuard");

    // Whitelist the deployer address
    console.log(`\nWhitelisting minter address (${deployer.address}) on MarketplaceGuard...`);
    const whitelistNonce = await provider.getTransactionCount(deployer.address, "pending");
    const whitelistTx = await marketplaceGuard.whitelistUser(deployer.address, {
      nonce: whitelistNonce,
      gasLimit: 200000,
    });
    console.log("Whitelist tx sent:", whitelistTx.hash);
    await whitelistTx.wait(2);
    console.log("Minter address whitelisted successfully.");
    await new Promise(resolve => setTimeout(resolve, 3000));

    const FractionalPropertyFactory = await ethers.getContractFactory("FractionalProperty", deployer);
    const fractionalProperty = await deploy(
      FractionalPropertyFactory, 
      ["https://api.titlebase.com/metadata/{id}.json", deployer.address],
      "FractionalProperty"
    );

    const TitleNFTFactory = await ethers.getContractFactory("TitleNFT", deployer);
    const titleNFT = await deploy(
      TitleNFTFactory, 
      [
        "TitleBase Properties", 
        "TITLE", 
        deployer.address, 
        await marketplaceGuard.getAddress(), 
        await fractionalProperty.getAddress()
      ],
      "TitleNFT"
    );

    const MarketplaceFactory = await ethers.getContractFactory("Marketplace", deployer);
    const marketplace = await deploy(
      MarketplaceFactory, 
      [deployer.address, await marketplaceGuard.getAddress(), deployer.address],
      "Marketplace"
    );

    const AuctionHouseFactory = await ethers.getContractFactory("AuctionHouse", deployer);
    const auctionHouse = await deploy(
      AuctionHouseFactory, 
      [deployer.address, await marketplaceGuard.getAddress(), deployer.address],
      "AuctionHouse"
    );

    const MarketplaceExecutorFactory = await ethers.getContractFactory("MarketplaceExecutor", deployer);
    const marketplaceExecutor = await deploy(
      MarketplaceExecutorFactory, 
      [deployer.address, await marketplace.getAddress()],
      "MarketplaceExecutor"
    );

    const TBAAccountFactory = await ethers.getContractFactory("TBAAccount", deployer);
    const tbaAccount = await deploy(TBAAccountFactory, [], "TBAAccount");

    console.log("\n✅ All contracts deployed successfully!");
    console.log("\n📋 Deployment Summary:");
    console.log("=".repeat(60));
    console.log("MarketplaceGuard:    ", await marketplaceGuard.getAddress());
    console.log("FractionalProperty:  ", await fractionalProperty.getAddress());
    console.log("TitleNFT:            ", await titleNFT.getAddress());
    console.log("Marketplace:         ", await marketplace.getAddress());
    console.log("AuctionHouse:        ", await auctionHouse.getAddress());
    console.log("MarketplaceExecutor: ", await marketplaceExecutor.getAddress());
    console.log("TBAAccount:          ", await tbaAccount.getAddress());
    console.log("=".repeat(60));

    // Save addresses to a file
    const fs = require('fs');
    const addresses = {
      MarketplaceGuard: await marketplaceGuard.getAddress(),
      FractionalProperty: await fractionalProperty.getAddress(),
      TitleNFT: await titleNFT.getAddress(),
      Marketplace: await marketplace.getAddress(),
      AuctionHouse: await auctionHouse.getAddress(),
      MarketplaceExecutor: await marketplaceExecutor.getAddress(),
      TBAAccount: await tbaAccount.getAddress(),
    };
    
    fs.writeFileSync(
      'deployment-addresses.json',
      JSON.stringify(addresses, null, 2)
    );
    console.log("\n💾 Addresses saved to deployment-addresses.json");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    if (error.transaction) {
      console.error("Failed transaction:", error.transaction);
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });