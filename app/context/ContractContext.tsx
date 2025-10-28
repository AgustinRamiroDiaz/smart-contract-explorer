'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

type Deployment = Record<string, string>; // contract name -> address
type Network = Record<string, Deployment>; // deployment name -> deployment
type DeploymentsFile = Record<string, Network>; // network name -> network

interface ContractContextType {
  deploymentsFile: DeploymentsFile;
  setDeploymentsFile: (file: DeploymentsFile) => void;
  deploymentsFileHandle: FileSystemFileHandle | null;
  setDeploymentsFileHandle: (handle: FileSystemFileHandle | null) => void;
  selectedNetwork: string;
  setSelectedNetwork: (network: string) => void;
  selectedDeployment: string;
  setSelectedDeployment: (deployment: string) => void;
  selectedContract: string;
  setSelectedContract: (contract: string) => void;
  contractAddress: string;
  setContractAddress: (address: string) => void;
  contractAbi: any[] | null;
  setContractAbi: (abi: any[] | null) => void;
  loadingAbi: boolean;
  setLoadingAbi: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  abisFolderHandle: FileSystemDirectoryHandle | null;
  setAbisFolderHandle: (handle: FileSystemDirectoryHandle | null) => void;
  availableAbis: Set<string>;
  setAvailableAbis: (abis: Set<string>) => void;
  loadingAbiList: boolean;
  setLoadingAbiList: (loading: boolean) => void;
  isInitializing: boolean;
  showSetupModal: boolean;
  setShowSetupModal: (show: boolean) => void;
  handleSelectDeploymentsFile: () => Promise<void>;
  handleSelectAbisFolder: () => Promise<void>;
  handleSetupComplete: (fileHandle: FileSystemFileHandle | null, folderHandle: FileSystemDirectoryHandle | null) => Promise<void>;
  handleReconfigure: () => void;
  scanAbisFolder: (dirHandle: FileSystemDirectoryHandle) => Promise<void>;
  loadAbiFromFolder: (contractName: string) => Promise<void>;
}

const ContractContext = createContext<ContractContextType | undefined>(undefined);

export function ContractProvider({ children }: { children: ReactNode }) {
  const [deploymentsFile, setDeploymentsFile] = useState<DeploymentsFile>({});
  const [deploymentsFileHandle, setDeploymentsFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [selectedDeployment, setSelectedDeployment] = useState('');
  const [selectedContract, setSelectedContract] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [contractAbi, setContractAbi] = useState<any[] | null>(null);
  const [loadingAbi, setLoadingAbi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abisFolderHandle, setAbisFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [availableAbis, setAvailableAbis] = useState<Set<string>>(new Set());
  const [loadingAbiList, setLoadingAbiList] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);

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
              const data = await readJsonFile(savedFileHandle);
              setDeploymentsFile(data);
              setDeploymentsFileHandle(savedFileHandle);
              hasDeployments = true;

              // Restore network/deployment selections
              const networks = Object.keys(data);
              if (networks.length > 0) {
                const savedNetwork = localStorage.getItem('selectedNetwork');
                const savedDeployment = localStorage.getItem('selectedDeployment');

                if (savedNetwork && data[savedNetwork]) {
                  setSelectedNetwork(savedNetwork);
                  if (savedDeployment && data[savedNetwork]?.[savedDeployment]) {
                    setSelectedDeployment(savedDeployment);
                  }
                } else if (networks.length === 1) {
                  setSelectedNetwork(networks[0]);
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
      const data = await readJsonFile(fileHandle);

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
      const data = await readJsonFile(fileHandle);
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
      // @ts-ignore
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory' && entry.name.endsWith('.sol')) {
          const contractName = entry.name.replace('.sol', '');

          try {
            // Check if the contract's JSON file exists
            await entry.getFileHandle(`${contractName}.json`);
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
    if (selectedNetwork) {
      localStorage.setItem('selectedNetwork', selectedNetwork);
    }
  }, [selectedNetwork]);

  useEffect(() => {
    if (selectedDeployment) {
      localStorage.setItem('selectedDeployment', selectedDeployment);
    }
  }, [selectedDeployment]);

  // Update contract address when deployment or contract is selected
  useEffect(() => {
    if (selectedNetwork && selectedDeployment && selectedContract) {
      const address = deploymentsFile[selectedNetwork]?.[selectedDeployment]?.[selectedContract];
      if (address && address.startsWith('0x')) {
        setContractAddress(address);
      }
    }
  }, [selectedNetwork, selectedDeployment, selectedContract, deploymentsFile]);

  // Load ABI when contract is selected
  useEffect(() => {
    if (selectedContract && abisFolderHandle) {
      loadAbiFromFolder(selectedContract);
    } else {
      setContractAbi(null);
    }
  }, [selectedContract, abisFolderHandle]);

  // Load ABI from the selected folder
  const loadAbiFromFolder = async (contractName: string) => {
    if (!abisFolderHandle) return;

    setLoadingAbi(true);
    try {
      // @ts-ignore
      const solDir = await abisFolderHandle.getDirectoryHandle(`${contractName}.sol`);
      // @ts-ignore
      const jsonFile = await solDir.getFileHandle(`${contractName}.json`);
      const file = await jsonFile.getFile();
      const text = await file.text();
      const data = JSON.parse(text);

      // Handle both raw ABI arrays and artifact objects with an abi field
      const abi = Array.isArray(data) ? data : data.abi;

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
    if (selectedContract) {
      document.title = selectedContract;
    } else {
      document.title = 'Contract Explorer';
    }
  }, [selectedContract]);

  const value = {
    deploymentsFile,
    setDeploymentsFile,
    deploymentsFileHandle,
    setDeploymentsFileHandle,
    selectedNetwork,
    setSelectedNetwork,
    selectedDeployment,
    setSelectedDeployment,
    selectedContract,
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
