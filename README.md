# Decentralized Crowdfunding DApp

This project is a decentralized crowdfunding application built for the Ethereum blockchain. It allows users to create campaigns, contribute ETH, and receive reward tokens (CWD) in return.

## Project Architecture

The application consists of:

1.  **Smart Contracts (Solidity)**:
    - `Crowdfunding.sol`: Manages campaigns, contributions, and finalization.
    - `RewardToken.sol`: An ERC-20 token minted as a reward for contributors.
2.  **Frontend (Vanilla JS)**: Interacts with the smart contracts via MetaMask.
3.  **Deployment Scripts (Hardhat)**: Automates the deployment and linking of contracts.

### Smart Contract Logic

- **Creating a Campaign**: Users define a title, goal, and duration.
- **Contributing**: Users send ETH. The contract records the contribution and calls the `RewardToken` contract to mint tokens to the contributor at a rate of 100 CWD per 1 ETH.
- **Finalizing**: After the deadline, the campaign can be finalized. Funds are transferred to the creator (simple logic for demonstration).
- **Tokenomics**: Reward tokens have no monetary value and serve as a proof-of-contribution mechanism.

## Prerequisites

- Node.js & npm
- MetaMask Extension

## Setup Instructions

### 1. Install Dependencies

Navigate to the root directory and install Hardhat and OpenZeppelin contracts:

```bash
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
```

### 2. Local Blockchain (Hardhat Network)

1.  Start a local blockchain node:
    ```bash
    npx hardhat node
    ```
2.  **Import Accounts to MetaMask**:
    - Copy the private keys displayed in the terminal.
    - In MetaMask, switch to "Localhost 8545" (or Add Network manually: Chain ID 1337 or 31337, RPC `http://127.0.0.1:8545`).
    - Import accounts using the private keys to have test ETH.

### 3. Deploy Contracts

In a new terminal window (keep the node running):

```bash
npx hardhat run contracts/scripts/deploy.js --network localhost
```

- This will deploy the contracts and generate `frontend/contract-address.json`, `frontend/RewardToken.json`, and `frontend/Crowdfunding.json`.

### 4. Run Frontend

Since this is a static site, you can serve it using any simple HTTP server.

- Using VS Code: Right-click `frontend/index.html` -> "Open with Live Server".
- Or use Python: `cd frontend && python -m http.server 8000` -> Go to `http://localhost:8000`.

**Note**: Opening `index.html` directly (file://) might cause CORS issues with module loading or JSON fetching in some browsers. Using a local server is recommended.

## How to Get Test ETH

- **Localhost**: You are automatically given 10000 ETH in the pre-generated accounts.
- **Sepolia Testnet**: Use a faucet like [Google Cloud Web3 Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) or [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia).

## Usage

1.  **Connect Wallet**: Click the button to connect MetaMask.
2.  **Create Campaign**: Enter details and confirm transaction.
3.  **Contribute**: Choose an active campaign and send ETH. Watch your Reward Token balance increase!
4.  **Finalize**: Once a campaign duration expires, finalize it to settle the state.
