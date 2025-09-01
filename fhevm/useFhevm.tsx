import { useCallback, useEffect, useRef, useState } from "react";
import { createFhevmInstance } from "./internal/fhevm";
import type { 
  FhevmInstance, 
  FhevmGoState, 
  FhevmHookParameters, 
  FhevmHookReturn 
} from "./fhevmTypes";

function _assert(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    const m = message ? `Assertion failed: ${message}` : `Assertion failed.`;
    console.error(m);
    throw new Error(m);
  }
}

export function useFhevm(parameters: FhevmHookParameters): FhevmHookReturn {
  const { provider, chainId, initialMockChains, enabled = true } = parameters;

  const [instance, _setInstance] = useState<FhevmInstance | undefined>(undefined);
  const [status, _setStatus] = useState<FhevmGoState>("idle");
  const [error, _setError] = useState<Error | undefined>(undefined);
  const [_isRunning, _setIsRunning] = useState<boolean>(enabled);
  const [_providerChanged, _setProviderChanged] = useState<number>(0);
  
  const _abortControllerRef = useRef<AbortController | null>(null);
  const _providerRef = useRef<string | any | undefined>(provider);
  const _chainIdRef = useRef<number | undefined>(chainId);
  const _mockChainsRef = useRef<Record<number, string> | undefined>(initialMockChains);

  const refresh = useCallback(() => {
    console.log("[useFhevm] Refresh called");
    
    // Provider or chainId has changed. Abort immediately
    if (_abortControllerRef.current) {
      console.log("[useFhevm] Aborting previous operation");
      // Make sure _providerRef.current + _chainIdRef.current are undefined during abort
      _providerRef.current = undefined;
      _chainIdRef.current = undefined;

      _abortControllerRef.current.abort();
      _abortControllerRef.current = null;
    }

    _providerRef.current = provider;
    _chainIdRef.current = chainId;

    // Nullify instance immediately
    _setInstance(undefined);
    _setError(undefined);
    _setStatus("idle");

    if (provider !== undefined) {
      console.log("[useFhevm] Triggering provider change");
      // Force call main useEffect
      _setProviderChanged((prev) => prev + 1);
    }
  }, [provider, chainId]);

  // Initial refresh effect
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Enable/disable effect
  useEffect(() => {
    _setIsRunning(enabled);
  }, [enabled]);

  // Main useEffect for instance creation
  useEffect(() => {
    console.log("[useFhevm] Main effect triggered", { 
      _isRunning, 
      provider: _providerRef.current, 
      chainId: _chainIdRef.current 
    });

    if (_isRunning === false) {
      console.log("[useFhevm] Instance creation cancelled - not running");
      if (_abortControllerRef.current) {
        _abortControllerRef.current.abort();
        _abortControllerRef.current = null;
      }
      _setInstance(undefined);
      _setError(undefined);
      _setStatus("idle");
      return;
    }

    if (_isRunning === true) {
      if (_providerRef.current === undefined) {
        console.log("[useFhevm] Provider is undefined, resetting state");
        _setInstance(undefined);
        _setError(undefined);
        _setStatus("idle");
        return;
      }

      if (!_abortControllerRef.current) {
        _abortControllerRef.current = new AbortController();
      }

      _assert(
        !_abortControllerRef.current.signal.aborted,
        "Abort controller should not be aborted at this point"
      );

      console.log("[useFhevm] Starting instance creation");
      _setStatus("loading");
      _setError(undefined);

      const thisSignal = _abortControllerRef.current.signal;
      const thisProvider = _providerRef.current;
      const thisChainId = _chainIdRef.current;
      const thisRpcUrlsByChainId = _mockChainsRef.current;

      createFhevmInstance({
        signal: thisSignal,
        provider: thisProvider,
        chainId: thisChainId,
        mockChains: thisRpcUrlsByChainId,
        onStatusChange: (s) => {
          console.log(`[useFhevm] Status: ${s}`);
        },
      })
        .then((instance) => {
          console.log(`[useFhevm] Instance created successfully!`);
          if (thisSignal.aborted) {
            console.log("[useFhevm] Operation was aborted, ignoring result");
            return;
          }

          // Verify provider hasn't changed
          _assert(
            thisProvider === _providerRef.current,
            "Provider should not have changed during creation"
          );

          _setInstance(instance);
          _setError(undefined);
          _setStatus("ready");
        })
        .catch((error) => {
          console.error(`[useFhevm] Instance creation failed:`, error);
          if (thisSignal.aborted) {
            console.log("[useFhevm] Operation was aborted, ignoring error");
            return;
          }

          _assert(
            thisProvider === _providerRef.current,
            "Provider should not have changed during creation"
          );

          _setInstance(undefined);
          _setError(error instanceof Error ? error : new Error(String(error)));
          _setStatus("error");
        });
    }
  }, [_isRunning, _providerChanged]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (_abortControllerRef.current) {
        console.log("[useFhevm] Cleaning up - aborting operation");
        _abortControllerRef.current.abort();
      }
    };
  }, []);

  return { instance, refresh, error, status };
}

// Additional hook for Sepolia-specific configuration
export function useSepoliaFhevm(provider?: string | any): FhevmHookReturn {
  return useFhevm({
    provider,
    chainId: 11155111, // Sepolia chain ID
    enabled: true
  });
}

// Hook for local development with mock chains
export function useMockFhevm(provider?: string | any, mockChains?: Record<number, string>): FhevmHookReturn {
  const defaultMockChains = {
    1337: "http://localhost:8545",
    31337: "http://localhost:8545"
  };

  return useFhevm({
    provider,
    chainId: 1337,
    initialMockChains: mockChains || defaultMockChains,
    enabled: true
  });
}