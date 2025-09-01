// Re-export all types from internal types
export type {
  FhevmRelayerSDKType,
  FhevmWindowType,
  FhevmInstance,
  CreateFhevmInstanceOptions
} from './internal/fhevmTypes';

// Additional utility types
export type FhevmGoState = "idle" | "loading" | "ready" | "error";

export interface FhevmHookParameters {
  provider: string | any | undefined;
  chainId: number | undefined;
  enabled?: boolean;
  initialMockChains?: Readonly<Record<number, string>>;
}

export interface FhevmHookReturn {
  instance: FhevmInstance | undefined;
  refresh: () => void;
  error: Error | undefined;
  status: FhevmGoState;
}

// Network configuration types
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  relayerUrl?: string;
  kmsContractAddress?: string;
  aclContractAddress?: string;
}

// Encryption types
export interface EncryptionResult {
  data: Uint8Array;
  handles: string[];
}

// Public key cache types
export interface PublicKeyCacheEntry {
  publicKey: string;
  timestamp: number;
  chainId: number;
  kmsAddress?: string;
}

// SDK validation result
export interface SDKValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  version?: string;
}

// Decryption signature types
export type FhevmDecryptionSignatureType = {
  publicKey: string;
  privateKey: string;
  signature: string;
  startTimestamp: number; // Unix timestamp in seconds
  durationDays: number;
  userAddress: `0x${string}`;
  contractAddresses: `0x${string}`[];
  eip712: EIP712Type;
};

export type EIP712Type = {
  domain: {
    chainId: number;
    name: string;
    verifyingContract: `0x${string}`;
    version: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: any;
  primaryType: string;
  types: {
    [key: string]: {
      name: string;
      type: string;
    }[];
  };
};

declare global {
  interface Window {
    relayerSDK?: FhevmRelayerSDKType;
  }
}