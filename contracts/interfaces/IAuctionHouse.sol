// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAuctionHouse
 * @notice Interface for reserve auction functionality
 */
interface IAuctionHouse {
    struct Auction {
        address seller;
        address collection;
        uint256 tokenId;
        uint256 reservePrice;
        uint256 currentBid;
        address currentBidder;
        address paymentToken;
        uint256 startTime;
        uint256 endTime;
        bool settled;
        bool cancelled;
    }

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address indexed collection,
        uint256 tokenId,
        uint256 reservePrice
    );
    
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount,
        uint256 endTime
    );
    
    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 amount
    );

    function createAuction(
        address collection,
        uint256 tokenId,
        uint256 reservePrice,
        address paymentToken,
        uint256 duration
    ) external returns (uint256 auctionId);

    function placeBid(uint256 auctionId) external payable;
    function settleAuction(uint256 auctionId) external;
    function cancelAuction(uint256 auctionId) external;
}
