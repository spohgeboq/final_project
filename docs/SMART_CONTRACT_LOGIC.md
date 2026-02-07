# Smart Contract Logic

This project uses two Solidity smart contracts:
- `Crowdfunding.sol`
- `RewardToken.sol` (ERC-20, CWD)

The contracts implement the required crowdfunding flow:
- create campaigns (title, goal, duration/deadline)
- contribute test ETH to active campaigns
- track individual contributions
- finalize campaigns after the deadline
- issue reward tokens proportional to contributions

---

## 1) Crowdfunding.sol

### Purpose
`Crowdfunding.sol` manages crowdfunding campaigns and all ETH-related logic.

### Main responsibilities
1) **Campaign creation**
- A campaign is created with:
  - **title**
  - **funding goal (ETH)**
  - **duration or deadline**
- The contract stores campaign metadata and initializes its state (active / not finalized).

2) **Contributions (payable)**
- Users can contribute **test ETH** to an active campaign.
- The contract:
  - receives ETH (`payable`)
  - updates the campaign’s total raised amount
  - tracks how much each address contributed (individual tracking)

3) **Accurate tracking of individual contributions**
- The contract keeps per-campaign contribution totals per address.
- Typical implementation is a nested mapping (conceptually):
  - `contributions[campaignId][contributor] += msg.value`
- This allows the project to demonstrate that every contributor’s amount is recorded separately.

4) **Finalization**
- After the campaign’s deadline, the campaign can be finalized.
- Finalization:
  - changes campaign status to finalized (prevents repeated finalization)
  - executes settlement logic (course/demo logic: transfer raised ETH to the creator)

### Expected checks (high-level)
- createCampaign: validate inputs (non-empty title / non-zero goal / reasonable duration)
- contribute:
  - campaign exists
  - campaign is active (not finalized)
  - current time is before deadline
  - contribution amount > 0
- finalize:
  - current time is after deadline
  - campaign not finalized yet

---

## 2) RewardToken.sol (ERC-20: CWD)

### Purpose
`RewardToken.sol` is a custom ERC-20 token used only as an internal reward/proof token.

### Minting rule (proportional rewards)
- The project mints CWD **proportional** to the ETH contribution.
- Example fixed rate used in this project:
  - **1 ETH contributed → 100 CWD minted**

### Automatic minting on participation
- When a user contributes, the crowdfunding contract triggers minting of CWD to that contributor.
- This demonstrates “minted automatically during user participation”.

### No real monetary value (educational token)
- CWD is used only for educational/demo purposes.
- It has no real monetary value.

### Access control (important)
- Minting must be restricted so users cannot mint tokens themselves.
- The expected approach:
  - only the Crowdfunding contract (or an owner/admin role controlled by the project) can mint.

---

## 3) End-to-end contract flow (short)
1) User calls **create campaign** → campaign stored on-chain
2) Another user calls **contribute** (payable ETH) → contribution recorded + CWD minted
3) After deadline, user calls **finalize** → campaign marked finalized + settlement executed
