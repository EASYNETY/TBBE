const { ethers } = require("hardhat")

async function main() {
  console.log("Deploying Fractional Property contracts...")

  // Get deployer
  const [deployer] = await ethers.getSigners()
  console.log("Deploying with account:", deployer.address)

  // Deploy FractionalProperty contract
  const FractionalProperty = await ethers.getContractFactory("FractionalProperty")
  const fractionalProperty = await FractionalProperty.deploy(
    "https://api.titlebase.com/metadata/{id}.json", // URI template
    deployer.address, // Admin
  )

  await fractionalProperty.waitForDeployment()
  console.log("FractionalProperty deployed to:", await fractionalProperty.getAddress())

  // Update TitleNFT deployment to include fractional property reference
  const TitleNFT = await ethers.getContractFactory("TitleNFT")
  const titleNFT = await TitleNFT.deploy(
    "TitleBase Properties",
    "TITLE",
    deployer.address,
    "0x0000000000000000000000000000000000000000", // Marketplace guard (deploy separately)
    await fractionalProperty.getAddress(),
  )

  await titleNFT.waitForDeployment()
  console.log("TitleNFT deployed to:", await titleNFT.getAddress())

  console.log("\nDeployment completed!")
  console.log("FractionalProperty:", await fractionalProperty.getAddress())
  console.log("TitleNFT:", await titleNFT.getAddress())
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
