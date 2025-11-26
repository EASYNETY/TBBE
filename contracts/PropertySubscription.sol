// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PropertySubscription is Ownable {
    struct Subscription {
        address subscriber;
        uint256 amount;
        uint256 timestamp;
    }

    mapping(uint256 => Subscription[]) public subscriptions;
    IERC20 public token;

    event Subscribed(uint256 indexed propertyId, address indexed subscriber, uint256 amount);
    event ReturnsDistributed(uint256 indexed propertyId, uint256 totalAmount);

    constructor(address _tokenAddress) Ownable(msg.sender) {
        token = IERC20(_tokenAddress);
    }

    function subscribe(uint256 propertyId, uint256 amount) external {
        require(amount > 0, "Subscription amount must be greater than 0");
        
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(allowance >= amount, "Check token allowance");

        token.transferFrom(msg.sender, address(this), amount);

        subscriptions[propertyId].push(Subscription({
            subscriber: msg.sender,
            amount: amount,
            timestamp: block.timestamp
        }));

        emit Subscribed(propertyId, msg.sender, amount);
    }

    function distributeReturns(uint256 propertyId, address[] calldata subscribers, uint256[] calldata payouts) external onlyOwner {
        require(subscribers.length == payouts.length, "Mismatched subscribers and payouts");

        uint256 totalPayout;
        for (uint256 i = 0; i < subscribers.length; i++) {
            totalPayout += payouts[i];
        }

        require(token.balanceOf(address(this)) >= totalPayout, "Insufficient balance for payouts");

        for (uint256 i = 0; i < subscribers.length; i++) {
            token.transfer(subscribers[i], payouts[i]);
        }

        emit ReturnsDistributed(propertyId, totalPayout);
    }

    function getSubscriptions(uint256 propertyId) external view returns (Subscription[] memory) {
        return subscriptions[propertyId];
    }
}
