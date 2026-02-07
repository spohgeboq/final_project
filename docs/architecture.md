## Architecture

This DApp has three layers: **Frontend**, **Ethereum network**, and **Smart Contracts**, plus a small **deployment pipeline** that connects everything.

### 1) Frontend (Vanilla JS + MetaMask)
- The frontend is a static website in `frontend/`.
- It connects to the user wallet using MetaMask (`window.ethereum`).
- It performs two types of operations:
  - **Read-only calls** (no gas): load campaigns, read campaign status, read token balance, etc.
  - **Transactions** (gas): create campaign, contribute ETH, finalize campaign.
- The frontend does not hardcode ABIs/addresses. It loads them from JSON files generated after deployment (see below).

### 2) Blockchain / Network
- During development/defense the project runs on a **local Hardhat node** (`npx hardhat node`).
- MetaMask is configured to use Localhost RPC (`http://127.0.0.1:8545`) and a prefunded Hardhat account.
- (Optional) the same flow can work on a testnet if contracts are deployed there and the frontend artifacts are updated.

### 3) Smart Contracts (Solidity)
**Crowdfunding.sol**
- Stores campaign data (creator, goal, deadline, raised amount, status).
- Accepts ETH contributions (`payable`), updates raised amount and contributor state.
- After the deadline, allows finalization and performs the final action (demo logic: transfer funds to creator / mark finalized).

**RewardToken.sol (ERC-20, CWD)**
- Standard ERC-20 token used as a reward/proof token.
- Minting is restricted (intended to be called by Crowdfunding or an authorized role).
- Reward rule: when a user contributes ETH, the system mints **CWD** to the contributor (example rate used in this project: **100 CWD per 1 ETH**).

### 4) Deployment pipeline (Hardhat)
- Contracts are deployed using `contracts/scripts/deploy.js`.
- The deploy script:
  1) deploys `RewardToken`
  2) deploys `Crowdfunding` (linked to the token contract if required)
  3) exports frontend artifacts so the UI can interact with the deployed contracts

Generated files in `frontend/` after deployment:
- `frontend/contract-address.json` — deployed contract addresses
- `frontend/Crowdfunding.json` — ABI for Crowdfunding
- `frontend/RewardToken.json` — ABI for RewardToken

### Runtime flow (end-to-end)
1. User opens the frontend and connects MetaMask.
2. Frontend loads ABI + addresses from the generated JSON files.
3. When the user creates a campaign, the frontend sends a signed transaction via MetaMask → Crowdfunding contract stores the campaign on-chain.
4. When the user contributes, the frontend sends a payable transaction → Crowdfunding records ETH contribution and triggers minting of CWD in RewardToken.
5. After the deadline, the user finalizes → Crowdfunding updates the campaign state and executes the finalize logic (demo).
