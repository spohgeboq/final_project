// File: frontend/app.js

const CONTRACT_ADDRESS_FILE = "contract-address.json";
const CROWDFUNDING_ABI_FILE = "Crowdfunding.json";
const REWARD_TOKEN_ABI_FILE = "RewardToken.json";

let provider;
let signer;
let crowdfundingContract;
let rewardTokenContract;
let userAddress;
let crowdfundingAddress;
let rewardTokenAddress;

const connectWalletBtn = document.getElementById("connectWalletBtn");
const walletDetails = document.getElementById("walletDetails");
const createCampaignForm = document.getElementById("createCampaignForm");
const campaignsList = document.getElementById("campaignsList");

// Initialize
async function init() {
  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
  } else {
    alert("Please install MetaMask!");
  }
}

// Connect Wallet
connectWalletBtn.addEventListener("click", async () => {
  if (!provider) return;
  try {
    const accounts = await provider.send("eth_requestAccounts", []);
    userAddress = accounts[0];
    signer = await provider.getSigner();

    await loadContracts();
    await updateUI();

    connectWalletBtn.classList.add("hidden");
    walletDetails.classList.remove("hidden");
  } catch (error) {
    console.error("Connection error:", error);
  }
});

async function loadContracts() {
  try {
    // Fetch addresses
    const responseAddr = await fetch(CONTRACT_ADDRESS_FILE);
    const addresses = await responseAddr.json();
    crowdfundingAddress = addresses.Crowdfunding;
    rewardTokenAddress = addresses.RewardToken;

    // Fetch ABIs
    const responseCrowd = await fetch(CROWDFUNDING_ABI_FILE);
    const crowdArtifact = await responseCrowd.json();

    const responseToken = await fetch(REWARD_TOKEN_ABI_FILE);
    const tokenArtifact = await responseToken.json();

    crowdfundingContract = new ethers.Contract(
      crowdfundingAddress,
      crowdArtifact.abi,
      signer,
    );
    rewardTokenContract = new ethers.Contract(
      rewardTokenAddress,
      tokenArtifact.abi,
      signer,
    );

    console.log("Contracts loaded");
    loadCampaigns();
  } catch (error) {
    console.error("Failed to load contracts:", error);
    alert(
      "Error loading contract data. Make sure you have deployed the contracts and running a local server (or using file protocol correctly).",
    );
  }
}

async function updateUI() {
  document.getElementById("userAddress").textContent =
    userAddress.substring(0, 6) + "..." + userAddress.substring(38);

  const network = await provider.getNetwork();
  document.getElementById("networkName").textContent =
    network.name + ` (Chain ID: ${network.chainId})`;

  const ethBalance = await provider.getBalance(userAddress);
  document.getElementById("ethBalance").textContent =
    ethers.formatEther(ethBalance);

  if (rewardTokenContract) {
    const tokenBalance = await rewardTokenContract.balanceOf(userAddress);
    document.getElementById("tokenBalance").textContent =
      ethers.formatEther(tokenBalance);
  }
}

// Create Campaign
createCampaignForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!crowdfundingContract) return;

  const title = document.getElementById("title").value;
  const goal = document.getElementById("goal").value;
  const duration = document.getElementById("duration").value;

  const goalWei = ethers.parseEther(goal);

  try {
    const tx = await crowdfundingContract.createCampaign(
      title,
      goalWei,
      duration,
    );
    alert("Transaction sent! Waiting for confirmation...");
    await tx.wait();
    alert("Campaign Created!");
    loadCampaigns(); // Refresh list
  } catch (error) {
    console.error(error);
    alert("Error creating campaign: " + error.message);
  }
});

// Load and Display Campaigns
async function loadCampaigns() {
  if (!crowdfundingContract) return;

  campaignsList.innerHTML = "Loading...";

  try {
    const count = await crowdfundingContract.campaignCount();
    campaignsList.innerHTML = ""; // Clear

    for (let i = 0; i < count; i++) {
      const campaign = await crowdfundingContract.campaigns(i);
      // Struct: campaignId, title, creator, fundingGoal, deadline, totalRaised, finalized

      const id = campaign[0]; // campaignId (depending on return format, ethers usually returns Result object/array)
      const title = campaign[1];
      const creator = campaign[2];
      const goal = campaign[3];
      const deadline = campaign[4];
      const raised = campaign[5];
      const finalized = campaign[6];

      const now = Math.floor(Date.now() / 1000);
      const isExpired = now >= Number(deadline);
      let statusClass = finalized
        ? "status-ended"
        : isExpired
          ? "status-ended"
          : "status-active";
      let statusText = finalized
        ? "Finalized"
        : isExpired
          ? "Ended (Not Finalized)"
          : "Active";

      const card = document.createElement("div");
      card.className = "campaign-card";

      const progress = (Number(raised) / Number(goal)) * 100;

      card.innerHTML = `
                <h3>${title} (ID: ${id})</h3>
                <span class="campaign-status ${statusClass}">${statusText}</span>
                <p><strong>Goal:</strong> ${ethers.formatEther(goal)} ETH</p>
                <p><strong>Raised:</strong> ${ethers.formatEther(raised)} ETH</p>
                <div class="progress-bar"><div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div></div>
                <p><strong>Deadline:</strong> ${new Date(Number(deadline) * 1000).toLocaleString()}</p>
                
                ${
                  !isExpired && !finalized
                    ? `
                    <div class="contribute-box">
                        <input type="number" step="0.01" placeholder="Amount (ETH)" id="contributeAmount-${id}">
                        <button onclick="contribute(${id})">Contribute</button>
                    </div>
                `
                    : ""
                }

                ${
                  isExpired && !finalized
                    ? `
                     <button onclick="finalize(${id})">Finalize Campaign</button>
                `
                    : ""
                }
            `;
      campaignsList.appendChild(card);
    }
  } catch (error) {
    console.error(error);
    campaignsList.innerHTML = "Error loading campaigns.";
  }
}

// Global functions for inline onclick handlers
window.contribute = async (id) => {
  const amountInput = document.getElementById(`contributeAmount-${id}`);
  const amount = amountInput.value;
  if (!amount) return alert("Enter amount");

  try {
    const tx = await crowdfundingContract.contribute(id, {
      value: ethers.parseEther(amount),
    });
    alert("Contribution sent! Waiting for confirmation...");
    await tx.wait();
    alert("Contribution successful! Token rewards minted.");
    updateUI(); // Update balances
    loadCampaigns(); // Refresh campaign data
  } catch (error) {
    console.error(error);
    alert("Error contributing: " + error.message);
  }
};

window.finalize = async (id) => {
  try {
    const tx = await crowdfundingContract.finalizeCampaign(id);
    alert("Finalization sent! Waiting for confirmation...");
    await tx.wait();
    alert("Campaign Finalized!");
    loadCampaigns();
  } catch (error) {
    console.error(error);
    alert("Error finalizing: " + error.message);
  }
};

init();
