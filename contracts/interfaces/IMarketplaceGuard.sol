// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMarketplaceGuard
 * @notice Interface for marketplace access control and policy enforcement
 */
interface IMarketplaceGuard {
    struct PolicyFlags {
        bool requiresKYC;
        bool requiresWhitelist;
        bool allowBundles;
        bool allowBids;
        uint256 minPrice;
        uint256 maxPrice;
    }

    event UserWhitelisted(address indexed user, address indexed admin);
    event UserBlacklisted(address indexed user, address indexed admin);
    event PolicyUpdated(bytes32 indexed policyId, PolicyFlags flags);

    function isAllowedToTrade(address user, uint256 tokenId) external view returns (bool);
    function isAllowedToBid(address user, uint256 tokenId) external view returns (bool);
    function validateTransaction(
        address seller,
        address buyer,
        uint256 tokenId,
        uint256 price
    ) external view returns (bool);
    
    function whitelistUser(address user) external;
    function blacklistUser(address user) external;
    function updatePolicy(bytes32 policyId, PolicyFlags calldata flags) external;
}
