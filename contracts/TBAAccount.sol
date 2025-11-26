// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITBAAccount.sol";

/**
 * @title TBAAccount
 * @notice ERC-6551 Token Bound Account with withdrawal policies and voucher system
 */
contract TBAAccount is ITBAAccount, EIP712, ReentrancyGuard {
    using ECDSA for bytes32;

    uint256 public state;
    WithdrawalPolicy private _withdrawalPolicy;
    mapping(uint256 => bool) private _usedNonces;
    mapping(address => uint256) private _withdrawalRequests;

    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "Voucher(address account,address recipient,uint256 amount,address token,uint256 nonce,uint256 deadline)"
    );

    modifier onlyOwner() {
        require(owner() == msg.sender, "TBAAccount: Not the owner");
        _;
    }

    modifier onlyAuthorizedSigner() {
        bool isAuthorized = false;
        for (uint i = 0; i < _withdrawalPolicy.authorizedSigners.length; i++) {
            if (_withdrawalPolicy.authorizedSigners[i] == msg.sender) {
                isAuthorized = true;
                break;
            }
        }
        require(isAuthorized || owner() == msg.sender, "TBAAccount: Not authorized");
        _;
    }

    constructor() EIP712("TBAAccount", "1") {
        // Initialize default withdrawal policy
        _withdrawalPolicy = WithdrawalPolicy({
            requiresVoucher: true,
            cooldownPeriod: 24 hours,
            maxWithdrawalAmount: type(uint256).max,
            authorizedSigners: new address[](0)
        });
    }

    function executeWithVoucher(Voucher calldata voucher) external nonReentrant {
        require(voucher.account == address(this), "TBAAccount: Invalid account");
        require(voucher.deadline >= block.timestamp, "TBAAccount: Voucher expired");
        require(!_usedNonces[voucher.nonce], "TBAAccount: Nonce already used");
        require(voucher.amount <= _withdrawalPolicy.maxWithdrawalAmount, "TBAAccount: Amount exceeds limit");

        bytes32 structHash = keccak256(abi.encode(
            VOUCHER_TYPEHASH,
            voucher.account,
            voucher.recipient,
            voucher.amount,
            voucher.token,
            voucher.nonce,
            voucher.deadline
        ));

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(voucher.signature);

        bool isAuthorizedSigner = false;
        for (uint i = 0; i < _withdrawalPolicy.authorizedSigners.length; i++) {
            if (_withdrawalPolicy.authorizedSigners[i] == signer) {
                isAuthorizedSigner = true;
                break;
            }
        }
        require(isAuthorizedSigner || signer == owner(), "TBAAccount: Invalid signature");

        _usedNonces[voucher.nonce] = true;

        if (voucher.token == address(0)) {
            // ETH withdrawal
            require(address(this).balance >= voucher.amount, "TBAAccount: Insufficient balance");
            payable(voucher.recipient).transfer(voucher.amount);
        } else {
            // ERC20 withdrawal
            IERC20(voucher.token).transfer(voucher.recipient, voucher.amount);
        }

        emit WithdrawalExecuted(address(this), voucher.recipient, voucher.amount);
    }

    function requestWithdrawal(address tokenAddress, uint256 amount) external onlyOwner {
        require(amount <= _withdrawalPolicy.maxWithdrawalAmount, "TBAAccount: Amount exceeds limit");

        _withdrawalRequests[tokenAddress] = block.timestamp;
        emit WithdrawalRequested(address(this), msg.sender, amount);
    }

    function executeWithdrawal(address tokenAddress, uint256 amount) external onlyOwner nonReentrant {
        if (_withdrawalPolicy.requiresVoucher) {
            revert("TBAAccount: Voucher required for withdrawal");
        }

        require(_withdrawalRequests[tokenAddress] != 0, "TBAAccount: No withdrawal request");
        require(
            block.timestamp >= _withdrawalRequests[tokenAddress] + _withdrawalPolicy.cooldownPeriod,
            "TBAAccount: Cooldown period not met"
        );
        require(amount <= _withdrawalPolicy.maxWithdrawalAmount, "TBAAccount: Amount exceeds limit");

        delete _withdrawalRequests[tokenAddress];

        if (tokenAddress == address(0)) {
            // ETH withdrawal
            require(address(this).balance >= amount, "TBAAccount: Insufficient balance");
            payable(msg.sender).transfer(amount);
        } else {
            // ERC20 withdrawal
            IERC20 erc20Token = IERC20(tokenAddress);
            erc20Token.transfer(msg.sender, amount);
        }

        emit WithdrawalExecuted(address(this), msg.sender, amount);
    }

    function updateWithdrawalPolicy(WithdrawalPolicy calldata policy) external onlyOwner {
        _withdrawalPolicy = policy;
        emit PolicyUpdated(address(this), policy);
    }

    function getWithdrawalPolicy() external view returns (WithdrawalPolicy memory) {
        return _withdrawalPolicy;
    }

    function owner() public view returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        if (chainId != block.chainid) return address(0);
        return IERC721(tokenContract).ownerOf(tokenId);
    }

    function token() public view returns (uint256, address, uint256) {
        bytes memory footer = new bytes(0x60);
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(ITBAAccount).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    receive() external payable {}
}
