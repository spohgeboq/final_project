# Frontend-to-Blockchain Interaction (MetaMask)

This document explains how the frontend communicates with the smart contracts using MetaMask.

## Overview
- The frontend is a static website located in `frontend/`.
- The user interacts with the UI (buttons/forms).
- MetaMask is used for:
  - requesting wallet permission (connecting an account)
  - signing and sending transactions
  - providing the provider (RPC connection) to the selected network (localhost/testnet)

## 1) Wallet connection (MetaMask permission)
When the user clicks "Connect Wallet", the frontend:
1. Detects MetaMask provider (`window.ethereum`).
2. Requests account access.
3. After the user approves, the frontend receives the active account address.

Result:
- The UI displays the connected wallet address.
- The UI can now call contracts and send transactions using the connected account.

## 2) Network / chain selection (test network)
This project is intended for test networks:
- Local Hardhat network for defense (recommended), or
- A public testnet (optional)

For defense on localhost, MetaMask should be configured to:
- RPC: `http://127.0.0.1:8545`
- Chain ID: `31337` (sometimes `1337`)

## 3) Loading contract addresses + ABI (how the UI knows what to call)
The frontend does not hardcode contract addresses/ABIs.

After deployment, the Hardhat deploy script writes these files into `frontend/`:
- `frontend/contract-address.json` (contract addresses)
- `frontend/Crowdfunding.json` (ABI for Crowdfunding)
- `frontend/RewardToken.json` (ABI for RewardToken)

Frontend flow:
1. Load addresses from `contract-address.json`.
2. Load ABI from `Crowdfunding.json` and `RewardToken.json`.
3. Create contract instances (via ethers.js / web3.js depending on implementation).

If these files are missing or outdated, the frontend cannot interact with the contracts.

## 4) Read operations vs transactions

### A) Read-only calls (no gas)
Used to display state, for example:
- list campaigns
- campaign status (goal, deadline, raised amount)
- user token balance (CWD)
- user ETH balance (wallet balance from provider)

These calls do not modify blockchain state and do not require MetaMask confirmation.

### B) Transactions (require gas + MetaMask confirmation)
Used to modify state, requires user signature in MetaMask:
- Create campaign (calls Crowdfunding create function)
- Contribute ETH (payable call, includes `value` in ETH)
- Finalize campaign (calls finalize function)

MetaMask will display a confirmation popup for each transaction.

## 5) Mapping UI actions to smart contract actions (conceptual)
Typical UI buttons -> blockchain actions:

1) "Create Campaign"
- Sends a transaction to Crowdfunding:
  - inputs: title, goal, duration/deadline
- After mined, UI refreshes campaigns list.

2) "Contribute"
- Sends a payable transaction to Crowdfunding:
  - input: campaignId (or equivalent)
  - value: ETH amount selected by user
- After mined:
  - contribution is recorded on-chain
  - reward tokens are minted to contributor in RewardToken (via Crowdfunding logic)

3) "Finalize"
- Sends a transaction to Crowdfunding:
  - input: campaignId
- Allowed only after deadline; marks finalized and executes settlement (demo logic).

## 6) What to show in UI (proof during defense)
Frontend should display:
- Connected wallet address
- ETH balance (wallet balance)
- CWD token balance (`balanceOf(user)`)

This makes it easy to prove:
- wallet is connected
- transactions happened
- reward minting works after contribution

## 7) Simple error handling
Common cases:
- MetaMask not installed -> show "Install MetaMask"
- User rejects connection/transaction -> show "Transaction rejected"
- Wrong network selected -> show "Switch to Localhost 8545 / correct testnet"
- Missing frontend JSON artifacts -> show "Deploy contracts first"
