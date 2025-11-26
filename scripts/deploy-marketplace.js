const { ethers } = require("hardhat")

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log("Deploying contracts with the account:", deployer.address)
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString())

  // Deploy MarketplaceGuard first
  const MarketplaceGuard = await ethers.getContractFactory("MarketplaceGuard")
  const marketplaceGuard = await MarketplaceGuard.deploy(deployer.address)
  await marketplaceGuard.waitForDeployment()
  console.log("MarketplaceGuard deployed to:", await marketplaceGuard.getAddress())

  // Deploy TitleNFT
  const TitleNFT = await ethers.getContractFactory("TitleNFT")
  const titleNFT = await TitleNFT.deploy("Title NFT", "TITLE", deployer.address, await marketplaceGuard.getAddress())
  await titleNFT.waitForDeployment()
  console.log("TitleNFT deployed to:", await titleNFT.getAddress())

  // Deploy Marketplace
  const Marketplace = await ethers.getContractFactory("Marketplace")
  const marketplace = await Marketplace.deploy(
    deployer.address,
    await marketplaceGuard.getAddress(),
    deployer.address, // Fee recipient
  )
  await marketplace.waitForDeployment()
  console.log("Marketplace deployed to:", await marketplace.getAddress())

  // Deploy AuctionHouse
  const AuctionHouse = await ethers.getContractFactory("AuctionHouse")
  const auctionHouse = await AuctionHouse.deploy(
    deployer.address,
    await marketplaceGuard.getAddress(),
    deployer.address, // Fee recipient
  )
  await auctionHouse.waitForDeployment()
  console.log("AuctionHouse deployed to:", await auctionHouse.getAddress())

  // Deploy MarketplaceExecutor
  const MarketplaceExecutor = await ethers.getContractFactory("MarketplaceExecutor")
  const marketplaceExecutor = await MarketplaceExecutor.deploy(deployer.address, await marketplace.getAddress())
  await marketplaceExecutor.waitForDeployment()
  console.log("MarketplaceExecutor deployed to:", await marketplaceExecutor.getAddress())

  // Deploy TBAAccount implementation
  const TBAAccount = await ethers.getContractFactory("TBAAccount")
  const tbaAccount = await TBAAccount.deploy()
  await tbaAccount.waitForDeployment()
  console.log("TBAAccount implementation deployed to:", await tbaAccount.getAddress())

  console.log("\nDeployment completed!")
  console.log("Save these addresses for frontend integration:")
  console.log({
    MarketplaceGuard: await marketplaceGuard.getAddress(),
    TitleNFT: await titleNFT.getAddress(),
    Marketplace: await marketplace.getAddress(),
    AuctionHouse: await auctionHouse.getAddress(),
    MarketplaceExecutor: await marketplaceExecutor.getAddress(),
    TBAAccount: await tbaAccount.getAddress(),
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
