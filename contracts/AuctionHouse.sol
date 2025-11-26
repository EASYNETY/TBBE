// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IAuctionHouse.sol";
import "./interfaces/IMarketplaceGuard.sol";

/**
 * @title AuctionHouse
 * @notice Reserve auction implementation for title-backed NFTs
 */
contract AuctionHouse is IAuctionHouse, AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    uint256 public constant MARKETPLACE_FEE = 100; // 1% (100 basis points)
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_BID_INCREMENT = 500; // 5% minimum bid increment
    uint256 public constant TIME_EXTENSION = 15 minutes; // Extend auction if bid placed in last 15 minutes
    uint256 public constant MIN_AUCTION_DURATION = 1 hours;
    uint256 public constant MAX_AUCTION_DURATION = 7 days;

    IMarketplaceGuard public marketplaceGuard;
    address public feeRecipient;
    
    uint256 private _auctionIdCounter = 1;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public bidRefunds;

    constructor(
        address admin,
        address _marketplaceGuard,
        address _feeRecipient
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        marketplaceGuard = IMarketplaceGuard(_marketplaceGuard);
        feeRecipient = _feeRecipient;
    }

    function createAuction(
        address collection,
        uint256 tokenId,
        uint256 reservePrice,
        address paymentToken,
        uint256 duration
    ) external returns (uint256 auctionId) {
        require(duration >= MIN_AUCTION_DURATION, "AuctionHouse: Duration too short");
        require(duration <= MAX_AUCTION_DURATION, "AuctionHouse: Duration too long");
        require(reservePrice > 0, "AuctionHouse: Invalid reserve price");

        // Verify ownership
        require(
            IERC721(collection).ownerOf(tokenId) == msg.sender,
            "AuctionHouse: Not token owner"
        );

        // Validate with marketplace guard
        require(
            marketplaceGuard.isAllowedToTrade(msg.sender, tokenId),
            "AuctionHouse: Seller not allowed to trade"
        );

        auctionId = _auctionIdCounter++;
        
        auctions[auctionId] = Auction({
            seller: msg.sender,
            collection: collection,
            tokenId: tokenId,
            reservePrice: reservePrice,
            currentBid: 0,
            currentBidder: address(0),
            paymentToken: paymentToken,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            settled: false,
            cancelled: false
        });

        // Transfer NFT to auction house
        IERC721(collection).safeTransferFrom(msg.sender, address(this), tokenId);

        emit AuctionCreated(auctionId, msg.sender, collection, tokenId, reservePrice);
    }

    function placeBid(uint256 auctionId) external payable nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.seller != address(0), "AuctionHouse: Auction does not exist");
        require(!auction.settled, "AuctionHouse: Auction settled");
        require(!auction.cancelled, "AuctionHouse: Auction cancelled");
        require(block.timestamp < auction.endTime, "AuctionHouse: Auction ended");

        // Validate with marketplace guard
        require(
            marketplaceGuard.isAllowedToBid(msg.sender, auction.tokenId),
            "AuctionHouse: Bidder not allowed"
        );

        uint256 bidAmount;
        if (auction.paymentToken == address(0)) {
            bidAmount = msg.value;
        } else {
            revert("AuctionHouse: ERC20 bids not supported in this version");
        }

        require(bidAmount >= auction.reservePrice, "AuctionHouse: Bid below reserve");
        
        if (auction.currentBid > 0) {
            uint256 minBid = auction.currentBid + (auction.currentBid * MIN_BID_INCREMENT) / BASIS_POINTS;
            require(bidAmount >= minBid, "AuctionHouse: Bid increment too low");
            
            // Add previous bid to refunds
            bidRefunds[auctionId][auction.currentBidder] += auction.currentBid;
        }

        auction.currentBid = bidAmount;
        auction.currentBidder = msg.sender;

        // Extend auction if bid placed in last 15 minutes
        if (auction.endTime - block.timestamp < TIME_EXTENSION) {
            auction.endTime = block.timestamp + TIME_EXTENSION;
        }

        emit BidPlaced(auctionId, msg.sender, bidAmount, auction.endTime);
    }

    function settleAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.seller != address(0), "AuctionHouse: Auction does not exist");
        require(!auction.settled, "AuctionHouse: Auction already settled");
        require(!auction.cancelled, "AuctionHouse: Auction cancelled");
        require(block.timestamp >= auction.endTime, "AuctionHouse: Auction not ended");

        auction.settled = true;

        if (auction.currentBidder != address(0)) {
            // Auction has winner
            require(
                marketplaceGuard.validateTransaction(
                    auction.seller,
                    auction.currentBidder,
                    auction.tokenId,
                    auction.currentBid
                ),
                "AuctionHouse: Transaction not allowed"
            );

            // Calculate fees
            uint256 feeAmount = (auction.currentBid * MARKETPLACE_FEE) / BASIS_POINTS;
            uint256 sellerAmount = auction.currentBid - feeAmount;

            // Transfer payments
            if (feeAmount > 0) {
                payable(feeRecipient).transfer(feeAmount);
            }
            payable(auction.seller).transfer(sellerAmount);

            // Transfer NFT to winner
            IERC721(auction.collection).safeTransferFrom(
                address(this),
                auction.currentBidder,
                auction.tokenId
            );

            emit AuctionSettled(auctionId, auction.currentBidder, auction.currentBid);
        } else {
            // No bids, return NFT to seller
            IERC721(auction.collection).safeTransferFrom(
                address(this),
                auction.seller,
                auction.tokenId
            );

            emit AuctionSettled(auctionId, address(0), 0);
        }
    }

    function cancelAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(auction.seller == msg.sender, "AuctionHouse: Not auction owner");
        require(!auction.settled, "AuctionHouse: Auction settled");
        require(!auction.cancelled, "AuctionHouse: Auction already cancelled");
        require(auction.currentBidder == address(0), "AuctionHouse: Cannot cancel with bids");

        auction.cancelled = true;

        // Return NFT to seller
        IERC721(auction.collection).safeTransferFrom(
            address(this),
            auction.seller,
            auction.tokenId
        );
    }

    function withdrawBidRefund(uint256 auctionId) external nonReentrant {
        uint256 refundAmount = bidRefunds[auctionId][msg.sender];
        require(refundAmount > 0, "AuctionHouse: No refund available");

        bidRefunds[auctionId][msg.sender] = 0;
        payable(msg.sender).transfer(refundAmount);
    }

    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    function updateFeeRecipient(address newFeeRecipient) external onlyRole(ADMIN_ROLE) {
        feeRecipient = newFeeRecipient;
    }

    function updateMarketplaceGuard(address newGuard) external onlyRole(ADMIN_ROLE) {
        marketplaceGuard = IMarketplaceGuard(newGuard);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
