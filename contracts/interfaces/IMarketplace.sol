// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMarketplace
 * @notice Interface for the core marketplace functionality
 */
interface IMarketplace {
    enum OrderType {
        FIXED_PRICE,
        COLLECTION_BID,
        BUNDLE,
        AUCTION
    }

    struct Order {
        address seller;
        address collection;
        uint256[] tokenIds;
        uint256 price;
        address paymentToken;
        uint256 startTime;
        uint256 endTime;
        OrderType orderType;
        bytes signature;
        uint256 nonce;
        bool isActive;
    }

    struct Bid {
        address bidder;
        address collection;
        uint256[] tokenIds;
        uint256 amount;
        address paymentToken;
        uint256 deadline;
        bytes signature;
        uint256 nonce;
    }

    event OrderCreated(bytes32 indexed orderHash, address indexed seller, OrderType orderType);
    event OrderCancelled(bytes32 indexed orderHash, address indexed seller);
    event OrderFulfilled(bytes32 indexed orderHash, address indexed buyer, address indexed seller, uint256 price);
    event BidPlaced(bytes32 indexed bidHash, address indexed bidder, uint256 amount);
    event BidAccepted(bytes32 indexed bidHash, address indexed seller, address indexed bidder);

    function createOrder(Order calldata order) external;
    function cancelOrder(bytes32 orderHash) external;
    function fulfillOrder(bytes32 orderHash, address buyer) external payable;
    function placeBid(Bid calldata bid) external payable;
    function acceptBid(bytes32 bidHash) external;
    function batchBuy(bytes32[] calldata orderHashes, address buyer) external payable;
}
