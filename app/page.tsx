'use client';

import { useState, useEffect } from 'react';
import { defineChain } from 'viem';
import FunctionCard from './components/FunctionCard';
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

// Define GenLayer Testnet
const genlayerTestnet = defineChain({
  id: 123420000220,
  name: 'GenLayer Testnet',
  network: 'genlayer-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'GenLayer',
    symbol: 'GEN',
  },
  rpcUrls: {
    default: {
      http: ['https://genlayer-testnet.rpc.caldera.xyz/http'],
    },
    public: {
      http: ['https://genlayer-testnet.rpc.caldera.xyz/http'],
    },
  },
});

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

  // Check which ABIs are available when deployment changes
  useEffect(() => {
    if (!selectedNetwork || !selectedDeployment || !abisFolder) {
      setAvailableAbis(new Set());
      return;
    }

    const deployment = deploymentsFile[selectedNetwork]?.[selectedDeployment];
    if (!deployment) {
      setAvailableAbis(new Set());
      return;
    }

    // Get all contract names
    const contracts = Object.keys(deployment).filter(
      (key) => deployment[key]?.startsWith('0x')
    );

    // Check each contract for ABI availability
    const checkAbis = async () => {
      const available = new Set<string>();
      await Promise.all(
        contracts.map(async (contractName) => {
          try {
            const response = await fetch(
              `/api/abi/${contractName}?folder=${encodeURIComponent(abisFolder)}`
            );
            if (response.ok) {
              available.add(contractName);
            }
          } catch (err) {
            // ABI not available for this contract
          }
        })
      );
      setAvailableAbis(available);
    };

    checkAbis();
  }, [selectedNetwork, selectedDeployment, abisFolder, deploymentsFile]);

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

  // Get read functions from ABI (view and pure functions)
  const readFunctions: AbiFunction[] = contractAbi
    ? contractAbi.filter(
        (item: any) =>
          item.type === 'function' &&
          (item.stateMutability === 'view' || item.stateMutability === 'pure')
      )
    : [];

  return (
    <Container maxW="container.md" py={8}>
      <Heading mb={6}>GenLayer Contract Explorer</Heading>

      {loadingDeployments ? (
        <Center mt={8}>
          <Spinner size="lg" />
        </Center>
      ) : (
        <VStack gap={4} align="stretch">
          <Field.Root>
            <Field.Label>Load Deployments File:</Field.Label>
            <Input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              pt={1}
            />
          </Field.Root>

          <Field.Root>
            <Field.Label>ABIs Folder Path:</Field.Label>
            <Input
              value={abisFolder}
              onChange={(e) => setAbisFolder(e.target.value)}
              placeholder="/path/to/artifacts"
            />
          </Field.Root>

          <Field.Root>
            <Field.Label>Select Network:</Field.Label>
            <NativeSelectRoot>
              <NativeSelectField
                value={selectedNetwork}
                onChange={(e) => {
                  setSelectedNetwork(e.target.value);
                  setSelectedDeployment('');
                  setSelectedContract('');
                  setError(null);
                }}
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
              <Field.Label>Select Deployment:</Field.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={selectedDeployment}
                  onChange={(e) => {
                    setSelectedDeployment(e.target.value);
                    setSelectedContract('');
                    setError(null);
                  }}
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
              <Field.Label>Select Contract:</Field.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={selectedContract}
                  onChange={(e) => {
                    setSelectedContract(e.target.value);
                    setError(null);
                  }}
                >
                  <option value="">-- Select a contract --</option>
                  {contractNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
          )}

          <Field.Root>
            <Field.Label>Contract Address:</Field.Label>
            <Input
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="0x... or select from deployments above"
            />
          </Field.Root>

        </VStack>
      )}

      {/* Display error if any */}
      {error && (
        <Alert.Root status="error" mt={4}>
          <Alert.Indicator />
          <Alert.Title>{error}</Alert.Title>
        </Alert.Root>
      )}

      {/* Loading ABI indicator */}
      {loadingAbi && (
        <Center mt={8}>
          <VStack>
            <Spinner />
            <Text color="gray.600">Loading contract ABI...</Text>
          </VStack>
        </Center>
      )}

      {/* Function List - Swagger-like UI */}
      {contractAbi && contractAddress && readFunctions.length > 0 && (
        <Box mt={8}>
          <Heading size="lg" mb={2}>Available Functions</Heading>
          <Text fontSize="sm" color="gray.600" mb={4}>
            {readFunctions.length} read function{readFunctions.length !== 1 ? 's' : ''} available
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

      {/* No functions message */}
      {contractAbi && contractAddress && readFunctions.length === 0 && (
        <Center mt={8}>
          <Text color="gray.600">
            No read functions found in this contract's ABI
          </Text>
        </Center>
      )}
    </Container>
  );
}
