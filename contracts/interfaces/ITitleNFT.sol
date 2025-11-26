// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title ITitleNFT
 * @notice Interface for Title-backed NFTs with marketplace integration
 */
interface ITitleNFT is IERC721 {
    struct TitleMetadata {
        string propertyId;
        string legalDescription;
        uint256 assessedValue;
        string jurisdiction;
        bytes32 documentHash;
        bool isVerified;
    }

    event TitleMinted(uint256 indexed tokenId, address indexed owner, string propertyId);
    event TitleVerified(uint256 indexed tokenId, address indexed verifier);
    event MetadataUpdated(uint256 indexed tokenId, bytes32 newDocumentHash);
    event TitleLinkedToFractional(uint256 indexed tokenId, uint256 indexed fractionalTokenId);

    function mintTitle(
        address to,
        string calldata propertyId,
        string calldata legalDescription,
        uint256 assessedValue,
        string calldata jurisdiction,
        bytes32 documentHash
    ) external returns (uint256 tokenId);

    function verifyTitle(uint256 tokenId) external;
    function updateMetadata(uint256 tokenId, bytes32 newDocumentHash) external;
    function getTitleMetadata(uint256 tokenId) external view returns (TitleMetadata memory);
    function isVerified(uint256 tokenId) external view returns (bool);
}
