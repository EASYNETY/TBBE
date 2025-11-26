// scripts/deploy-tba.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Load contract
  const TBAAccount = await hre.ethers.getContractFactory("TBAAccount");

  // Deploy with constructor params (adjust if needed)
  const tba = await TBAAccount.deploy(
    "DummyPropertyToken", // name
    "DPT",                // symbol
    deployer.address      // owner/registry wallet
  );

  await tba.waitForDeployment();

  console.log("TBAAccount deployed to:", await tba.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
