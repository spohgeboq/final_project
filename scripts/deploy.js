const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting deployment...\n");

    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // 1. Deploy RewardToken
    console.log("1️⃣ Deploying RewardToken...");
    const RewardToken = await ethers.getContractFactory("RewardToken");
    const rewardToken = await RewardToken.deploy();
    await rewardToken.waitForDeployment();
    const rewardTokenAddress = await rewardToken.getAddress();
    console.log("✅ RewardToken deployed to:", rewardTokenAddress);

    // 2. Deploy Crowdfunding with RewardToken address
    console.log("\n2️⃣ Deploying Crowdfunding...");
    const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    const crowdfunding = await Crowdfunding.deploy(rewardTokenAddress);
    await crowdfunding.waitForDeployment();
    const crowdfundingAddress = await crowdfunding.getAddress();
    console.log("✅ Crowdfunding deployed to:", crowdfundingAddress);

    // 3. Set Crowdfunding contract in RewardToken (so it can mint)
    console.log("\n3️⃣ Setting Crowdfunding contract in RewardToken...");
    const tx = await rewardToken.setCrowdfundingContract(crowdfundingAddress);
    await tx.wait();
    console.log("✅ Crowdfunding authorized to mint tokens");

    // 4. Save addresses to frontend
    const addresses = {
        RewardToken: rewardTokenAddress,
        Crowdfunding: crowdfundingAddress
    };

    const frontendPath = path.join(__dirname, "../frontend/contract-address.json");
    fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2));
    console.log("\n📁 Addresses saved to:", frontendPath);

    // 5. Copy ABIs to frontend
    const artifactsPath = path.join(__dirname, "../contracts/artifacts/contracts/contracts");

    // Crowdfunding ABI
    const crowdfundingArtifact = JSON.parse(
        fs.readFileSync(path.join(artifactsPath, "Crowdfunding.sol/Crowdfunding.json"))
    );
    fs.writeFileSync(
        path.join(__dirname, "../frontend/Crowdfunding.json"),
        JSON.stringify(crowdfundingArtifact, null, 2)
    );

    // RewardToken ABI
    const rewardTokenArtifact = JSON.parse(
        fs.readFileSync(path.join(artifactsPath, "RewardToken.sol/RewardToken.json"))
    );
    fs.writeFileSync(
        path.join(__dirname, "../frontend/RewardToken.json"),
        JSON.stringify(rewardTokenArtifact, null, 2)
    );

    console.log("📁 ABIs copied to frontend folder");

    console.log("\n" + "=".repeat(50));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(50));
    console.log("\n📋 Contract Addresses:");
    console.log("   RewardToken:", rewardTokenAddress);
    console.log("   Crowdfunding:", crowdfundingAddress);
    console.log("\n🌐 Frontend files updated automatically!");
    console.log("🔄 Refresh your browser to use the new contracts.\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
