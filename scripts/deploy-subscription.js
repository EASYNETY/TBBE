const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const tokenAddress = "0xYOUR_ERC20_TOKEN_ADDRESS"; // Replace with your ERC20 token address
    const PropertySubscription = await ethers.getContractFactory("PropertySubscription");
    const propertySubscription = await PropertySubscription.deploy(tokenAddress);

    console.log("PropertySubscription deployed to:", await propertySubscription.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
