'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from './components/ConnectButton';
import FunctionCard from './components/FunctionCard';
import SetupModal from './components/SetupModal';
import { genlayerTestnet } from './wagmi';
import {
  Box,
  Container,
  Heading,
  VStack,
  Field,
  Input,
  NativeSelectRoot,
  NativeSelectField,
  Text,
  Alert,
  Spinner,
  Center,
  HStack,
  Grid,
  GridItem,
  Button,
  IconButton,
} from '@chakra-ui/react';
import { saveFolderHandle, getFolderHandle, requestFolderPermission, clearFolderHandle } from './utils/storage';

type Deployment = Record<string, string>; // contract name -> address

type Network = Record<string, Deployment>; // deployment name -> deployment

type DeploymentsFile = Record<string, Network>; // network name -> network

type AbiInput = {
  name: string;
  type: string;
  internalType?: string;
};

type AbiOutput = {
  name: string;
  type: string;
  internalType?: string;
};

type AbiFunction = {
  name: string;
  type: string;
  stateMutability: string;
  inputs: AbiInput[];
  outputs: AbiOutput[];
};

export default function Page() {
  const [deploymentsFile, setDeploymentsFile] = useState<DeploymentsFile>({});
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
  const [initSuccess, setInitSuccess] = useState<string | null>(null);

  // Initialize: Restore deployments and folder handle from storage
  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      let hasDeployments = false;
      let hasFolderHandle = false;

      try {
        // 1. Try to restore deployments from localStorage
        const savedDeployments = localStorage.getItem('deploymentsFile');
        if (savedDeployments) {
          try {
            const data = JSON.parse(savedDeployments);
            setDeploymentsFile(data);
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
            console.error('Failed to parse saved deployments:', err);
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
          setInitSuccess('Configuration restored successfully');
          setTimeout(() => setInitSuccess(null), 3000);
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

  // Handle deployments file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setDeploymentsFile(data);
        localStorage.setItem('deploymentsFile', JSON.stringify(data));
        setSelectedNetwork('');
        setSelectedDeployment('');
        setSelectedContract('');
        setContractAddress('');
        setError(null);
      } catch (err) {
        setError('Failed to parse JSON file: ' + (err instanceof Error ? err.message : 'Invalid JSON'));
      }
    };
    reader.readAsText(file);
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
  const handleSetupComplete = async (deploymentsData: any, folderHandle: FileSystemDirectoryHandle) => {
    // Save deployments if provided
    if (deploymentsData) {
      setDeploymentsFile(deploymentsData);
      localStorage.setItem('deploymentsFile', JSON.stringify(deploymentsData));
    }

    // Save folder handle if provided
    if (folderHandle) {
      setAbisFolderHandle(folderHandle);
      await saveFolderHandle(folderHandle);
      await scanAbisFolder(folderHandle);
    }

    setShowSetupModal(false);
    setInitSuccess('Configuration saved successfully');
    setTimeout(() => setInitSuccess(null), 3000);
  };

  // Handle reconfigure (reset and show modal)
  const handleReconfigure = async () => {
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

  const [searchTerm, setSearchTerm] = useState('');

  const networkNames = Object.keys(deploymentsFile);
  const deploymentNames = selectedNetwork
    ? Object.keys(deploymentsFile[selectedNetwork] || {})
    : [];
  const contractNames = selectedNetwork && selectedDeployment
    ? Object.keys(deploymentsFile[selectedNetwork]?.[selectedDeployment] || {}).filter(
        (key) => {
          const hasAddress = deploymentsFile[selectedNetwork][selectedDeployment][key]?.startsWith('0x');
          const hasAbi = availableAbis.has(key);
          return hasAddress && hasAbi;
        }
      )
    : [];

  // Get all functions from ABI
  const allFunctions: AbiFunction[] = contractAbi
    ? contractAbi.filter((item: any) => item.type === 'function')
    : [];

  // Separate read and write functions
  const allReadFunctions = allFunctions.filter(
    (func) => func.stateMutability === 'view' || func.stateMutability === 'pure'
  );
  const allWriteFunctions = allFunctions.filter(
    (func) => func.stateMutability !== 'view' && func.stateMutability !== 'pure'
  );

  // Filter functions based on search term
  const filterBySearch = (funcs: AbiFunction[]) => {
    if (!searchTerm.trim()) return funcs;
    const lowerSearch = searchTerm.toLowerCase();
    return funcs.filter(func => func.name.toLowerCase().includes(lowerSearch));
  };

  const readFunctions = filterBySearch(allReadFunctions);
  const writeFunctions = filterBySearch(allWriteFunctions);

  return (
    <Box minH="100vh">
      {/* Setup Modal */}
      <SetupModal
        open={showSetupModal}
        onComplete={handleSetupComplete}
        onSkip={() => setShowSetupModal(false)}
        hasDeployments={Object.keys(deploymentsFile).length > 0}
        hasFolderHandle={abisFolderHandle !== null}
      />

      {/* Header */}
      <Box borderBottomWidth="1px" bg="white" px={6} py={4}>
        <HStack justify="space-between">
          <Heading size="lg">GenLayer Contract Explorer</Heading>
          <ConnectButton />
        </HStack>
      </Box>

      {/* Main Layout */}
      <Grid templateColumns="350px 1fr" h="calc(100vh - 73px)">
        {/* Sidebar */}
        <GridItem
          bg="gray.50"
          borderRightWidth="1px"
          p={6}
          overflowY="auto"
        >
          <VStack gap={4} align="stretch">
            <HStack justify="space-between" align="center">
              <Heading size="md">Configuration</Heading>
              <Button
                size="xs"
                variant="ghost"
                onClick={handleReconfigure}
                title="Reconfigure settings"
              >
                ⚙️ Setup
              </Button>
            </HStack>

            {/* Initialization Loading */}
            {isInitializing && (
              <Center py={4}>
                <VStack gap={2}>
                  <Spinner size="md" />
                  <Text fontSize="sm" color="gray.600">
                    Initializing...
                  </Text>
                </VStack>
              </Center>
            )}

            {/* Success Message */}
            {initSuccess && (
              <Box p={3} bg="green.50" borderRadius="md" borderWidth="1px" borderColor="green.200">
                <Text fontSize="sm" color="green.700">
                  ✓ {initSuccess}
                </Text>
              </Box>
            )}

            {!isInitializing && (
              <>
                <Field.Root>
                  <Field.Label fontSize="sm" fontWeight="semibold">Load Deployments File:</Field.Label>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    pt={1}
                    bg="white"
                    fontSize="sm"
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label fontSize="sm" fontWeight="semibold">ABIs Folder:</Field.Label>
                  <Button
                    onClick={handleSelectAbisFolder}
                    size="sm"
                    width="full"
                    variant="outline"
                  >
                    {abisFolderHandle ? `📁 ${abisFolderHandle.name}` : 'Select ABIs Folder'}
                  </Button>
                  {loadingAbiList && (
                    <Text fontSize="xs" color="gray.600" mt={1}>
                      Scanning folder...
                    </Text>
                  )}
                  {!loadingAbiList && availableAbis.size > 0 && (
                    <Text fontSize="xs" color="green.600" mt={1}>
                      ✓ Found {availableAbis.size} ABI{availableAbis.size !== 1 ? 's' : ''}
                    </Text>
                  )}
                </Field.Root>

                <Field.Root>
                  <Field.Label fontSize="sm" fontWeight="semibold">Select Network:</Field.Label>
                  <NativeSelectRoot size="sm">
                    <NativeSelectField
                      value={selectedNetwork}
                      onChange={(e) => {
                        setSelectedNetwork(e.target.value);
                        setSelectedDeployment('');
                        setSelectedContract('');
                        setError(null);
                      }}
                      bg="white"
                    >
                      <option value="">-- Select a network --</option>
                      {networkNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </NativeSelectField>
                  </NativeSelectRoot>
                </Field.Root>

                {selectedNetwork && (
                  <Field.Root>
                    <Field.Label fontSize="sm" fontWeight="semibold">Select Deployment:</Field.Label>
                    <NativeSelectRoot size="sm">
                      <NativeSelectField
                        value={selectedDeployment}
                        onChange={(e) => {
                          setSelectedDeployment(e.target.value);
                          setSelectedContract('');
                          setError(null);
                        }}
                        bg="white"
                      >
                        <option value="">-- Select a deployment --</option>
                        {deploymentNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </NativeSelectField>
                    </NativeSelectRoot>
                  </Field.Root>
                )}

                {selectedNetwork && selectedDeployment && (
                  <Field.Root>
                    <Field.Label fontSize="sm" fontWeight="semibold">
                      Select Contract:
                      {loadingAbiList && (
                        <Text as="span" ml={2} fontSize="xs" color="gray.500" fontWeight="normal">
                          (Loading...)
                        </Text>
                      )}
                    </Field.Label>
                    <NativeSelectRoot size="sm" disabled={loadingAbiList}>
                      <NativeSelectField
                        value={selectedContract}
                        onChange={(e) => {
                          setSelectedContract(e.target.value);
                          setError(null);
                        }}
                        bg="white"
                      >
                        <option value="">
                          {!abisFolderHandle
                            ? 'Select ABIs folder first'
                            : loadingAbiList
                            ? 'Loading...'
                            : contractNames.length === 0
                            ? 'No contracts with ABIs found'
                            : '-- Select a contract --'}
                        </option>
                        {contractNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </NativeSelectField>
                    </NativeSelectRoot>
                    {!loadingAbiList && contractNames.length > 0 && (
                      <Text fontSize="xs" color="gray.600" mt={1}>
                        {contractNames.length} contract{contractNames.length !== 1 ? 's' : ''} available
                      </Text>
                    )}
                  </Field.Root>
                )}

                <Field.Root>
                  <Field.Label fontSize="sm" fontWeight="semibold">Contract Address:</Field.Label>
                  <Input
                    value={contractAddress}
                    onChange={(e) => setContractAddress(e.target.value)}
                    placeholder="0x..."
                    bg="white"
                    fontSize="sm"
                    fontFamily="mono"
                  />
                </Field.Root>
              </>
            )}

            {/* Display error if any */}
            {error && (
              <Alert.Root status="error" size="sm">
                <Alert.Indicator />
                <Alert.Title fontSize="xs">{error}</Alert.Title>
              </Alert.Root>
            )}
          </VStack>
        </GridItem>

        {/* Main Panel */}
        <GridItem overflowY="auto" bg="white">
          <Container maxW="container.lg" py={6}>
            {/* Search Bar */}
            {contractAbi && contractAddress && allFunctions.length > 0 && (
              <Box mb={6}>
                <Field.Root>
                  <Field.Label fontWeight="semibold">Search Functions</Field.Label>
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by function name..."
                    size="lg"
                    fontFamily="mono"
                  />
                  {searchTerm && (
                    <Text fontSize="xs" color="gray.600" mt={1}>
                      Showing {readFunctions.length + writeFunctions.length} of {allFunctions.length} function{allFunctions.length !== 1 ? 's' : ''}
                    </Text>
                  )}
                </Field.Root>
              </Box>
            )}

            {/* Loading ABI indicator */}
            {loadingAbi && (
              <Center py={12}>
                <VStack>
                  <Spinner size="lg" />
                  <Text color="gray.600">Loading contract ABI...</Text>
                </VStack>
              </Center>
            )}

            {/* Function List */}
            {contractAbi && contractAddress && allFunctions.length > 0 && (
              <>
                {readFunctions.length === 0 && writeFunctions.length === 0 ? (
                  <Center py={12}>
                    <VStack gap={2}>
                      <Text color="gray.500" fontSize="lg">
                        No functions found matching "{searchTerm}"
                      </Text>
                      <Text color="gray.400" fontSize="sm">
                        Try a different search term
                      </Text>
                    </VStack>
                  </Center>
                ) : (
                  <VStack gap={8} align="stretch">
                    {/* Write Functions */}
                    {writeFunctions.length > 0 && (
                      <Box>
                        <Heading size="lg" mb={2}>Write Functions</Heading>
                        <Text fontSize="sm" color="gray.600" mb={4}>
                          {writeFunctions.length} write function{writeFunctions.length !== 1 ? 's' : ''} {searchTerm ? 'found' : 'available'}
                        </Text>
                        {writeFunctions.map((func) => (
                          <FunctionCard
                            key={func.name}
                            func={func}
                            contractAddress={contractAddress}
                            contractAbi={contractAbi}
                            chain={genlayerTestnet}
                          />
                        ))}
                      </Box>
                    )}

                    {/* Read Functions */}
                    {readFunctions.length > 0 && (
                      <Box>
                        <Heading size="lg" mb={2}>Read Functions</Heading>
                        <Text fontSize="sm" color="gray.600" mb={4}>
                          {readFunctions.length} read function{readFunctions.length !== 1 ? 's' : ''} {searchTerm ? 'found' : 'available'}
                        </Text>
                        {readFunctions.map((func) => (
                          <FunctionCard
                            key={func.name}
                            func={func}
                            contractAddress={contractAddress}
                            contractAbi={contractAbi}
                            chain={genlayerTestnet}
                          />
                        ))}
                      </Box>
                    )}
                  </VStack>
                )}
              </>
            )}

            {/* No functions message */}
            {contractAbi && contractAddress && allFunctions.length === 0 && (
              <Center py={12}>
                <Text color="gray.600">
                  No functions found in this contract's ABI
                </Text>
              </Center>
            )}

            {/* Empty state when no contract selected */}
            {!loadingAbi && !contractAbi && (
              <Center py={12}>
                <VStack gap={2}>
                  <Text color="gray.500" fontSize="lg">
                    Select a contract from the sidebar to view functions
                  </Text>
                  <Text color="gray.400" fontSize="sm">
                    Configure your deployment and contract settings on the left
                  </Text>
                </VStack>
              </Center>
            )}
          </Container>
        </GridItem>
      </Grid>
    </Box>
  );
}
