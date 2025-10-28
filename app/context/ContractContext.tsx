'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
import type { ContractContextType, DeploymentsFile, ContractAbi } from '../types';

const ContractContext = createContext<ContractContextType | undefined>(undefined);

export function ContractProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [deploymentsFile, setDeploymentsFile] = useState<DeploymentsFile>({});
  const [deploymentsFileHandle, setDeploymentsFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [selectedNetworkState, setSelectedNetworkState] = useState<string>('');
  const [selectedDeploymentState, setSelectedDeploymentState] = useState<string>('');
  const [selectedContractState, setSelectedContractState] = useState<string>('');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [contractAbi, setContractAbi] = useState<ContractAbi | null>(null);
  const [loadingAbi, setLoadingAbi] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [abisFolderHandle, setAbisFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [availableAbis, setAvailableAbis] = useState<Set<string>>(new Set());
  const [loadingAbiList, setLoadingAbiList] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);

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
    router.replace(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

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
  }, []);

  // Handle deployments file selection
  const handleSelectDeploymentsFile = async () => {
    try {
      // @ts-ignore - File System Access API
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
      // @ts-ignore - File System Access API
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

  // Scan the ABIs folder for available contracts
  const scanAbisFolder = async (dirHandle: FileSystemDirectoryHandle) => {
    setLoadingAbiList(true);
    const foundAbis = new Set<string>();

    try {
      // TypeScript doesn't have the full FileSystemDirectoryHandle API, so we need to cast
      type AsyncIterableDirectoryHandle = FileSystemDirectoryHandle & {
        values(): AsyncIterableIterator<FileSystemHandle>;
      };

      for await (const entry of (dirHandle as AsyncIterableDirectoryHandle).values()) {
        if (entry.kind === 'directory' && entry.name.endsWith('.sol')) {
          const contractName = entry.name.replace('.sol', '');

          try {
            // Check if the contract's JSON file exists
            await (entry as FileSystemDirectoryHandle).getFileHandle(`${contractName}.json`);
            foundAbis.add(contractName);
          } catch {
            // File doesn't exist, skip
          }
        }
      }

      setAvailableAbis(foundAbis);
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

  // Update contract address when deployment or contract is selected
  useEffect(() => {
    if (selectedNetworkState && selectedDeploymentState && selectedContractState) {
      const address = deploymentsFile[selectedNetworkState]?.[selectedDeploymentState]?.[selectedContractState];
      if (address && address.startsWith('0x')) {
        setContractAddress(address);
      }
    }
  }, [selectedNetworkState, selectedDeploymentState, selectedContractState, deploymentsFile]);

  // Load ABI when contract is selected
  useEffect(() => {
    if (selectedContractState && abisFolderHandle) {
      loadAbiFromFolder(selectedContractState);
    } else {
      setContractAbi(null);
    }
  }, [selectedContractState, abisFolderHandle]);

  // Load ABI from the selected folder
  const loadAbiFromFolder = async (contractName: string) => {
    if (!abisFolderHandle) return;

    setLoadingAbi(true);
    try {
      const solDir = await abisFolderHandle.getDirectoryHandle(`${contractName}.sol`);
      const jsonFile = await solDir.getFileHandle(`${contractName}.json`);
      const file = await jsonFile.getFile();
      const text = await file.text();

      interface ArtifactFile {
        abi: ContractAbi;
        [key: string]: unknown;
      }

      const data = JSON.parse(text) as ContractAbi | ArtifactFile;

      // Handle both raw ABI arrays and artifact objects with an abi field
      const abi: ContractAbi = Array.isArray(data) ? data : data.abi;

      if (!abi || !Array.isArray(abi)) {
        setError('Invalid ABI file format');
        setContractAbi(null);
      } else {
        setContractAbi(abi);
        setError(null);
      }
    } catch (err) {
      console.error('Error loading ABI:', err);
      setContractAbi(null);
    } finally {
      setLoadingAbi(false);
    }
  };

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
    setContractAbi,
    loadingAbi,
    setLoadingAbi,
    error,
    setError,
    abisFolderHandle,
    setAbisFolderHandle,
    availableAbis,
    setAvailableAbis,
    loadingAbiList,
    setLoadingAbiList,
    isInitializing,
    showSetupModal,
    setShowSetupModal,
    handleSelectDeploymentsFile,
    handleSelectAbisFolder,
    handleSetupComplete,
    handleReconfigure,
    scanAbisFolder,
    loadAbiFromFolder,
  };

  return <ContractContext.Provider value={value}>{children}</ContractContext.Provider>;
}

export function useContract() {
  const context = useContext(ContractContext);
  if (context === undefined) {
    throw new Error('useContract must be used within a ContractProvider');
  }
  return context;
}
