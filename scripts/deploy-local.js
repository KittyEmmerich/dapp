import hre from "hardhat";

async function main() {
  console.log("🚀 部署FHE合约到本地Hardhat网络...");

  // 获取部署账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  // 部署FHECounter合约
  console.log("部署FHECounter合约...");
  const FHECounter = await hre.ethers.getContractFactory("FHECounter");
  const fheCounter = await FHECounter.deploy();
  
  await fheCounter.waitForDeployment();
  const contractAddress = await fheCounter.getAddress();

  console.log("✅ FHECounter合约已部署到:", contractAddress);
  console.log("🔗 部署交易哈希:", fheCounter.deploymentTransaction().hash);

  // 测试合约功能
  console.log("\n🧪 测试合约功能...");
  const initialCount = await fheCounter.getOperationCount();
  console.log("初始操作计数:", initialCount.toString());

  const countHandle = await fheCounter.getCount();
  console.log("计数器句柄:", countHandle);

  const currentValue = await fheCounter.getCurrentValue();
  console.log("当前计数值:", currentValue.toString());

  console.log(`\n✅ 部署成功！请在前端中使用合约地址: ${contractAddress}`);
  
  return {
    address: contractAddress,
    contract: fheCounter
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });