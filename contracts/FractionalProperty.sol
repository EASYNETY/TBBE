// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IFractionalProperty.sol";

/**
 * @title FractionalProperty
 * @notice ERC-1155 implementation for fractional real estate ownership
 */
contract FractionalProperty is ERC1155, AccessControl, ReentrancyGuard, Pausable, IFractionalProperty {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant REVENUE_DISTRIBUTOR_ROLE = keccak256("REVENUE_DISTRIBUTOR_ROLE");

    uint256 private _nextTokenId = 1;
    
    mapping(uint256 => PropertyInfo) private _properties;
    mapping(uint256 => mapping(address => InvestorInfo)) private _investors;
    mapping(uint256 => uint256) private _totalRevenue;
    mapping(uint256 => uint256) private _revenuePerShare;
    mapping(string => bool) private _propertyIdExists;

    modifier validToken(uint256 tokenId) {
        require(_properties[tokenId].totalShares > 0, "FractionalProperty: Token does not exist");
        _;
    }

    modifier onlyActiveProperty(uint256 tokenId) {
        require(_properties[tokenId].isActive, "FractionalProperty: Property not active");
        _;
    }

    constructor(string memory uri, address admin) ERC1155(uri) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(REVENUE_DISTRIBUTOR_ROLE, admin);
    }

    function tokenizeProperty(
        string calldata propertyId,
        string calldata legalDescription,
        uint256 totalValue,
        uint256 totalShares,
        uint256 minInvestment,
        uint256 maxInvestment,
        string calldata jurisdiction,
        bytes32 documentHash
    ) external onlyRole(ADMIN_ROLE) returns (uint256 tokenId) {
        require(!_propertyIdExists[propertyId], "FractionalProperty: Property ID already exists");
        require(totalValue > 0 && totalShares > 0, "FractionalProperty: Invalid values");
        require(minInvestment <= maxInvestment, "FractionalProperty: Invalid investment limits");

        tokenId = _nextTokenId++;
        _propertyIdExists[propertyId] = true;

        _properties[tokenId] = PropertyInfo({
            propertyId: propertyId,
            legalDescription: legalDescription,
            totalValue: totalValue,
            totalShares: totalShares,
            minInvestment: minInvestment,
            maxInvestment: maxInvestment,
            jurisdiction: jurisdiction,
            documentHash: documentHash,
            isVerified: false,
            isActive: true,
            monthlyRevenue: 0,
            lastDistribution: block.timestamp
        });

        emit PropertyTokenized(tokenId, propertyId, totalShares, totalValue);
        return tokenId;
    }

    function purchaseShares(uint256 tokenId, uint256 shares) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        validToken(tokenId) 
        onlyActiveProperty(tokenId) 
    {
        PropertyInfo storage property = _properties[tokenId];
        require(shares > 0, "FractionalProperty: Invalid share amount");
        
        uint256 sharePrice = property.totalValue / property.totalShares;
        uint256 totalCost = shares * sharePrice;
        require(msg.value >= totalCost, "FractionalProperty: Insufficient payment");

        // Check investment limits
        InvestorInfo storage investor = _investors[tokenId][msg.sender];
        uint256 newTotalInvestment = investor.totalInvested + totalCost;
        require(newTotalInvestment >= property.minInvestment, "FractionalProperty: Below minimum investment");
        require(newTotalInvestment <= property.maxInvestment, "FractionalProperty: Exceeds maximum investment");

        // Check available shares
        uint256 currentSupply = totalSupply(tokenId);
        require(currentSupply + shares <= property.totalShares, "FractionalProperty: Not enough shares available");

        // Update investor info
        investor.totalShares += shares;
        investor.totalInvested += totalCost;
        if (investor.lastClaimTime == 0) {
            investor.lastClaimTime = block.timestamp;
        }

        // Mint shares to investor
        _mint(msg.sender, tokenId, shares, "");

        // Refund excess payment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }

        emit SharesPurchased(tokenId, msg.sender, shares, totalCost);
    }

    function distributeRevenue(uint256 tokenId) 
        external 
        payable 
        onlyRole(REVENUE_DISTRIBUTOR_ROLE) 
        validToken(tokenId) 
    {
        require(msg.value > 0, "FractionalProperty: No revenue to distribute");
        
        PropertyInfo storage property = _properties[tokenId];
        uint256 currentSupply = totalSupply(tokenId);
        require(currentSupply > 0, "FractionalProperty: No shares issued");

        _totalRevenue[tokenId] += msg.value;
        _revenuePerShare[tokenId] += msg.value / currentSupply;
        property.monthlyRevenue = msg.value;
        property.lastDistribution = block.timestamp;

        emit RevenueDistributed(tokenId, msg.value, block.timestamp);
    }

    function withdrawRevenue(uint256 tokenId) external nonReentrant validToken(tokenId) {
        uint256 pendingReturns = calculatePendingReturns(tokenId, msg.sender);
        require(pendingReturns > 0, "FractionalProperty: No returns to withdraw");

        InvestorInfo storage investor = _investors[tokenId][msg.sender];
        investor.totalReturns += pendingReturns;
        investor.lastClaimTime = block.timestamp;

        payable(msg.sender).transfer(pendingReturns);
        emit RevenueWithdrawn(tokenId, msg.sender, pendingReturns);
    }

    function calculatePendingReturns(uint256 tokenId, address investor) 
        public 
        view 
        validToken(tokenId) 
        returns (uint256) 
    {
        uint256 shares = balanceOf(investor, tokenId);
        if (shares == 0) return 0;

        InvestorInfo memory investorInfo = _investors[tokenId][investor];
        uint256 revenuePerShare = _revenuePerShare[tokenId];
        
        // Calculate returns based on share ownership
        return (shares * revenuePerShare) - investorInfo.totalReturns;
    }

    function verifyProperty(uint256 tokenId) external onlyRole(VERIFIER_ROLE) validToken(tokenId) {
        require(!_properties[tokenId].isVerified, "FractionalProperty: Already verified");
        
        _properties[tokenId].isVerified = true;
        emit PropertyVerified(tokenId, msg.sender);
    }

    function getPropertyInfo(uint256 tokenId) external view validToken(tokenId) returns (PropertyInfo memory) {
        return _properties[tokenId];
    }

    function getInvestorInfo(uint256 tokenId, address investor) 
        external 
        view 
        validToken(tokenId) 
        returns (InvestorInfo memory) 
    {
        return _investors[tokenId][investor];
    }

    function totalSupply(uint256 tokenId) public view returns (uint256) {
        // Track actual supply of issued shares
        return _properties[tokenId].totalShares - _properties[tokenId].totalShares; // Placeholder - implement proper tracking
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
