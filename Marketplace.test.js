const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("Marketplace", () => {
  let marketplace, titleNFT, marketplaceGuard
  let owner, seller, buyer, feeRecipient

  beforeEach(async () => {
    ;[owner, seller, buyer, feeRecipient] = await ethers.getSigners()

    // Deploy MarketplaceGuard
    const MarketplaceGuard = await ethers.getContractFactory("MarketplaceGuard")
    marketplaceGuard = await MarketplaceGuard.deploy(owner.address)

    // Deploy TitleNFT
    const TitleNFT = await ethers.getContractFactory("TitleNFT")
    titleNFT = await TitleNFT.deploy("Title NFT", "TITLE", owner.address, await marketplaceGuard.getAddress())

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace")
    marketplace = await Marketplace.deploy(owner.address, await marketplaceGuard.getAddress(), feeRecipient.address)

    // Whitelist users
    await marketplaceGuard.whitelistUser(seller.address)
    await marketplaceGuard.whitelistUser(buyer.address)
  })

  describe("Order Creation and Fulfillment", () => {
    it("Should create and fulfill a fixed price order", async () => {
      // Mint NFT to seller
      await titleNFT.mintTitle(
        seller.address,
        "PROP001",
        "123 Main St",
        ethers.parseEther("100"),
        "CA",
        ethers.keccak256(ethers.toUtf8Bytes("document")),
      )

      // Approve marketplace
      await titleNFT.connect(seller).approve(await marketplace.getAddress(), 1)

      // Create order
      const order = {
        seller: seller.address,
        collection: await titleNFT.getAddress(),
        tokenIds: [1],
        price: ethers.parseEther("10"),
        paymentToken: ethers.ZeroAddress,
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 3600,
        orderType: 0, // FIXED_PRICE
        signature: "0x",
        nonce: 0,
        isActive: true,
      }

      await marketplace.connect(seller).createOrder(order)

      // Calculate order hash
      const orderHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["tuple(address,address,uint256[],uint256,address,uint256,uint256,uint8,bytes,uint256,bool)"],
          [order],
        ),
      )

      // Fulfill order
      await marketplace.connect(buyer).fulfillOrder(orderHash, buyer.address, {
        value: ethers.parseEther("10"),
      })

      // Check NFT ownership
      expect(await titleNFT.ownerOf(1)).to.equal(buyer.address)
    })
  })

  describe("Batch Operations", () => {
    it("Should execute batch buy", async () => {
      // Setup multiple NFTs and orders
      for (let i = 1; i <= 3; i++) {
        await titleNFT.mintTitle(
          seller.address,
          `PROP00${i}`,
          `${i}23 Main St`,
          ethers.parseEther("100"),
          "CA",
          ethers.keccak256(ethers.toUtf8Bytes(`document${i}`)),
        )

        await titleNFT.connect(seller).approve(await marketplace.getAddress(), i)
      }

      // Create multiple orders
      const orderHashes = []
      for (let i = 1; i <= 3; i++) {
        const order = {
          seller: seller.address,
          collection: await titleNFT.getAddress(),
          tokenIds: [i],
          price: ethers.parseEther("5"),
          paymentToken: ethers.ZeroAddress,
          startTime: Math.floor(Date.now() / 1000),
          endTime: Math.floor(Date.now() / 1000) + 3600,
          orderType: 0,
          signature: "0x",
          nonce: i - 1,
          isActive: true,
        }

        await marketplace.connect(seller).createOrder(order)

        const orderHash = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ["tuple(address,address,uint256[],uint256,address,uint256,uint256,uint8,bytes,uint256,bool)"],
            [order],
          ),
        )
        orderHashes.push(orderHash)
      }

      // Execute batch buy
      await marketplace.connect(buyer).batchBuy(orderHashes, buyer.address, {
        value: ethers.parseEther("15"),
      })

      // Check all NFTs are owned by buyer
      for (let i = 1; i <= 3; i++) {
        expect(await titleNFT.ownerOf(i)).to.equal(buyer.address)
      }
    })
  })
})
