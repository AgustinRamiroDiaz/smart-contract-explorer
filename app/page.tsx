'use client';

import { useState, useEffect, useRef } from 'react';
import { ConnectButton } from './components/ConnectButton';
import { ThemeToggle } from '@/components/ui/theme-selector';
import FunctionCard from './components/FunctionCard';
import TransactionExplorer from './components/TransactionExplorer';
import EventLogsExplorer from './components/EventLogsExplorer';
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
  Tabs,
} from '@chakra-ui/react';
import { Tooltip } from '@chakra-ui/react';
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
} from './utils/storage';
import { toaster } from '@/components/ui/toaster';

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape to clear search
      if (e.key === 'Escape' && searchTerm) {
        setSearchTerm('');
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [searchTerm]);

  // Update document title based on selected contract
  useEffect(() => {
    if (selectedContract) {
      document.title = selectedContract;
    } else {
      document.title = 'Contract Explorer';
    }
  }, [selectedContract]);

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
        hasDeploymentsFile={deploymentsFileHandle !== null}
        hasFolderHandle={abisFolderHandle !== null}
      />

      {/* Main Layout */}
      <Grid templateColumns="350px 1fr" h="100vh">
        {/* Sidebar */}
        <GridItem
          bg={{ base: 'gray.50' }}
          _dark={{ bg: 'gray.900' }}
          borderRightWidth="1px"
          p={6}
          overflowY="auto"
        >
          <VStack gap={4} align="stretch">
            {/* Connect Button */}
            <Box>
              <ConnectButton />
            </Box>

            {/* Theme Toggle */}
            <ThemeToggle />

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

            {!isInitializing && (
              <>
                <Field.Root>
                  <Field.Label fontSize="sm" fontWeight="semibold">
                    <HStack gap={1} display="inline-flex" align="center">
                      <Text>Deployments File:</Text>
                      <Tooltip.Root openDelay={200} closeDelay={100}>
                        <Tooltip.Trigger asChild>
                          <Box
                            as="span"
                            cursor="help"
                            color="gray.500"
                            fontSize="xs"
                            display="inline-flex"
                            alignItems="center"
                          >
                            ℹ️
                          </Box>
                        </Tooltip.Trigger>
                        <Tooltip.Positioner>
                          <Tooltip.Content
                            bg="gray.800"
                            color="white"
                            p={3}
                            borderRadius="md"
                            maxW="320px"
                            boxShadow="lg"
                            zIndex={9999}
                          >
                            <Text fontWeight="semibold" mb={2} fontSize="sm">Expected JSON format:</Text>
                            <Box
                              as="pre"
                              fontSize="xs"
                              whiteSpace="pre-wrap"
                              bg="gray.900"
                              p={2}
                              borderRadius="sm"
                            >
{`{
  "network-name": {
    "deployment-name": {
      "ContractName": "0x..."
    }
  }
}`}
                            </Box>
                          </Tooltip.Content>
                        </Tooltip.Positioner>
                      </Tooltip.Root>
                    </HStack>
                  </Field.Label>
                  <Button
                    onClick={handleSelectDeploymentsFile}
                    size="sm"
                    width="full"
                    variant="outline"
                  >
                    {deploymentsFileHandle ? `📄 ${deploymentsFileHandle.name}` : 'Select Deployments File'}
                  </Button>
                  {deploymentsFileHandle && Object.keys(deploymentsFile).length > 0 && (
                    <Text fontSize="xs" color="green.600" mt={1}>
                      ✓ Loaded ({Object.keys(deploymentsFile).length} network{Object.keys(deploymentsFile).length !== 1 ? 's' : ''})
                    </Text>
                  )}
                </Field.Root>

                <Field.Root>
                  <Field.Label fontSize="sm" fontWeight="semibold">
                    <HStack gap={1} display="inline-flex" align="center">
                      <Text>ABIs Folder:</Text>
                      <Tooltip.Root openDelay={200} closeDelay={100}>
                        <Tooltip.Trigger asChild>
                          <Box
                            as="span"
                            cursor="help"
                            color="gray.500"
                            fontSize="xs"
                            display="inline-flex"
                            alignItems="center"
                          >
                            ℹ️
                          </Box>
                        </Tooltip.Trigger>
                        <Tooltip.Positioner>
                          <Tooltip.Content
                            bg="gray.800"
                            color="white"
                            p={3}
                            borderRadius="md"
                            maxW="320px"
                            boxShadow="lg"
                            zIndex={9999}
                          >
                            <Text fontWeight="semibold" mb={2} fontSize="sm">Expected folder structure:</Text>
                            <Box
                              as="pre"
                              fontSize="xs"
                              whiteSpace="pre-wrap"
                              bg="gray.900"
                              p={2}
                              borderRadius="sm"
                              mb={2}
                            >
{`artifacts/
├── Contract1.sol/
│   └── Contract1.json
├── Contract2.sol/
│   └── Contract2.json
└── ...`}
                            </Box>
                            <Text fontSize="xs">
                              Each .sol directory should contain a JSON file with the contract's ABI.
                            </Text>
                          </Tooltip.Content>
                        </Tooltip.Positioner>
                      </Tooltip.Root>
                    </HStack>
                  </Field.Label>
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
                      bg={{ base: 'white' }}
                      _dark={{ bg: 'gray.800' }}
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
                        bg={{ base: 'white' }}
                        _dark={{ bg: 'gray.800' }}
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
                        bg={{ base: 'white' }}
                        _dark={{ bg: 'gray.800' }}
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
                    bg={{ base: 'white' }}
                    _dark={{ bg: 'gray.800' }}
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
        <GridItem
          overflowY="auto"
          bg={{ base: 'white' }}
          _dark={{ bg: 'gray.800' }}
        >
          <Tabs.Root defaultValue="functions" variant="enclosed">
            <Box borderBottomWidth="1px" px={6} pt={4}>
              <Tabs.List>
                <Tabs.Trigger value="functions">Function Calling</Tabs.Trigger>
                <Tabs.Trigger value="transactions">Transaction Explorer</Tabs.Trigger>
                <Tabs.Trigger value="logs">Event Logs</Tabs.Trigger>
              </Tabs.List>
            </Box>

            <Container maxW="container.lg" py={6}>
              {/* Function Calling Tab */}
              <Tabs.Content value="functions">
                {/* Search Bar */}
                {contractAbi && contractAddress && allFunctions.length > 0 && (
                  <Box mb={6}>
                    <Field.Root>
                      <Field.Label fontWeight="semibold">
                        Search Functions
                        <Text as="span" ml={2} fontSize="xs" color="gray.500" fontWeight="normal">
                          (Ctrl+K or Cmd+K to focus)
                        </Text>
                      </Field.Label>
                      <Input
                        ref={searchInputRef}
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
              </Tabs.Content>

              {/* Transaction Explorer Tab */}
              <Tabs.Content value="transactions">
                {contractAbi ? (
                  <TransactionExplorer
                    contractAbi={contractAbi}
                    chain={genlayerTestnet}
                  />
                ) : (
                  <Center py={12}>
                    <VStack gap={2}>
                      <Text color="gray.500" fontSize="lg">
                        Select a contract from the sidebar
                      </Text>
                      <Text color="gray.400" fontSize="sm">
                        Configure your deployment and contract settings on the left to explore transactions
                      </Text>
                    </VStack>
                  </Center>
                )}
              </Tabs.Content>

              {/* Event Logs Tab */}
              <Tabs.Content value="logs">
                {contractAbi && contractAddress ? (
                  <EventLogsExplorer
                    contractAddress={contractAddress}
                    contractAbi={contractAbi}
                    chain={genlayerTestnet}
                  />
                ) : (
                  <Center py={12}>
                    <VStack gap={2}>
                      <Text color="gray.500" fontSize="lg">
                        Select a contract from the sidebar
                      </Text>
                      <Text color="gray.400" fontSize="sm">
                        Configure your deployment and contract settings on the left to search for event logs
                      </Text>
                    </VStack>
                  </Center>
                )}
              </Tabs.Content>
            </Container>
          </Tabs.Root>
        </GridItem>
      </Grid>
    </Box>
  );
}
