// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITitleNFT.sol";
import "./interfaces/IMarketplaceGuard.sol";

/**
 * @title TitleNFT
 * @notice ERC-721 implementation for title-backed NFTs with marketplace hooks
 */
contract TitleNFT is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard, ITitleNFT {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant METADATA_UPDATER_ROLE = keccak256("METADATA_UPDATER_ROLE");

    uint256 private _nextTokenId = 1;
    mapping(uint256 => TitleMetadata) private _titleMetadata;
    mapping(string => bool) private _propertyIdExists;
    
    address public marketplaceGuard;
    address public fractionalPropertyContract;
    
    modifier onlyAllowedTransfer(address from, address to, uint256 tokenId) {
        if (marketplaceGuard != address(0)) {
            require(
                IMarketplaceGuard(marketplaceGuard).isAllowedToTrade(to, tokenId),
                "TitleNFT: Transfer not allowed by marketplace guard"
            );
        }
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address admin,
        address _marketplaceGuard,
        address _fractionalPropertyContract
    ) ERC721(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(METADATA_UPDATER_ROLE, admin);
        marketplaceGuard = _marketplaceGuard;
        fractionalPropertyContract = _fractionalPropertyContract;
    }

    function mintTitle(
        address to,
        string calldata propertyId,
        string calldata legalDescription,
        uint256 assessedValue,
        string calldata jurisdiction,
        bytes32 documentHash
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        require(!_propertyIdExists[propertyId], "TitleNFT: Property ID already exists");
        require(bytes(propertyId).length > 0, "TitleNFT: Property ID cannot be empty");
        require(assessedValue > 0, "TitleNFT: Assessed value must be greater than 0");

        tokenId = _nextTokenId++;
        _propertyIdExists[propertyId] = true;

        _titleMetadata[tokenId] = TitleMetadata({
            propertyId: propertyId,
            legalDescription: legalDescription,
            assessedValue: assessedValue,
            jurisdiction: jurisdiction,
            documentHash: documentHash,
            isVerified: false
        });

        _safeMint(to, tokenId);
        emit TitleMinted(tokenId, to, propertyId);
    }

    function verifyTitle(uint256 tokenId) external onlyRole(VERIFIER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "TitleNFT: Token does not exist");
        require(!_titleMetadata[tokenId].isVerified, "TitleNFT: Title already verified");

        _titleMetadata[tokenId].isVerified = true;
        emit TitleVerified(tokenId, msg.sender);
    }

    function updateMetadata(uint256 tokenId, bytes32 newDocumentHash) external onlyRole(METADATA_UPDATER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "TitleNFT: Token does not exist");
        
        _titleMetadata[tokenId].documentHash = newDocumentHash;
        emit MetadataUpdated(tokenId, newDocumentHash);
    }

    function getTitleMetadata(uint256 tokenId) external view returns (TitleMetadata memory) {
        require(_ownerOf(tokenId) != address(0), "TitleNFT: Token does not exist");
        return _titleMetadata[tokenId];
    }

    function isVerified(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "TitleNFT: Token does not exist");
        return _titleMetadata[tokenId].isVerified;
    }

    function linkToFractionalProperty(uint256 tokenId, uint256 fractionalTokenId) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_ownerOf(tokenId) != address(0), "TitleNFT: Token does not exist");
        // Additional logic to link title NFT with fractional property token
        emit TitleLinkedToFractional(tokenId, fractionalTokenId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        onlyAllowedTransfer(_ownerOf(tokenId), to, tokenId)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl, IERC165)
        returns (bool)
    {
        return interfaceId == type(ITitleNFT).interfaceId || super.supportsInterface(interfaceId);
    }
}