// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFractionalProperty
 * @notice Interface for fractional property ownership using ERC-1155
 */
interface IFractionalProperty {
    struct PropertyInfo {
        string propertyId;
        string legalDescription;
        uint256 totalValue;
        uint256 totalShares;
        uint256 minInvestment;
        uint256 maxInvestment;
        string jurisdiction;
        bytes32 documentHash;
        bool isVerified;
        bool isActive;
        uint256 monthlyRevenue;
        uint256 lastDistribution;
    }

    struct InvestorInfo {
        uint256 totalShares;
        uint256 totalInvested;
        uint256 totalReturns;
        uint256 lastClaimTime;
    }

    event PropertyTokenized(uint256 indexed tokenId, string propertyId, uint256 totalShares, uint256 totalValue);
    event SharesPurchased(uint256 indexed tokenId, address indexed investor, uint256 shares, uint256 amount);
    event RevenueDistributed(uint256 indexed tokenId, uint256 totalRevenue, uint256 timestamp);
    event RevenueWithdrawn(uint256 indexed tokenId, address indexed investor, uint256 amount);
    event PropertyVerified(uint256 indexed tokenId, address indexed verifier);

    function tokenizeProperty(
        string calldata propertyId,
        string calldata legalDescription,
        uint256 totalValue,
        uint256 totalShares,
        uint256 minInvestment,
        uint256 maxInvestment,
        string calldata jurisdiction,
        bytes32 documentHash
    ) external returns (uint256 tokenId);

    function purchaseShares(uint256 tokenId, uint256 shares) external payable;
    function distributeRevenue(uint256 tokenId) external payable;
    function withdrawRevenue(uint256 tokenId) external;
    function getPropertyInfo(uint256 tokenId) external view returns (PropertyInfo memory);
    function getInvestorInfo(uint256 tokenId, address investor) external view returns (InvestorInfo memory);
    function calculatePendingReturns(uint256 tokenId, address investor) external view returns (uint256);
}
