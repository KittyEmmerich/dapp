// FHE SDK Types
export interface FhevmRelayerSDKType {
  initSDK: (config: any) => Promise<void>;
  createInstance: (config: any) => Promise<any>;
  SepoliaConfig: {
    chainId: number;
    rpcUrl: string;
    relayerUrl: string;
    [key: string]: any;
  };
  __initialized__?: boolean;
  [key: string]: any;
}

export interface FhevmWindowType extends Window {
  relayerSDK: FhevmRelayerSDKType;
}

export interface FhevmInstance {
  encrypt32: (value: number) => Uint8Array;
  encrypt64: (value: bigint) => Uint8Array;
  encryptBool: (value: boolean) => Uint8Array;
  getPublicKey: () => Promise<string>;
  createEIP712: (contract: string, functionName: string) => any;
  generateToken: (publicKey: string) => Promise<string>;
  [key: string]: any;
}

export interface CreateFhevmInstanceOptions {
  chainId?: number;
  publicKeyOrAddress?: string;
  kmsContractAddress?: string;
  aclContractAddress?: string;
  provider?: any;
  mockChains?: Record<number, string>;
  signal?: AbortSignal;
  onStatusChange?: (status: string) => void;
}