import { ethers } from "ethers";
import { RelayerSDKLoader } from "./RelayerSDKLoader";
import { PublicKeyStorage } from "./PublicKeyStorage";
import type { FhevmInstance, CreateFhevmInstanceOptions } from "./fhevmTypes";

// Sepolia network configuration
const SEPOLIA_CONFIG = {
  chainId: 11155111,
  name: "Sepolia",
  rpcUrl: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY", // Replace with actual RPC
  relayerUrl: "https://relayer.sepolia.zama.ai"
};

// Mock chains for testing
const DEFAULT_MOCK_CHAINS: Record<number, string> = {
  1337: "http://localhost:8545",
  31337: "http://localhost:8545"
};

export async function createFhevmInstance(options: CreateFhevmInstanceOptions): Promise<FhevmInstance> {
  const {
    chainId,
    provider,
    mockChains = DEFAULT_MOCK_CHAINS,
    signal,
    onStatusChange,
    publicKeyOrAddress,
    kmsContractAddress,
    aclContractAddress
  } = options;

  onStatusChange?.("Initializing FHEVM instance");

  // Check for abort signal
  if (signal?.aborted) {
    throw new Error("Operation was aborted");
  }

  // Load the Relayer SDK
  onStatusChange?.("Loading Relayer SDK");
  const sdkLoader = new RelayerSDKLoader({ 
    trace: (msg, ...params) => console.log(`[FHEVM]`, msg, ...params) 
  });

  try {
    await sdkLoader.load();
  } catch (error) {
    console.error("[FHEVM] Failed to load Relayer SDK:", error);
    throw new Error(`Failed to load FHEVM Relayer SDK: ${error.message}`);
  }

  if (signal?.aborted) {
    throw new Error("Operation was aborted");
  }

  // Get the SDK from window
  if (typeof window === "undefined" || !window.relayerSDK) {
    throw new Error("Relayer SDK not available on window object");
  }

  const relayerSDK = window.relayerSDK;
  onStatusChange?.("SDK loaded successfully");

  // Determine provider and chain ID
  let actualProvider = provider;
  let actualChainId = chainId;

  if (typeof provider === "string") {
    actualProvider = new ethers.JsonRpcProvider(provider);
  }

  if (!actualChainId && actualProvider) {
    try {
      onStatusChange?.("Detecting chain ID");
      const network = await actualProvider.getNetwork();
      actualChainId = Number(network.chainId);
      console.log(`[FHEVM] Detected chain ID: ${actualChainId}`);
    } catch (error) {
      console.warn("[FHEVM] Could not detect chain ID:", error);
    }
  }

  if (signal?.aborted) {
    throw new Error("Operation was aborted");
  }

  // Initialize PublicKey storage
  const publicKeyStorage = new PublicKeyStorage();
  await publicKeyStorage.cleanupExpiredEntries();

  // Check for cached public key
  let publicKey = publicKeyOrAddress;
  if (!publicKey && actualChainId) {
    onStatusChange?.("Checking cached public key");
    publicKey = await publicKeyStorage.getCachedPublicKey(actualChainId, kmsContractAddress);
  }

  // Configure SDK based on network
  let sdkConfig: any;

  if (actualChainId === SEPOLIA_CONFIG.chainId) {
    // Use Sepolia configuration
    onStatusChange?.("Configuring for Sepolia network");
    sdkConfig = {
      ...relayerSDK.SepoliaConfig,
      provider: actualProvider
    };
    console.log(`[FHEVM] Using Sepolia configuration`);
  } else if (mockChains && actualChainId && mockChains[actualChainId]) {
    // Use mock configuration for local development
    onStatusChange?.("Configuring for local/mock network");
    sdkConfig = {
      chainId: actualChainId,
      rpcUrl: mockChains[actualChainId],
      provider: actualProvider,
      mockMode: true
    };
    console.log(`[FHEVM] Using mock configuration for chain ${actualChainId}`);
  } else {
    // Default configuration
    onStatusChange?.("Using default configuration");
    sdkConfig = {
      chainId: actualChainId || 1337,
      provider: actualProvider,
      publicKey,
      kmsContractAddress,
      aclContractAddress
    };
  }

  if (signal?.aborted) {
    throw new Error("Operation was aborted");
  }

  // Initialize SDK
  onStatusChange?.("Initializing SDK");
  try {
    await relayerSDK.initSDK(sdkConfig);
    console.log(`[FHEVM] SDK initialized successfully`);
  } catch (error) {
    console.error("[FHEVM] Failed to initialize SDK:", error);
    throw new Error(`Failed to initialize FHEVM SDK: ${error.message}`);
  }

  if (signal?.aborted) {
    throw new Error("Operation was aborted");
  }

  // Create FHEVM instance
  onStatusChange?.("Creating FHEVM instance");
  let fhevmInstance: any;

  try {
    fhevmInstance = await relayerSDK.createInstance(sdkConfig);
    console.log(`[FHEVM] Instance created successfully`);
  } catch (error) {
    console.error("[FHEVM] Failed to create instance:", error);
    throw new Error(`Failed to create FHEVM instance: ${error.message}`);
  }

  if (signal?.aborted) {
    throw new Error("Operation was aborted");
  }

  // Get and cache public key if needed
  if (actualChainId && fhevmInstance.getPublicKey) {
    try {
      onStatusChange?.("Retrieving public key");
      const retrievedPublicKey = await fhevmInstance.getPublicKey();
      if (retrievedPublicKey && retrievedPublicKey !== publicKey) {
        await publicKeyStorage.setCachedPublicKey(actualChainId, retrievedPublicKey, kmsContractAddress);
        console.log(`[FHEVM] Public key cached for chain ${actualChainId}`);
      }
    } catch (error) {
      console.warn("[FHEVM] Could not retrieve/cache public key:", error);
    }
  }

  onStatusChange?.("FHEVM instance ready");

  // Wrap instance with additional functionality
  const wrappedInstance: FhevmInstance = {
    ...fhevmInstance,
    
    // Enhanced encryption methods with validation
    encrypt32: (value: number) => {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new Error('encrypt32 requires an integer value');
      }
      if (value < 0 || value > 0xFFFFFFFF) {
        throw new Error('encrypt32 value must be between 0 and 2^32-1');
      }
      return fhevmInstance.encrypt32(value);
    },

    encrypt64: (value: bigint) => {
      if (typeof value !== 'bigint') {
        throw new Error('encrypt64 requires a bigint value');
      }
      if (value < 0n || value > 0xFFFFFFFFFFFFFFFFn) {
        throw new Error('encrypt64 value must be between 0 and 2^64-1');
      }
      return fhevmInstance.encrypt64(value);
    },

    encryptBool: (value: boolean) => {
      if (typeof value !== 'boolean') {
        throw new Error('encryptBool requires a boolean value');
      }
      return fhevmInstance.encryptBool(value);
    },

    // Additional utility methods
    getChainId: () => actualChainId,
    isSepoliaNetwork: () => actualChainId === SEPOLIA_CONFIG.chainId,
    isMockNetwork: () => mockChains && actualChainId ? Boolean(mockChains[actualChainId]) : false,
    
    // Public key management
    getCachedPublicKey: () => publicKeyStorage.getCachedPublicKey(actualChainId!, kmsContractAddress),
    clearPublicKeyCache: () => publicKeyStorage.clearAll(),
    getPublicKeyStats: () => publicKeyStorage.getCacheStats()
  };

  console.log(`[FHEVM] Instance creation completed for chain ${actualChainId}`);
  return wrappedInstance;
}