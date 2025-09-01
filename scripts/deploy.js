import hre from "hardhat";
const { ethers } = hre;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("🚀 Deploying FHECounter contract...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  // Get account balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  
  // Deploy the contract
  const FHECounter = await ethers.getContractFactory("FHECounter");
  const fheCounter = await FHECounter.deploy();
  
  // Wait for deployment
  await fheCounter.waitForDeployment();
  const contractAddress = await fheCounter.getAddress();
  
  console.log("✅ FHECounter deployed to:", contractAddress);
  console.log("🔗 Transaction hash:", fheCounter.deploymentTransaction().hash);
  
  // Get network info
  const network = await deployer.provider.getNetwork();
  console.log("🌐 Network:", network.name, "| Chain ID:", network.chainId.toString());
  
  // Generate Etherscan link
  if (network.chainId === 11155111n) {
    console.log("🔍 Etherscan:", `https://sepolia.etherscan.io/address/${contractAddress}`);
    console.log("📊 Transactions:", `https://sepolia.etherscan.io/address/${contractAddress}#internaltx`);
  } else if (network.chainId === 1n) {
    console.log("🔍 Etherscan:", `https://etherscan.io/address/${contractAddress}`);
  }
  
  // Save deployment info
  const deploymentInfo = {
    contractAddress,
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    transactionHash: fheCounter.deploymentTransaction().hash,
    timestamp: new Date().toISOString(),
    etherscanUrl: network.chainId === 11155111n 
      ? `https://sepolia.etherscan.io/address/${contractAddress}`
      : network.chainId === 1n 
      ? `https://etherscan.io/address/${contractAddress}`
      : null
  };
  
  // Write deployment info to file
  
  const deployDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }
  
  const deployFile = path.join(deployDir, `FHECounter-${network.chainId}.json`);
  fs.writeFileSync(deployFile, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("💾 Deployment info saved to:", deployFile);
  
  return {
    contract: fheCounter,
    address: contractAddress,
    deploymentInfo
  };
}

// Export the main function
export default main;