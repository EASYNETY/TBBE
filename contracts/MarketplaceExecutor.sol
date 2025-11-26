// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IMarketplace.sol";

/**
 * @title MarketplaceExecutor
 * @notice Handles complex marketplace operations and batch transactions
 */
contract MarketplaceExecutor is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    IMarketplace public marketplace;
    
    struct BatchOperation {
        address target;
        bytes data;
        uint256 value;
    }

    event BatchExecuted(address indexed executor, uint256 operationCount);
    event BundlePurchased(address indexed buyer, bytes32[] orderHashes, uint256 totalPrice);

    constructor(address admin, address _marketplace) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        marketplace = IMarketplace(_marketplace);
    }

    function executeBatch(BatchOperation[] calldata operations) 
        external 
        payable 
        onlyRole(EXECUTOR_ROLE) 
        nonReentrant 
    {
        require(operations.length > 0, "MarketplaceExecutor: No operations");
        
        for (uint256 i = 0; i < operations.length; i++) {
            BatchOperation memory op = operations[i];
            
            (bool success, ) = op.target.call{value: op.value}(op.data);
            require(success, "MarketplaceExecutor: Operation failed");
        }

        emit BatchExecuted(msg.sender, operations.length);
    }

    function purchaseBundle(
        bytes32[] calldata orderHashes,
        uint256 maxTotalPrice
    ) external payable nonReentrant {
        require(orderHashes.length > 1, "MarketplaceExecutor: Not a bundle");
        require(msg.value <= maxTotalPrice, "MarketplaceExecutor: Price exceeded");

        // Execute batch buy through marketplace
        marketplace.batchBuy{value: msg.value}(orderHashes, msg.sender);

        emit BundlePurchased(msg.sender, orderHashes, msg.value);
    }

    function sweepCollection(
        address collection,
        uint256[] calldata tokenIds,
        uint256 maxPricePerToken
    ) external payable nonReentrant {
        require(tokenIds.length > 0, "MarketplaceExecutor: No tokens specified");
        
        uint256 totalSpent = 0;
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // This would integrate with the marketplace to find and execute orders
            // Implementation depends on specific marketplace order structure
            // For now, this is a placeholder for the sweep functionality
        }

        // Refund unused ETH
        if (msg.value > totalSpent) {
            payable(msg.sender).transfer(msg.value - totalSpent);
        }
    }

    function updateMarketplace(address newMarketplace) external onlyRole(ADMIN_ROLE) {
        marketplace = IMarketplace(newMarketplace);
    }

    receive() external payable {}
}
