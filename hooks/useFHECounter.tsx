"use client";

import { ethers } from "ethers";
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { FHECounterABI } from "@/abi/FHECounterABI";

// Use our deployed contract address
const CONTRACT_ADDRESS = "0xa6b5A73B9d064cb9C250493d3349c889DbA68487";
const SEPOLIA_CHAIN_ID = 11155111;

export type ClearValueType = {
  handle: string;
  clear: string | bigint | boolean;
};

type FHECounterInfoType = {
  abi: typeof FHECounterABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

function getFHECounterByChainId(chainId: number | undefined): FHECounterInfoType {
  if (!chainId) {
    return { abi: FHECounterABI.abi };
  }

  // For Sepolia, use our deployed contract
  if (chainId === SEPOLIA_CHAIN_ID) {
    return {
      address: CONTRACT_ADDRESS as `0x${string}`,
      chainId: SEPOLIA_CHAIN_ID,
      chainName: "Sepolia Testnet",
      abi: FHECounterABI.abi,
    };
  }

  return { abi: FHECounterABI.abi, chainId };
}

export const useFHECounter = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  eip1193Provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<
    (ethersSigner: ethers.JsonRpcSigner | undefined) => boolean
  >;
}) => {
  const {
    instance,
    fhevmDecryptionSignatureStorage,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  } = parameters;

  //////////////////////////////////////////////////////////////////////////////
  // States + Refs
  //////////////////////////////////////////////////////////////////////////////

  const [countHandle, setCountHandle] = useState<string | undefined>(undefined);
  const [clearCount, setClearCount] = useState<ClearValueType | undefined>(
    undefined
  );
  const clearCountRef = useRef<ClearValueType>(undefined);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isIncOrDec, setIsIncOrDec] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const fheCounterRef = useRef<FHECounterInfoType | undefined>(undefined);
  const isRefreshingRef = useRef<boolean>(isRefreshing);
  const isDecryptingRef = useRef<boolean>(isDecrypting);
  const isIncOrDecRef = useRef<boolean>(isIncOrDec);

  const isDecrypted = countHandle && countHandle === clearCount?.handle;

  //////////////////////////////////////////////////////////////////////////////
  // FHECounter
  //////////////////////////////////////////////////////////////////////////////

  const fheCounter = useMemo(() => {
    const c = getFHECounterByChainId(chainId);
    fheCounterRef.current = c;

    if (!c.address) {
      setMessage(`FHECounter deployment not found for chainId=${chainId}.`);
    }

    return c;
  }, [chainId]);

  //////////////////////////////////////////////////////////////////////////////
  // Count Handle
  //////////////////////////////////////////////////////////////////////////////

  const isDeployed = useMemo(() => {
    if (!fheCounter) {
      return undefined;
    }
    return (Boolean(fheCounter.address) && fheCounter.address !== ethers.ZeroAddress);
  }, [fheCounter]);

  const canGetCount = useMemo(() => {
    return fheCounter.address && ethersReadonlyProvider && !isRefreshing;
  }, [fheCounter.address, ethersReadonlyProvider, isRefreshing]);

  const refreshCountHandle = useCallback(() => {
    console.log("[useFHECounter] call refreshCountHandle()");
    if (isRefreshingRef.current) {
      return;
    }

    if (
      !fheCounterRef.current ||
      !fheCounterRef.current?.chainId ||
      !fheCounterRef.current?.address ||
      !ethersReadonlyProvider
    ) {
      setCountHandle(undefined);
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    const thisChainId = fheCounterRef.current.chainId;
    const thisFheCounterAddress = fheCounterRef.current.address;

    const thisFheCounterContract = new ethers.Contract(
      thisFheCounterAddress,
      fheCounterRef.current.abi,
      ethersReadonlyProvider
    );

    thisFheCounterContract
      .getCount()
      .then((value) => {
        console.log("[useFHECounter] getCount()=" + value);
        if (
          sameChain.current(thisChainId) &&
          thisFheCounterAddress === fheCounterRef.current?.address
        ) {
          setCountHandle(value);
        }

        isRefreshingRef.current = false;
        setIsRefreshing(false);
      })
      .catch((e) => {
        setMessage("FHECounter.getCount() call failed! error=" + e);

        isRefreshingRef.current = false;
        setIsRefreshing(false);
      });
  }, [ethersReadonlyProvider, sameChain]);

  // Auto refresh the count handle
  useEffect(() => {
    refreshCountHandle();
  }, [refreshCountHandle]);

  //////////////////////////////////////////////////////////////////////////////
  // Count Handle Decryption
  //////////////////////////////////////////////////////////////////////////////

  const canDecrypt = useMemo(() => {
    return (
      fheCounter.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isDecrypting &&
      countHandle &&
      countHandle !== ethers.ZeroHash && // fhe handle not initialized
      countHandle !== clearCount?.handle // not yet decrypted
    );
  }, [
    fheCounter.address,
    instance,
    ethersSigner,
    isRefreshing,
    isDecrypting,
    countHandle,
    clearCount,
  ]);

  const decryptCountHandle = useCallback(() => {
    if (isRefreshingRef.current || isDecryptingRef.current) {
      return;
    }

    if (!fheCounter.address || !instance || !ethersSigner) {
      return;
    }

    // Already computed
    if (countHandle === clearCountRef.current?.handle) {
      return;
    }

    if (!countHandle) {
      setClearCount(undefined);
      clearCountRef.current = undefined;
      return;
    }

    if (countHandle === ethers.ZeroHash) {
      setClearCount({ handle: countHandle, clear: BigInt(0) });
      clearCountRef.current = { handle: countHandle, clear: BigInt(0) };
      return;
    }

    const thisChainId = chainId;
    const thisFheCounterAddress = fheCounter.address;
    const thisCountHandle = countHandle;
    const thisEthersSigner = ethersSigner;

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    setMessage("Start decrypt");

    const run = async () => {
      const isStale = () =>
        thisFheCounterAddress !== fheCounterRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        const sig: FhevmDecryptionSignature | null =
          await FhevmDecryptionSignature.loadOrSign(
            instance,
            [fheCounter.address as `0x${string}`],
            ethersSigner,
            fhevmDecryptionSignatureStorage
          );

        if (!sig) {
          setMessage("Unable to build FHEVM decryption signature");
          return;
        }

        if (isStale()) {
          setMessage("Ignore FHEVM decryption");
          return;
        }

        setMessage("Call FHEVM userDecrypt...");

        // should be ok even if instance changed
        const res = await instance.userDecrypt(
          [{ handle: thisCountHandle, contractAddress: thisFheCounterAddress }],
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays
        );

        setMessage("FHEVM userDecrypt completed!");

        if (isStale()) {
          setMessage("Ignore FHEVM decryption");
          return;
        }

        setClearCount({ handle: thisCountHandle, clear: res[thisCountHandle] });
        clearCountRef.current = {
          handle: thisCountHandle,
          clear: res[thisCountHandle],
        };

        setMessage(
          "Count handle clear value is " + clearCountRef.current.clear
        );
      } catch (error: any) {
        setMessage("Decryption failed: " + error.message);
      } finally {
        isDecryptingRef.current = false;
        setIsDecrypting(false);
      }
    };

    run();
  }, [
    fhevmDecryptionSignatureStorage,
    ethersSigner,
    fheCounter.address,
    instance,
    countHandle,
    chainId,
    sameChain,
    sameSigner,
  ]);

  //////////////////////////////////////////////////////////////////////////////
  // Increment/Decrement Operations
  //////////////////////////////////////////////////////////////////////////////

  const canIncOrDec = useMemo(() => {
    return (
      fheCounter.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isIncOrDec
    );
  }, [fheCounter.address, instance, ethersSigner, isRefreshing, isIncOrDec]);

  const incOrDec = useCallback(
    (value: number) => {
      if (isRefreshingRef.current || isIncOrDecRef.current) {
        return;
      }

      if (!fheCounter.address || !instance || !ethersSigner || value === 0) {
        return;
      }

      const thisChainId = chainId;
      const thisFheCounterAddress = fheCounter.address;
      const thisEthersSigner = ethersSigner;
      const thisFheCounterContract = new ethers.Contract(
        thisFheCounterAddress,
        fheCounter.abi,
        thisEthersSigner
      );

      const op = value > 0 ? "increment" : "decrement";
      const valueAbs = value > 0 ? value : -value;
      const opMsg = `${op}(${valueAbs})`;

      isIncOrDecRef.current = true;
      setIsIncOrDec(true);
      setMessage(`Start ${opMsg}...`);

      const run = async (op: "increment" | "decrement", valueAbs: number) => {
        // let the browser repaint before running 'input.encrypt()' (CPU-costly)
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisFheCounterAddress !== fheCounterRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          const input = instance.createEncryptedInput(
            thisFheCounterAddress,
            thisEthersSigner.address
          );
          input.add32(valueAbs);

          // is CPU-intensive (browser may freeze a little when FHE-WASM modules are loading)
          const enc = await input.encrypt();

          if (isStale()) {
            setMessage(`Ignore ${opMsg}`);
            return;
          }

          setMessage(`Call ${opMsg}...`);

          // Call contract (increment or decrement)
          const tx: ethers.TransactionResponse =
            op === "increment"
              ? await thisFheCounterContract.increment(
                  enc.handles[0],
                  enc.inputProof
                )
              : await thisFheCounterContract.decrement(
                  enc.handles[0],
                  enc.inputProof
                );

          setMessage(`Wait for tx:${tx.hash}...`);

          const receipt = await tx.wait();

          setMessage(`Call ${opMsg} completed status=${receipt?.status} | 🔍 Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}`);

          if (isStale()) {
            setMessage(`Ignore ${opMsg}`);
            return;
          }

          refreshCountHandle();
        } catch (error: any) {
          setMessage(`${opMsg} Failed: ${error.message}`);
        } finally {
          isIncOrDecRef.current = false;
          setIsIncOrDec(false);
        }
      };

      run(op, valueAbs);
    },
    [
      ethersSigner,
      fheCounter.address,
      fheCounter.abi,
      instance,
      chainId,
      refreshCountHandle,
      sameChain,
      sameSigner,
    ]
  );

  return {
    contractAddress: fheCounter.address,
    canDecrypt,
    canGetCount,
    canIncOrDec,
    incOrDec,
    decryptCountHandle,
    refreshCountHandle,
    isDecrypted,
    message,
    clear: clearCount?.clear,
    handle: countHandle,
    isDecrypting,
    isRefreshing,
    isIncOrDec,
    isDeployed
  };
};