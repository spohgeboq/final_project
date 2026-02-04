const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy RewardToken
  const RewardToken = await hre.ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy();
  await rewardToken.waitForDeployment();
  const rewardTokenAddress = await rewardToken.getAddress();
  console.log("RewardToken deployed to:", rewardTokenAddress);

  // 2. Deploy Crowdfunding
  const Crowdfunding = await hre.ethers.getContractFactory("Crowdfunding");
  const crowdfunding = await Crowdfunding.deploy(rewardTokenAddress);
  await crowdfunding.waitForDeployment();
  const crowdfundingAddress = await crowdfunding.getAddress();
  console.log("Crowdfunding deployed to:", crowdfundingAddress);

  // 3. Authorize Crowdfunding contract to mint RewardToken
  console.log("Authorizing Crowdfunding contract to mint tokens...");
  const tx = await rewardToken.setCrowdfundingContract(crowdfundingAddress);
  await tx.wait();
  console.log("Authorization successful.");

  // Save ABI and Address for Frontend
  saveFrontendFiles(rewardTokenAddress, crowdfundingAddress);
}

function saveFrontendFiles(rewardTokenAddress, crowdfundingAddress) {
  const contractsDir = path.join(__dirname, "..", "..", "frontend");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  const config = {
    RewardToken: rewardTokenAddress,
    Crowdfunding: crowdfundingAddress,
  };

  fs.writeFileSync(
    path.join(contractsDir, "contract-address.json"),
    JSON.stringify(config, undefined, 2),
  );

  const RewardTokenArtifact = artifacts.readArtifactSync("RewardToken");
  const CrowdfundingArtifact = artifacts.readArtifactSync("Crowdfunding");

  fs.writeFileSync(
    path.join(contractsDir, "RewardToken.json"),
    JSON.stringify(RewardTokenArtifact, null, 2),
  );

  fs.writeFileSync(
    path.join(contractsDir, "Crowdfunding.json"),
    JSON.stringify(CrowdfundingArtifact, null, 2),
  );

  console.log("Frontend files saved to:", contractsDir);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
