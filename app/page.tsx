'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from './components/ConnectButton';
import FunctionCard from './components/FunctionCard';
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
} from '@chakra-ui/react';

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
  const [abisFolder, setAbisFolder] = useState('/home/az/genlayer/genlayer-node/third_party/contracts/artifacts');
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [selectedDeployment, setSelectedDeployment] = useState('');
  const [selectedContract, setSelectedContract] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [contractAbi, setContractAbi] = useState<any[] | null>(null);
  const [loadingDeployments, setLoadingDeployments] = useState(true);
  const [loadingAbi, setLoadingAbi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load deployments on mount
  useEffect(() => {
    fetch('/api/deployments')
      .then((res) => res.json())
      .then((data: DeploymentsFile) => {
        if (data.error) {
          setError('Failed to load deployments: ' + data.error);
        } else {
          setDeploymentsFile(data);

          // Auto-select if only one network
          const networks = Object.keys(data);
          if (networks.length === 1) {
            const savedNetwork = localStorage.getItem('selectedNetwork');
            const savedDeployment = localStorage.getItem('selectedDeployment');

            setSelectedNetwork(savedNetwork || networks[0]);
            if (savedDeployment && data[savedNetwork || networks[0]]?.[savedDeployment]) {
              setSelectedDeployment(savedDeployment);
            }
          } else {
            // Restore from localStorage if available
            const savedNetwork = localStorage.getItem('selectedNetwork');
            const savedDeployment = localStorage.getItem('selectedDeployment');

            if (savedNetwork && data[savedNetwork]) {
              setSelectedNetwork(savedNetwork);
              if (savedDeployment && data[savedNetwork]?.[savedDeployment]) {
                setSelectedDeployment(savedDeployment);
              }
            }
          }
        }
        setLoadingDeployments(false);
      })
      .catch((err) => {
        setError('Failed to load deployments: ' + err.message);
        setLoadingDeployments(false);
      });
  }, []);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setDeploymentsFile(data);
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

  // Load ABI when contract is selected or abisFolder changes
  useEffect(() => {
    if (selectedContract && abisFolder) {
      setLoadingAbi(true);
      setContractAbi(null);

      fetch(`/api/abi/${selectedContract}?folder=${encodeURIComponent(abisFolder)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            console.warn('ABI not found for contract:', selectedContract);
            setContractAbi(null);
          } else {
            setContractAbi(data.abi);
          }
          setLoadingAbi(false);
        })
        .catch((err) => {
          console.error('Error loading ABI:', err);
          setContractAbi(null);
          setLoadingAbi(false);
        });
    } else {
      setContractAbi(null);
    }
  }, [selectedContract, abisFolder]);

  // State to track which contracts have ABIs available
  const [availableAbis, setAvailableAbis] = useState<Set<string>>(new Set());
  const [loadingAbiList, setLoadingAbiList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch list of available ABIs from the server
  useEffect(() => {
    if (!abisFolder) {
      setAvailableAbis(new Set());
      return;
    }

    setLoadingAbiList(true);

    fetch(`/api/abis/list?folder=${encodeURIComponent(abisFolder)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.contracts) {
          setAvailableAbis(new Set(data.contracts));
        } else {
          setAvailableAbis(new Set());
        }
        setLoadingAbiList(false);
      })
      .catch((err) => {
        console.error('Error fetching ABI list:', err);
        setAvailableAbis(new Set());
        setLoadingAbiList(false);
      });
  }, [abisFolder]);

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
            <Box>
              <Heading size="md" mb={4}>Configuration</Heading>
            </Box>

            {loadingDeployments ? (
              <Center py={8}>
                <Spinner size="lg" />
              </Center>
            ) : (
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
                  <Field.Label fontSize="sm" fontWeight="semibold">ABIs Folder Path:</Field.Label>
                  <Input
                    value={abisFolder}
                    onChange={(e) => setAbisFolder(e.target.value)}
                    placeholder="/path/to/artifacts"
                    bg="white"
                    fontSize="sm"
                  />
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
                          {loadingAbiList ? 'Loading...' : contractNames.length === 0 ? 'No contracts with ABIs found' : '-- Select a contract --'}
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
