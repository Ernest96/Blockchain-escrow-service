// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Escrow {
    struct Deal {
        address payer;
        uint64 deadline;
        address provider;
        uint256 amount;
    }

    uint256 public nextId;
    mapping(uint256 => Deal) public deals;

    function lock(
        address provider,
        uint64 deadline
    ) external payable returns (uint256 id) {
        if (msg.value == 0) revert ZeroAmount();
        if (deadline <= block.timestamp) revert DeadlineInPast();

        id = nextId++;
        deals[id] = Deal(msg.sender, deadline, provider, msg.value);
        emit Locked(id, msg.sender, provider, msg.value, deadline);
    }

    event Locked(
        uint256 indexed id,
        address indexed payer,
        address indexed provider,
        uint256 amount,
        uint64 deadline
    );

    event Claimed(uint256 indexed id, address indexed provider, uint256 amount);
    event Refunded(uint256 indexed id, address indexed payer, uint256 amount);

    error ZeroAmount();
    error DeadlineInPast();
    error UnknownDeal();
    error NotProvider();
    error NotPayer();
    error TooEarly();
    error PastDeadline();
    error TransferFailed();

    function claim(uint256 id) external {
        Deal memory d = deals[id];
        if (d.amount == 0) revert UnknownDeal();
        if (msg.sender != d.provider) revert NotProvider();
        if (block.timestamp >= d.deadline) revert PastDeadline();

        delete deals[id];
        (bool ok, ) = msg.sender.call{value: d.amount}("");
        if (!ok) revert TransferFailed();
        emit Claimed(id, d.provider, d.amount);
    }

    function refund(uint256 id) external {
        Deal memory d = deals[id];
        if (d.amount == 0) revert UnknownDeal();
        if (msg.sender != d.payer) revert NotPayer();
        if (block.timestamp < d.deadline) revert TooEarly();

        delete deals[id];
        (bool ok, ) = msg.sender.call{value: d.amount}("");
        if (!ok) revert TransferFailed();
        emit Refunded(id, d.payer, d.amount);
    }
}
