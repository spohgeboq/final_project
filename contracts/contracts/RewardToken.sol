// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// File: contracts/contracts/RewardToken.sol
contract RewardToken is ERC20, Ownable {
    // The address of the Crowdfunding contract allowed to mint tokens
    address public crowdfundingContract;

    constructor() ERC20("CrowdReward", "CWD") Ownable(msg.sender) {}

    /**
     * @dev Set the Crowdfunding contract address.
     * Only owner can call this.
     */
    function setCrowdfundingContract(address _crowdfundingContract) external onlyOwner {
        crowdfundingContract = _crowdfundingContract;
    }

    /**
     * @dev Mints new tokens.
     * Can only be called by the Crowdfunding contract or the owner.
     * @param to The address to receive the tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner() || msg.sender == crowdfundingContract, "RewardToken: Caller is not authorized to mint");
        _mint(to, amount);
    }
}
