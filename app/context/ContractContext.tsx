'use client';

import { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import {
  saveFolderHandle,
  getFolderHandle,
  requestFolderPermission,
  clearFolderHandle,
  saveFileHandle,
  getFileHandle,
  requestFilePermission,
  clearFileHandle,
  readJsonFile
} from '../utils/storage';
import { toaster } from '@/components/ui/toaster';
import { genlayerTestnet, createGenlayerChain, DEFAULT_RPC_URL, DEFAULT_WS_URL } from '../wagmi';
import type { ContractContextType, DeploymentsFile, ContractAbi } from '../types';
import { findBestAbiMatch } from '../utils/abiMatcher';
import { getAutoSelectedNetwork, getAutoSelectedDeployment } from '../utils/autoSelection';

const ContractContext = createContext<ContractContextType | undefined>(undefined);

export function ContractProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [deploymentsFile, setDeploymentsFile] = useState<DeploymentsFile>({});
  const [deploymentsFileHandle, setDeploymentsFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [selectedNetworkState, setSelectedNetworkState] = useState<string>('');
  const [selectedDeploymentState, setSelectedDeploymentState] = useState<string>('');
  const [selectedContractState, setSelectedContractState] = useState<string>('');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [abisFolderHandle, setAbisFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [abiCache, setAbiCache] = useState<Map<string, ContractAbi>>(new Map());
  const availableAbis = useMemo(() => new Set(abiCache.keys()), [abiCache]);
  const [loadingAbiList, setLoadingAbiList] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [rpcUrl, setRpcUrlState] = useState<string>(DEFAULT_RPC_URL);
  const [wsUrl, setWsUrlState] = useState<string>(DEFAULT_WS_URL);

  // Create a dynamic chain definition based on current RPC URLs
  const activeChain = useMemo(
    () => (rpcUrl === DEFAULT_RPC_URL && wsUrl === DEFAULT_WS_URL)
      ? genlayerTestnet
      : createGenlayerChain(rpcUrl, wsUrl),
    [rpcUrl, wsUrl]
  );

  const setRpcUrl = useCallback((url: string) => {
    setRpcUrlState(url);
    localStorage.setItem('rpcUrl', url);
  }, []);

  const setWsUrl = useCallback((url: string) => {
    setWsUrlState(url);
    localStorage.setItem('wsUrl', url);
  }, []);

  // Look up an ABI from the cache, using fuzzy matching as fallback
  const lookupAbi = useCallback((contractName: string): ContractAbi | null => {
    const direct = abiCache.get(contractName);
    if (direct) return direct;

    const match = findBestAbiMatch(contractName, availableAbis);
    return match ? abiCache.get(match.abiName) ?? null : null;
  }, [abiCache, availableAbis]);

  // Derive contractAbi synchronously from cache — no useEffect delay
  const contractAbi = useMemo(
    () => selectedContractState ? lookupAbi(selectedContractState) : null,
    [selectedContractState, lookupAbi]
  );

  // Helper function to update URL params
  const updateURLParams = useCallback((network: string, deployment: string, contract: string) => {
    const params = new URLSearchParams(searchParams?.toString());

    if (network) {
      params.set('network', network);
    } else {
      params.delete('network');
    }

    if (deployment) {
      params.set('deployment', deployment);
    } else {
      params.delete('deployment');
    }

    if (contract) {
      params.set('contract', contract);
    } else {
      params.delete('contract');
    }

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(null, '', newUrl);
  }, [searchParams, pathname]);

  // Wrapper setters that update both state and URL
  const setSelectedNetwork = useCallback((network: string) => {
    setSelectedNetworkState(network);
    updateURLParams(network, '', '');
  }, [updateURLParams]);

  const setSelectedDeployment = useCallback((deployment: string) => {
    setSelectedDeploymentState(deployment);
    // Use the setter function form to get the latest state
    setSelectedNetworkState((currentNetwork) => {
      updateURLParams(currentNetwork, deployment, '');
      return currentNetwork;
    });
  }, [updateURLParams]);

  const setSelectedContract = useCallback((contract: string) => {
    setSelectedContractState(contract);
    // Use the setter function form to get the latest state
    setSelectedNetworkState((currentNetwork) => {
      setSelectedDeploymentState((currentDeployment) => {
        updateURLParams(currentNetwork, currentDeployment, contract);
        return currentDeployment;
      });
      return currentNetwork;
    });
  }, [updateURLParams]);

  // Initialize: Restore deployments and folder handle from storage
  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      let hasDeployments = false;
      let hasFolderHandle = false;

      // Restore RPC/WS URLs from localStorage
      const savedRpcUrl = localStorage.getItem('rpcUrl');
      const savedWsUrl = localStorage.getItem('wsUrl');
      if (savedRpcUrl) setRpcUrlState(savedRpcUrl);
      if (savedWsUrl) setWsUrlState(savedWsUrl);

      try {
        // 1. Try to restore deployments file handle from IndexedDB
        const savedFileHandle = await getFileHandle();
        if (savedFileHandle) {
          // Request permission for the saved file
          const hasPermission = await requestFilePermission(savedFileHandle);

          if (hasPermission) {
            try {
              // Read and parse the file
              const data = await readJsonFile<DeploymentsFile>(savedFileHandle);
              setDeploymentsFile(data);
              setDeploymentsFileHandle(savedFileHandle);
              hasDeployments = true;

              // Restore network/deployment/contract selections
              const networks = Object.keys(data);
              if (networks.length > 0) {
                // Priority 1: URL params
                const urlNetwork = searchParams?.get('network');
                const urlDeployment = searchParams?.get('deployment');
                const urlContract = searchParams?.get('contract');

                if (urlNetwork && data[urlNetwork]) {
                  setSelectedNetworkState(urlNetwork);
                  if (urlDeployment && data[urlNetwork]?.[urlDeployment]) {
                    setSelectedDeploymentState(urlDeployment);
                    if (urlContract && data[urlNetwork][urlDeployment]?.[urlContract]) {
                      setSelectedContractState(urlContract);
                    } else if (urlContract) {
                      // Contract in URL but not found
                      toaster.error({
                        title: 'Contract not found',
                        description: `Contract "${urlContract}" not found in the selected deployment`,
                      });
                    }
                  } else if (urlDeployment) {
                    // Deployment in URL but not found
                    toaster.error({
                      title: 'Deployment not found',
                      description: `Deployment "${urlDeployment}" not found in the selected network`,
                    });
                  }
                }
                // Priority 2: localStorage fallback
                else {
                  const savedNetwork = localStorage.getItem('selectedNetwork');
                  const savedDeployment = localStorage.getItem('selectedDeployment');

                  if (savedNetwork && data[savedNetwork]) {
                    setSelectedNetworkState(savedNetwork);
                    if (savedDeployment && data[savedNetwork]?.[savedDeployment]) {
                      setSelectedDeploymentState(savedDeployment);
                    }
                  } else if (networks.length === 1) {
                    setSelectedNetworkState(networks[0]);
                  }
                }
              }
            } catch (err) {
              console.error('Failed to read deployments file:', err);
              await clearFileHandle();
            }
          } else {
            // Permission denied, clear the saved handle
            await clearFileHandle();
            console.warn('Permission denied for saved deployments file');
          }
        }

        // 2. Try to restore folder handle from IndexedDB
        const savedHandle = await getFolderHandle();
        if (savedHandle) {
          // Request permission for the saved handle
          const hasPermission = await requestFolderPermission(savedHandle);

          if (hasPermission) {
            setAbisFolderHandle(savedHandle);
            await scanAbisFolder(savedHandle);
            hasFolderHandle = true;
          } else {
            // Permission denied, clear the saved handle
            await clearFolderHandle();
            console.warn('Permission denied for saved folder');
          }
        }

        // 3. Show setup modal if missing configuration
        if (!hasDeployments || !hasFolderHandle) {
          setShowSetupModal(true);
        } else {
          toaster.success({
            title: 'Configuration restored',
            description: 'Successfully restored your settings',
          });
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to initialize: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle deployments file selection
  const handleSelectDeploymentsFile = async () => {
    try {
      // @ts-expect-error - File System Access API
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] }
        }],
        multiple: false
      });

      // Read and parse the file
      const data = await readJsonFile<DeploymentsFile>(fileHandle);

      setDeploymentsFile(data);
      setDeploymentsFileHandle(fileHandle);

      // Save to IndexedDB for persistence
      await saveFileHandle(fileHandle);

      setSelectedNetwork('');
      setSelectedDeployment('');
      setSelectedContract('');
      setContractAddress('');
      setError(null);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Failed to select file: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  };

  // Handle ABIs folder selection
  const handleSelectAbisFolder = async () => {
    try {
      // @ts-expect-error - File System Access API
      const dirHandle = await window.showDirectoryPicker();
      setAbisFolderHandle(dirHandle);

      // Save to IndexedDB for persistence
      await saveFolderHandle(dirHandle);

      // Scan the folder for available ABIs
      await scanAbisFolder(dirHandle);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Failed to open folder: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  };

  // Handle setup modal completion
  const handleSetupComplete = async (fileHandle: FileSystemFileHandle | null, folderHandle: FileSystemDirectoryHandle | null) => {
    // Save deployments file handle if provided
    if (fileHandle) {
      const data = await readJsonFile<DeploymentsFile>(fileHandle);
      setDeploymentsFile(data);
      setDeploymentsFileHandle(fileHandle);
      await saveFileHandle(fileHandle);
    }

    // Save folder handle if provided
    if (folderHandle) {
      setAbisFolderHandle(folderHandle);
      await saveFolderHandle(folderHandle);
      await scanAbisFolder(folderHandle);
    }

    setShowSetupModal(false);
    toaster.success({
      title: 'Configuration saved',
      description: 'Your settings have been saved successfully',
    });
  };

  // Handle reconfigure (reset and show modal)
  const handleReconfigure = () => {
    setShowSetupModal(true);
  };

  // Parse all ABIs from a folder into a Map
  type AsyncIterableDirectoryHandle = FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  };

  interface ArtifactFile {
    abi: ContractAbi;
    [key: string]: unknown;
  }

  const parseAbisFromFolder = async (dirHandle: FileSystemDirectoryHandle): Promise<Map<string, ContractAbi>> => {
    const cache = new Map<string, ContractAbi>();

    for await (const entry of (dirHandle as AsyncIterableDirectoryHandle).values()) {
      if (entry.kind === 'directory' && entry.name.endsWith('.sol')) {
        const contractName = entry.name.replace('.sol', '');

        try {
          const solDir = entry as FileSystemDirectoryHandle;
          const jsonFile = await solDir.getFileHandle(`${contractName}.json`);
          const file = await jsonFile.getFile();
          const text = await file.text();

          const data = JSON.parse(text) as ContractAbi | ArtifactFile;
          const abi: ContractAbi = Array.isArray(data) ? data : data.abi;

          if (abi && Array.isArray(abi)) {
            cache.set(contractName, abi);
          }
        } catch {
          // File doesn't exist or parse error, skip
        }
      }
    }

    return cache;
  };

  // Scan the ABIs folder for available contracts and load all ABIs
  const scanAbisFolder = async (dirHandle: FileSystemDirectoryHandle) => {
    setLoadingAbiList(true);
    try {
      const cache = await parseAbisFromFolder(dirHandle);
      setAbiCache(cache);
    } catch (err) {
      console.error('Error scanning ABIs folder:', err);
      setError('Failed to scan folder: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingAbiList(false);
    }
  };

  // Save network and deployment to localStorage when changed
  useEffect(() => {
    if (selectedNetworkState) {
      localStorage.setItem('selectedNetwork', selectedNetworkState);
    }
  }, [selectedNetworkState]);

  useEffect(() => {
    if (selectedDeploymentState) {
      localStorage.setItem('selectedDeployment', selectedDeploymentState);
    }
  }, [selectedDeploymentState]);

  // Auto-select network when there's only one option
  useEffect(() => {
    if (!selectedNetworkState) {
      const autoNetwork = getAutoSelectedNetwork(deploymentsFile);
      if (autoNetwork) {
        setSelectedNetwork(autoNetwork);
      }
    }
  }, [deploymentsFile, selectedNetworkState, setSelectedNetwork]);

  // Auto-select deployment when there's only one option
  useEffect(() => {
    if (selectedNetworkState && !selectedDeploymentState) {
      const autoDeployment = getAutoSelectedDeployment(deploymentsFile, selectedNetworkState);
      if (autoDeployment) {
        setSelectedDeployment(autoDeployment);
      }
    }
  }, [deploymentsFile, selectedNetworkState, selectedDeploymentState, setSelectedDeployment]);

  // Update contract address when deployment or contract is selected
  useEffect(() => {
    if (selectedNetworkState && selectedDeploymentState && selectedContractState) {
      const address = deploymentsFile[selectedNetworkState]?.[selectedDeploymentState]?.[selectedContractState];
      if (address && address.startsWith('0x')) {
        setContractAddress(address);
      }
    }
  }, [selectedNetworkState, selectedDeploymentState, selectedContractState, deploymentsFile]);

  // Poll the ABIs folder for changes
  const abisFolderHandleRef = useRef(abisFolderHandle);
  abisFolderHandleRef.current = abisFolderHandle;

  useEffect(() => {
    if (!abisFolderHandle) return;

    const poll = async () => {
      const handle = abisFolderHandleRef.current;
      if (!handle) return;

      try {
        const newCache = await parseAbisFromFolder(handle);

        setAbiCache(prev => {
          // Only update if something changed to avoid unnecessary re-renders
          if (prev.size !== newCache.size) return newCache;
          for (const [key, value] of newCache) {
            const existing = prev.get(key);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(value)) {
              return newCache;
            }
          }
          for (const key of prev.keys()) {
            if (!newCache.has(key)) return newCache;
          }
          return prev;
        });
      } catch {
        // Silently fail on poll errors
      }
    };

    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abisFolderHandle]);

  // Update document title based on selected contract
  useEffect(() => {
    if (selectedContractState) {
      document.title = selectedContractState;
    } else {
      document.title = 'Contract Explorer';
    }
  }, [selectedContractState]);

  const value = {
    deploymentsFile,
    setDeploymentsFile,
    deploymentsFileHandle,
    setDeploymentsFileHandle,
    selectedNetwork: selectedNetworkState,
    setSelectedNetwork,
    selectedDeployment: selectedDeploymentState,
    setSelectedDeployment,
    selectedContract: selectedContractState,
    setSelectedContract,
    contractAddress,
    setContractAddress,
    contractAbi,
    error,
    setError,
    abisFolderHandle,
    setAbisFolderHandle,
    abiCache,
    availableAbis,
    lookupAbi,
    loadingAbiList,
    setLoadingAbiList,
    isInitializing,
    showSetupModal,
    setShowSetupModal,
    rpcUrl,
    setRpcUrl,
    wsUrl,
    setWsUrl,
    activeChain,
    handleSelectDeploymentsFile,
    handleSelectAbisFolder,
    handleSetupComplete,
    handleReconfigure,
    scanAbisFolder,
  };

  // Expose test helpers for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-expect-error - Expose for E2E testing
      window.__contractContext = {
        setContractAddress,
        setAbiCache,
        setSelectedNetwork: setSelectedNetworkState,
        setSelectedDeployment: setSelectedDeploymentState,
        setSelectedContract: setSelectedContractState,
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        // @ts-expect-error - Clean up E2E testing helper
        delete window.__contractContext;
      }
    };
  }, []);

  return <ContractContext.Provider value={value}>{children}</ContractContext.Provider>;
}

export function useContract() {
  const context = useContext(ContractContext);
  if (context === undefined) {
    throw new Error('useContract must be used within a ContractProvider');
  }
  return context;
}
