import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const artifactsDir = path.join(rootDir, 'artifacts', 'contracts');
const deploymentDir = path.join(rootDir, 'deployments');
const outputDir = path.join(rootDir, 'abi');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function generateABI() {
  console.log('📝 Generating ABI files...');
  
  // Read the compiled contract artifact
  const contractPath = path.join(artifactsDir, 'FHECounter.sol', 'FHECounter.json');
  
  if (!fs.existsSync(contractPath)) {
    console.log('⚠️  Contract artifacts not found. Please compile first with: npx hardhat compile');
    return;
  }
  
  const artifact = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  
  // Generate ABI file
  const abiContent = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const FHECounterABI = {
  "abi": ${JSON.stringify(artifact.abi, null, 4)}
} as const;
`;

  fs.writeFileSync(path.join(outputDir, 'FHECounterABI.ts'), abiContent);
  console.log('✅ Generated FHECounterABI.ts');
}

function generateAddresses() {
  console.log('📍 Generating address files...');
  
  const addresses = {};
  
  // Read deployment files
  if (fs.existsSync(deploymentDir)) {
    const files = fs.readdirSync(deploymentDir);
    
    for (const file of files) {
      if (file.startsWith('FHECounter-') && file.endsWith('.json')) {
        const deploymentInfo = JSON.parse(
          fs.readFileSync(path.join(deploymentDir, file), 'utf8')
        );
        
        const chainId = deploymentInfo.chainId;
        const chainName = deploymentInfo.network === 'unknown' && chainId === '11155111' 
          ? 'sepolia' 
          : deploymentInfo.network;
          
        addresses[chainId] = {
          address: deploymentInfo.contractAddress,
          chainId: parseInt(chainId),
          chainName: chainName
        };
      }
    }
  }
  
  // Add default entries if missing
  if (!addresses['11155111']) {
    addresses['11155111'] = {
      address: "0x0000000000000000000000000000000000000000",
      chainId: 11155111,
      chainName: "sepolia"
    };
  }
  
  if (!addresses['31337']) {
    addresses['31337'] = {
      address: "0x0000000000000000000000000000000000000000",
      chainId: 31337,
      chainName: "hardhat"
    };
  }
  
  // Generate addresses file
  const addressContent = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const FHECounterAddresses = ${JSON.stringify(addresses, null, 2)};
`;

  fs.writeFileSync(path.join(outputDir, 'FHECounterAddresses.ts'), addressContent);
  console.log('✅ Generated FHECounterAddresses.ts');
  
  // Show current addresses
  console.log('\n📋 Current contract addresses:');
  for (const [chainId, info] of Object.entries(addresses)) {
    console.log(`  ${info.chainName} (${chainId}): ${info.address}`);
  }
}

// Main execution
try {
  generateABI();
  generateAddresses();
  console.log('\n🎉 ABI generation complete!');
} catch (error) {
  console.error('❌ ABI generation failed:', error);
  process.exit(1);
}