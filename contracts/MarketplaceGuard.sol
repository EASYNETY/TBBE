// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IMarketplaceGuard.sol";

/**
 * @title MarketplaceGuard
 * @notice Access control and policy enforcement for the marketplace
 */
contract MarketplaceGuard is AccessControl, IMarketplaceGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant POLICY_MANAGER_ROLE = keccak256("POLICY_MANAGER_ROLE");

    mapping(address => bool) public whitelist;
    mapping(address => bool) public blacklist;
    mapping(bytes32 => PolicyFlags) public policies;
    mapping(address => bool) public kycVerified;

    bytes32 public constant DEFAULT_POLICY = keccak256("DEFAULT_POLICY");

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(POLICY_MANAGER_ROLE, admin);

        // Set default policy
        policies[DEFAULT_POLICY] = PolicyFlags({
            requiresKYC: false,
            requiresWhitelist: true,
            allowBundles: true,
            allowBids: true,
            minPrice: 0,
            maxPrice: type(uint256).max
        });
    }

    function isAllowedToTrade(address user, uint256 tokenId) external view returns (bool) {
        if (blacklist[user]) return false;
        
        PolicyFlags memory policy = policies[DEFAULT_POLICY];
        
        if (policy.requiresWhitelist && !whitelist[user]) return false;
        if (policy.requiresKYC && !kycVerified[user]) return false;
        
        return true;
    }

    function isAllowedToBid(address user, uint256 tokenId) external view returns (bool) {
        if (blacklist[user]) return false;
        
        PolicyFlags memory policy = policies[DEFAULT_POLICY];
        
        if (!policy.allowBids) return false;
        if (policy.requiresWhitelist && !whitelist[user]) return false;
        if (policy.requiresKYC && !kycVerified[user]) return false;
        
        return true;
    }

    function validateTransaction(
        address seller,
        address buyer,
        uint256 tokenId,
        uint256 price
    ) external view returns (bool) {
        if (blacklist[seller] || blacklist[buyer]) return false;
        
        PolicyFlags memory policy = policies[DEFAULT_POLICY];
        
        if (policy.requiresWhitelist && (!whitelist[seller] || !whitelist[buyer])) return false;
        if (policy.requiresKYC && (!kycVerified[seller] || !kycVerified[buyer])) return false;
        if (price < policy.minPrice || price > policy.maxPrice) return false;
        
        return true;
    }

    function whitelistUser(address user) external onlyRole(ADMIN_ROLE) {
        require(!blacklist[user], "MarketplaceGuard: User is blacklisted");
        whitelist[user] = true;
        emit UserWhitelisted(user, msg.sender);
    }

    function blacklistUser(address user) external onlyRole(ADMIN_ROLE) {
        blacklist[user] = true;
        whitelist[user] = false;
        emit UserBlacklisted(user, msg.sender);
    }

    function verifyKYC(address user) external onlyRole(ADMIN_ROLE) {
        kycVerified[user] = true;
    }

    function revokeKYC(address user) external onlyRole(ADMIN_ROLE) {
        kycVerified[user] = false;
    }

    function updatePolicy(bytes32 policyId, PolicyFlags calldata flags) external onlyRole(POLICY_MANAGER_ROLE) {
        policies[policyId] = flags;
        emit PolicyUpdated(policyId, flags);
    }
}
