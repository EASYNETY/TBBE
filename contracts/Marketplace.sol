// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IMarketplace.sol";
import "./interfaces/IMarketplaceGuard.sol";

/**
 * @title Marketplace
 * @notice Core marketplace contract based on LooksRare v2 architecture
 */
contract Marketplace is IMarketplace, EIP712, AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,address collection,uint256[] tokenIds,uint256 price,address paymentToken,uint256 startTime,uint256 endTime,uint8 orderType,uint256 nonce)"
    );
    bytes32 public constant BID_TYPEHASH = keccak256(
        "Bid(address bidder,address collection,uint256[] tokenIds,uint256 amount,address paymentToken,uint256 deadline,uint256 nonce)"
    );

    uint256 public constant MARKETPLACE_FEE = 100; // 1% (100 basis points)
    uint256 public constant BASIS_POINTS = 10000;

    IMarketplaceGuard public marketplaceGuard;
    address public feeRecipient;
    
    mapping(bytes32 => Order) public orders;
    mapping(bytes32 => Bid) public bids;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public cancelledOrders;
    mapping(bytes32 => bool) public fulfilledOrders;

    constructor(
        address admin,
        address _marketplaceGuard,
        address _feeRecipient
    ) EIP712("TitleMarketplace", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        marketplaceGuard = IMarketplaceGuard(_marketplaceGuard);
        feeRecipient = _feeRecipient;
    }

    function createOrder(Order calldata order) external {
        require(order.seller == msg.sender, "Marketplace: Invalid seller");
        require(order.startTime <= block.timestamp, "Marketplace: Order not started");
        require(order.endTime > block.timestamp, "Marketplace: Order expired");
        require(order.price > 0, "Marketplace: Invalid price");
        require(order.tokenIds.length > 0, "Marketplace: No tokens specified");

        // Validate with marketplace guard
        for (uint256 i = 0; i < order.tokenIds.length; i++) {
            require(
                marketplaceGuard.isAllowedToTrade(order.seller, order.tokenIds[i]),
                "Marketplace: Seller not allowed to trade"
            );
            
            // Verify ownership
            require(
                IERC721(order.collection).ownerOf(order.tokenIds[i]) == order.seller,
                "Marketplace: Seller does not own token"
            );
        }

        bytes32 orderHash = _hashOrder(order);
        require(!cancelledOrders[orderHash], "Marketplace: Order cancelled");
        require(!fulfilledOrders[orderHash], "Marketplace: Order fulfilled");

        orders[orderHash] = order;
        emit OrderCreated(orderHash, order.seller, order.orderType);
    }

    function cancelOrder(bytes32 orderHash) external {
        Order memory order = orders[orderHash];
        require(order.seller == msg.sender, "Marketplace: Not order owner");
        require(!fulfilledOrders[orderHash], "Marketplace: Order already fulfilled");

        cancelledOrders[orderHash] = true;
        emit OrderCancelled(orderHash, order.seller);
    }

    function fulfillOrder(bytes32 orderHash, address buyer) external payable nonReentrant {
        Order memory order = orders[orderHash];
        require(order.isActive, "Marketplace: Order not active");
        require(!cancelledOrders[orderHash], "Marketplace: Order cancelled");
        require(!fulfilledOrders[orderHash], "Marketplace: Order already fulfilled");
        require(block.timestamp >= order.startTime, "Marketplace: Order not started");
        require(block.timestamp <= order.endTime, "Marketplace: Order expired");

        // Validate with marketplace guard
        require(
            marketplaceGuard.validateTransaction(order.seller, buyer, order.tokenIds[0], order.price),
            "Marketplace: Transaction not allowed"
        );

        fulfilledOrders[orderHash] = true;

        // Calculate fees
        uint256 feeAmount = (order.price * MARKETPLACE_FEE) / BASIS_POINTS;
        uint256 sellerAmount = order.price - feeAmount;

        if (order.paymentToken == address(0)) {
            // ETH payment
            require(msg.value >= order.price, "Marketplace: Insufficient payment");
            
            // Transfer fee to fee recipient
            if (feeAmount > 0) {
                payable(feeRecipient).transfer(feeAmount);
            }
            
            // Transfer payment to seller
            payable(order.seller).transfer(sellerAmount);
            
            // Refund excess
            if (msg.value > order.price) {
                payable(buyer).transfer(msg.value - order.price);
            }
        } else {
            // ERC20 payment
            IERC20 paymentToken = IERC20(order.paymentToken);
            require(
                paymentToken.transferFrom(buyer, address(this), order.price),
                "Marketplace: Payment transfer failed"
            );
            
            // Transfer fee to fee recipient
            if (feeAmount > 0) {
                require(
                    paymentToken.transfer(feeRecipient, feeAmount),
                    "Marketplace: Fee transfer failed"
                );
            }
            
            // Transfer payment to seller
            require(
                paymentToken.transfer(order.seller, sellerAmount),
                "Marketplace: Seller payment failed"
            );
        }

        // Transfer NFTs to buyer
        for (uint256 i = 0; i < order.tokenIds.length; i++) {
            IERC721(order.collection).safeTransferFrom(
                order.seller,
                buyer,
                order.tokenIds[i]
            );
        }

        emit OrderFulfilled(orderHash, buyer, order.seller, order.price);
    }

    function placeBid(Bid calldata bid) external payable {
        require(bid.bidder == msg.sender, "Marketplace: Invalid bidder");
        require(bid.deadline > block.timestamp, "Marketplace: Bid expired");
        require(bid.amount > 0, "Marketplace: Invalid bid amount");

        // Validate with marketplace guard
        for (uint256 i = 0; i < bid.tokenIds.length; i++) {
            require(
                marketplaceGuard.isAllowedToBid(bid.bidder, bid.tokenIds[i]),
                "Marketplace: Bidder not allowed"
            );
        }

        bytes32 bidHash = _hashBid(bid);
        bids[bidHash] = bid;

        // Lock bid amount
        if (bid.paymentToken == address(0)) {
            require(msg.value >= bid.amount, "Marketplace: Insufficient bid amount");
        } else {
            require(
                IERC20(bid.paymentToken).transferFrom(bid.bidder, address(this), bid.amount),
                "Marketplace: Bid transfer failed"
            );
        }

        emit BidPlaced(bidHash, bid.bidder, bid.amount);
    }

    function acceptBid(bytes32 bidHash) external nonReentrant {
        Bid memory bid = bids[bidHash];
        require(bid.deadline > block.timestamp, "Marketplace: Bid expired");

        // Verify seller owns all tokens
        for (uint256 i = 0; i < bid.tokenIds.length; i++) {
            require(
                IERC721(bid.collection).ownerOf(bid.tokenIds[i]) == msg.sender,
                "Marketplace: Seller does not own token"
            );
        }

        // Validate with marketplace guard
        require(
            marketplaceGuard.validateTransaction(msg.sender, bid.bidder, bid.tokenIds[0], bid.amount),
            "Marketplace: Transaction not allowed"
        );

        // Calculate fees
        uint256 feeAmount = (bid.amount * MARKETPLACE_FEE) / BASIS_POINTS;
        uint256 sellerAmount = bid.amount - feeAmount;

        // Transfer payment
        if (bid.paymentToken == address(0)) {
            // ETH payment
            if (feeAmount > 0) {
                payable(feeRecipient).transfer(feeAmount);
            }
            payable(msg.sender).transfer(sellerAmount);
        } else {
            // ERC20 payment
            IERC20 paymentToken = IERC20(bid.paymentToken);
            if (feeAmount > 0) {
                require(
                    paymentToken.transfer(feeRecipient, feeAmount),
                    "Marketplace: Fee transfer failed"
                );
            }
            require(
                paymentToken.transfer(msg.sender, sellerAmount),
                "Marketplace: Seller payment failed"
            );
        }

        // Transfer NFTs to bidder
        for (uint256 i = 0; i < bid.tokenIds.length; i++) {
            IERC721(bid.collection).safeTransferFrom(
                msg.sender,
                bid.bidder,
                bid.tokenIds[i]
            );
        }

        // Clear bid
        delete bids[bidHash];

        emit BidAccepted(bidHash, msg.sender, bid.bidder);
    }

    function batchBuy(bytes32[] calldata orderHashes, address buyer) external payable nonReentrant {
        uint256 totalPrice = 0;
        
        // Calculate total price first
        for (uint256 i = 0; i < orderHashes.length; i++) {
            Order memory order = orders[orderHashes[i]];
            require(order.isActive, "Marketplace: Order not active");
            require(!cancelledOrders[orderHashes[i]], "Marketplace: Order cancelled");
            require(!fulfilledOrders[orderHashes[i]], "Marketplace: Order already fulfilled");
            totalPrice += order.price;
        }

        require(msg.value >= totalPrice, "Marketplace: Insufficient payment");

        // Execute each order
        for (uint256 i = 0; i < orderHashes.length; i++) {
            _executeSingleOrder(orderHashes[i], buyer);
        }

        // Refund excess
        if (msg.value > totalPrice) {
            payable(buyer).transfer(msg.value - totalPrice);
        }
    }

    function _executeSingleOrder(bytes32 orderHash, address buyer) internal {
        Order memory order = orders[orderHash];
        
        fulfilledOrders[orderHash] = true;

        // Calculate fees
        uint256 feeAmount = (order.price * MARKETPLACE_FEE) / BASIS_POINTS;
        uint256 sellerAmount = order.price - feeAmount;

        // Transfer payments
        if (feeAmount > 0) {
            payable(feeRecipient).transfer(feeAmount);
        }
        payable(order.seller).transfer(sellerAmount);

        // Transfer NFTs
        for (uint256 i = 0; i < order.tokenIds.length; i++) {
            IERC721(order.collection).safeTransferFrom(
                order.seller,
                buyer,
                order.tokenIds[i]
            );
        }

        emit OrderFulfilled(orderHash, buyer, order.seller, order.price);
    }

    function _hashOrder(Order memory order) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            ORDER_TYPEHASH,
            order.seller,
            order.collection,
            keccak256(abi.encodePacked(order.tokenIds)),
            order.price,
            order.paymentToken,
            order.startTime,
            order.endTime,
            order.orderType,
            order.nonce
        ));
    }

    function _hashBid(Bid memory bid) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            BID_TYPEHASH,
            bid.bidder,
            bid.collection,
            keccak256(abi.encodePacked(bid.tokenIds)),
            bid.amount,
            bid.paymentToken,
            bid.deadline,
            bid.nonce
        ));
    }

    function updateFeeRecipient(address newFeeRecipient) external onlyRole(ADMIN_ROLE) {
        feeRecipient = newFeeRecipient;
    }

    function updateMarketplaceGuard(address newGuard) external onlyRole(ADMIN_ROLE) {
        marketplaceGuard = IMarketplaceGuard(newGuard);
    }
}
