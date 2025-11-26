// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC165.sol";

/**
 * @title ITBAAccount
 * @notice Interface for ERC-6551 Token Bound Accounts with withdrawal policies
 */
interface ITBAAccount is IERC165 {
    struct WithdrawalPolicy {
        bool requiresVoucher;
        uint256 cooldownPeriod;
        uint256 maxWithdrawalAmount;
        address[] authorizedSigners;
    }

    struct Voucher {
        address account;
        address recipient;
        uint256 amount;
        address token;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    event WithdrawalRequested(address indexed account, address indexed recipient, uint256 amount);
    event WithdrawalExecuted(address indexed account, address indexed recipient, uint256 amount);
    event PolicyUpdated(address indexed account, WithdrawalPolicy policy);

    function executeWithVoucher(Voucher calldata voucher) external;
    function requestWithdrawal(address token, uint256 amount) external;
    function executeWithdrawal(address token, uint256 amount) external;
    function updateWithdrawalPolicy(WithdrawalPolicy calldata policy) external;
    function getWithdrawalPolicy() external view returns (WithdrawalPolicy memory);
}
