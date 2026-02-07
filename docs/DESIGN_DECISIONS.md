


# Design & Implementation Decisions

This section explains the main design and implementation choices in the project.

## Technology stack
- **Solidity** — smart contracts
- **Hardhat** — local blockchain + deployment scripts
- **Vanilla JavaScript + HTML/CSS** — frontend
- **MetaMask** — wallet connection + transaction signing

## Core design decisions

### 1) Two-contract separation
We use two contracts to keep responsibilities separated:
- **Crowdfunding.sol** handles campaigns, ETH contributions, tracking, and finalization.
- **RewardToken.sol (ERC-20, CWD)** handles token behavior and minting.

This makes the logic easier to understand, test, and explain during defense.

### 2) Local-first demo environment
For defense, the project is designed to run on a **local Hardhat network**:
- predictable accounts and balances
- fast testing
- no external dependencies (faucets/RPC issues)

(Optional) the same approach can be used on a testnet by deploying there and updating frontend artifacts.

### 3) Reward mechanism (proof token)
Contributors receive **CWD** tokens to represent participation.
- Tokens are used as a **proof-of-contribution** only.
- They have **no real monetary value** in the course/demo context.

Reward rule used in this project:
- **100 CWD per 1 ETH contributed**  
(This rate is a simple fixed ratio chosen for clarity and easy verification in demo.)

### 4) Restricted minting (access control)
Minting CWD must be restricted to prevent arbitrary token creation.
Expected approach:
- Only **Crowdfunding** (or an authorized role/owner) can mint reward tokens.

### 5) Accurate contribution tracking
The crowdfunding contract tracks each contributor’s amount per campaign to satisfy “individual contributions” tracking.
Typical implementation:
- a mapping structure (per campaign → per contributor → contributed amount), or an equivalent clear data model.

### 6) Finalization after deadline
Campaigns have a **deadline**.
- Contributions are accepted only before the deadline.
- After the deadline, the campaign can be **finalized** once.
- Finalization updates status and runs the settlement logic (demo logic: transfer raised ETH to campaign creator).

### 7) MetaMask-based interaction
All user actions requiring state changes are performed via MetaMask:
- frontend requests wallet connection
- user signs transactions in MetaMask
- blockchain executes contract code
This matches real-world DApp interaction patterns.
