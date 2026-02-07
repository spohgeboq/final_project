// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RewardToken.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// File: contracts/contracts/Crowdfunding.sol
contract Crowdfunding is ReentrancyGuard {
    struct Campaign {
        uint256 campaignId;
        string title;
        address creator;
        uint256 fundingGoal; // in wei
        uint256 deadline; // timestamp
        uint256 totalRaised; // in wei
        bool finalized;
        bool deleted; // Soft delete flag
    }

    // State variables
    RewardToken public rewardToken;
    uint256 public constant REWARD_RATE = 100; // 1 ETH = 100 Tokens
    uint256 public campaignCount;

    // Mapping from campaignId to Campaign
    mapping(uint256 => Campaign) public campaigns;
    // Mapping from campaignId -> contributor address -> amount contributed
    mapping(uint256 => mapping(address => uint256)) public contributions;

    // Events
    event CampaignCreated(
        uint256 indexed campaignId,
        string title,
        address indexed creator,
        uint256 fundingGoal,
        uint256 deadline
    );
    event ContributionMade(
        uint256 indexed campaignId,
        address indexed contributor,
        uint256 amount
    );
    event CampaignFinalized(
        uint256 indexed campaignId,
        uint256 totalRaised,
        bool goalMet
    );
    event CampaignCancelled(
        uint256 indexed campaignId,
        address indexed creator
    );
    event TokensMinted(address indexed recipient, uint256 amount);

    constructor(address _rewardTokenAddress) {
        rewardToken = RewardToken(_rewardTokenAddress);
    }

    /**
     * @dev Creates a new crowdfunding campaign.
     * @param _title Title of the campaign.
     * @param _goalWei Funding goal in Wei.
     * @param _durationSeconds Duration of the campaign in seconds.
     */
    function createCampaign(
        string memory _title,
        uint256 _goalWei,
        uint256 _durationSeconds
    ) external {
        require(_goalWei > 0, "Goal must be greater than 0");
        require(_durationSeconds > 0, "Duration must be greater than 0");

        uint256 campaignId = campaignCount;
        uint256 deadline = block.timestamp + _durationSeconds;

        campaigns[campaignId] = Campaign({
            campaignId: campaignId,
            title: _title,
            creator: msg.sender,
            fundingGoal: _goalWei,
            deadline: deadline,
            totalRaised: 0,
            finalized: false,
            deleted: false
        });

        campaignCount++;

        emit CampaignCreated(
            campaignId,
            _title,
            msg.sender,
            _goalWei,
            deadline
        );
    }

    /**
     * @dev Contribute ETH to a campaign and receive reward tokens.
     * @param _campaignId The ID of the campaign to contribute to.
     */
    function contribute(uint256 _campaignId) external payable nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];

        require(!campaign.deleted, "Campaign has been cancelled");
        require(block.timestamp < campaign.deadline, "Campaign has ended");
        require(!campaign.finalized, "Campaign is finalized");
        require(msg.value > 0, "Contribution must be greater than 0");

        // Update campaign state
        campaign.totalRaised += msg.value;
        contributions[_campaignId][msg.sender] += msg.value;

        // Calculate reward tokens
        // RATE is 100. If user sends 1 ETH (1e18 wei), they get 100 * 1e18 tokens.
        uint256 tokenAmount = msg.value * REWARD_RATE;

        // Mint reward tokens to contributor
        // Note: Crowdfunding contract must be authorized to mint in RewardToken
        try rewardToken.mint(msg.sender, tokenAmount) {
            emit TokensMinted(msg.sender, tokenAmount);
        } catch {
            // Check if minting fails, we might want to revert the transaction or just continue without minting
            // For this requirements, likely we should revert if tokenomics fail
            revert("Token minting failed");
        }
        emit ContributionMade(_campaignId, msg.sender, msg.value);
    }

    /**
     * @dev Cancel a campaign (soft delete). Only creator can cancel, and only if no funds raised.
     * @param _campaignId The ID of the campaign to cancel.
     */
    function cancelCampaign(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];

        require(msg.sender == campaign.creator, "Only creator can cancel");
        require(!campaign.finalized, "Campaign already finalized");
        require(!campaign.deleted, "Campaign already cancelled");
        require(
            campaign.totalRaised == 0,
            "Cannot cancel: funds already raised"
        );

        campaign.deleted = true;

        emit CampaignCancelled(_campaignId, msg.sender);
    }

    /**
     * @dev Finalize the campaign after the deadline.
     * Anyone can call this to settle the campaign status.
     * @param _campaignId The ID of the campaign to finalize.
     */
    function finalizeCampaign(uint256 _campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];

        require(!campaign.deleted, "Campaign has been cancelled");
        require(
            block.timestamp >= campaign.deadline,
            "Campaign has not ended yet"
        );
        require(!campaign.finalized, "Campaign already finalized");

        campaign.finalized = true;

        // Logic for funds:
        // In this simple example, funds are held in the contract.
        // If goal met -> Transfer to creator
        // If goal not met -> Contributors could potentially withdraw (Refund logic)
        // BUT strict requirement says: "create, contribute, track, mint, finalize". Refunds are not explicitly asked for in "Major functions" but usually imply "Finalize" handles funds.
        // Given complexity constraints and "finalize" description: "Campaign marked as finished", I will implement simple fund transfer to creator if goal met, or just keep it in contract for simplicity if not specified.
        // HOWEVER, standard crowdfunding usually calls for refunds if goal not met.
        // Reading requirements carefully: "finalizeCampaign... Campaign marked as completed".
        // It doesn't explicitly demand refund logic, but "Campaign structure: finalized(bool)".
        // I will implement: If totalRaised > 0, transfer to creator. This is a "keep-it-all" model for simplicity unless specified otherwise.
        // Requirement 1: "finalize campaigns after deadline".

        // Let's safe transfer funds to creator to demonstrate "real blockchain interaction" of moving funds.
        if (campaign.totalRaised > 0) {
            (bool success, ) = campaign.creator.call{
                value: campaign.totalRaised
            }("");
            require(success, "Transfer to creator failed");
        }

        emit CampaignFinalized(
            _campaignId,
            campaign.totalRaised,
            campaign.totalRaised >= campaign.fundingGoal
        );
    }

    /**
     * @dev Helper to get campaign details.
     */
    function getCampaign(
        uint256 _campaignId
    ) external view returns (Campaign memory) {
        return campaigns[_campaignId];
    }
}
