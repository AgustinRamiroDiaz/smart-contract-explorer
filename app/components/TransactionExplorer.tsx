'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http, decodeFunctionData, decodeEventLog, Transaction, TransactionReceipt, Hash } from 'viem';
import {
  Box,
  Text,
  Input,
  Field,
  VStack,
  HStack,
  Code,
  Alert,
  Heading,
  Center,
  Collapsible,
  Grid,
  NativeSelectRoot,
  NativeSelectField,
} from '@chakra-ui/react';
import { JsonEditor } from 'json-edit-react';
import { toaster } from '@/components/ui/toaster';
import { useContract } from '../context/ContractContext';
import type { TransactionExplorerProps, DecodedEventLog, DecodedFunctionData, SerializableValue, AbiFunction, AbiEvent, ContractAbi } from '../types';

// Utility function to convert BigInts to strings for JSON display
function serializeBigInts(obj: unknown): SerializableValue {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts) as SerializableValue[];
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, SerializableValue> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value);
    }
    return result;
  }
  if (obj === null || typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  return String(obj);
}

export default function TransactionExplorer({
  chain
}: TransactionExplorerProps) {
  const {
    deploymentsFile,
    selectedNetwork,
    selectedDeployment,
    abisFolderHandle,
    availableAbis
  } = useContract();

  const [txHash, setTxHash] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionData, setTransactionData] = useState<Transaction | null>(null);
  const [receiptData, setReceiptData] = useState<TransactionReceipt | null>(null);
  const [decodedInput, setDecodedInput] = useState<DecodedFunctionData | { error: string } | null>(null);
  const [decodedEvents, setDecodedEvents] = useState<DecodedEventLog[]>([]);
  const [lastFetchedHash, setLastFetchedHash] = useState<string>('');
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>({});
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [contractAbi, setContractAbi] = useState<ContractAbi | null>(null);
  const [loadingAbi, setLoadingAbi] = useState<boolean>(false);
  const [wasAutoInferred, setWasAutoInferred] = useState<boolean>(false);

  // Get available contracts from the current deployment that have ABIs
  const availableContracts = selectedNetwork && selectedDeployment
    ? Object.keys(deploymentsFile[selectedNetwork]?.[selectedDeployment] || {}).filter(
        (key) => {
          const hasAddress = deploymentsFile[selectedNetwork][selectedDeployment][key]?.startsWith('0x');
          const hasAbi = availableAbis.has(key);
          return hasAddress && hasAbi;
        }
      )
    : [];

  // Helper function to find a contract by its address in the current deployment
  const findContractByAddress = (address: string): string | null => {
    if (!selectedNetwork || !selectedDeployment) return null;

    const deployment = deploymentsFile[selectedNetwork]?.[selectedDeployment];
    if (!deployment) return null;

    // Search for the contract with matching address (case-insensitive)
    const normalizedAddress = address.toLowerCase();
    for (const [contractName, contractAddress] of Object.entries(deployment)) {
      if (contractAddress.toLowerCase() === normalizedAddress) {
        return contractName;
      }
    }

    return null;
  };

  // Load ABI for a specific contract from the ABIs folder
  const loadAbiForContract = async (contractName: string, isAutoInferred: boolean = false) => {
    if (!abisFolderHandle) {
      console.warn('No ABIs folder handle available');
      return null;
    }

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
        console.error('Invalid ABI file format');
        return null;
      }

      return abi;
    } catch (err) {
      console.error('Error loading ABI:', err);
      return null;
    } finally {
      setLoadingAbi(false);
    }
  };

  // Handle manual contract selection from dropdown
  const handleContractChange = async (contractName: string) => {
    setSelectedContract(contractName);
    setWasAutoInferred(false);

    if (!contractName) {
      setContractAbi(null);
      setDecodedInput(null);
      setDecodedEvents([]);
      return;
    }

    // Load the ABI for the selected contract
    const abi = await loadAbiForContract(contractName, false);
    if (abi) {
      setContractAbi(abi);

      // Re-decode the transaction if one is loaded
      if (transactionData && receiptData) {
        await decodeTransactionWithAbi(transactionData, receiptData, abi);
      }

      toaster.success({
        title: 'Contract loaded',
        description: `Loaded ABI for ${contractName}`,
      });
    } else {
      setContractAbi(null);
      toaster.error({
        title: 'Failed to load ABI',
        description: `Could not load ABI for ${contractName}`,
      });
    }
  };

  // Decode transaction with a given ABI
  const decodeTransactionWithAbi = async (transaction: Transaction, receipt: TransactionReceipt, abi: ContractAbi) => {
    // Decode transaction input
    if (transaction.input && transaction.input !== '0x') {
      try {
        const decoded = decodeFunctionData({
          abi: abi,
          data: transaction.input,
        });

        const matchingFunction = abi.find(
          (item): item is AbiFunction => item.type === 'function' && item.name === decoded.functionName
        );

        setDecodedInput({
          functionName: decoded.functionName,
          args: decoded.args || [],
          signature: matchingFunction ? `${matchingFunction.name}(${matchingFunction.inputs.map((input) => `${input.type} ${input.name}`).join(', ')})` : decoded.functionName
        });
      } catch (err) {
        console.error('Failed to decode input:', err);
        setDecodedInput({ error: 'Failed to decode input data. The ABI might not match this transaction.' });
      }
    }

    // Decode events/logs
    if (receipt.logs && receipt.logs.length > 0) {
      const decodedLogs: DecodedEventLog[] = receipt.logs.map((log, index: number) => {
        try {
          const topics = log.topics;
          if (topics && topics.length > 0) {
            const events = abi.filter((item): item is AbiEvent => item.type === 'event');

            for (const event of events) {
              try {
                const decoded = decodeEventLog({
                  abi: [event],
                  data: log.data,
                  topics: topics,
                });
                return {
                  index,
                  blockNumber: log.blockNumber,
                  transactionHash: log.transactionHash,
                  logIndex: log.logIndex,
                  address: log.address,
                  eventName: decoded.eventName,
                  args: decoded.args as Record<string, unknown>,
                  decoded: true,
                };
              } catch {
                continue;
              }
            }
          }

          return {
            index,
            address: log.address,
            topics: log.topics as Hash[],
            data: log.data,
            decoded: false,
          };
        } catch (err) {
          return {
            index,
            address: log.address,
            error: 'Failed to decode log',
            decoded: false,
          };
        }
      });

      setDecodedEvents(decodedLogs);

      const initialExpandedState: Record<number, boolean> = {};
      decodedLogs.forEach((event) => {
        initialExpandedState[event.index] = event.decoded;
      });
      setExpandedEvents(initialExpandedState);
    }
  };

  const handleExplore = async () => {
    if (!txHash || !txHash.startsWith('0x')) {
      setError('Please enter a valid transaction hash starting with 0x');
      return;
    }

    setLoading(true);
    setError(null);
    setTransactionData(null);
    setReceiptData(null);
    setDecodedInput(null);
    setDecodedEvents([]);

    try {
      const client = createPublicClient({
        chain,
        transport: http(),
      });

      // Fetch transaction details
      const transaction = await client.getTransaction({
        hash: txHash as `0x${string}`,
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      setTransactionData(transaction);

      // Fetch transaction receipt
      const receipt = await client.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      setReceiptData(receipt);
      setLastFetchedHash(txHash);

      // Auto-load contract ABI based on transaction's 'to' address
      if (transaction.to) {
        const matchingContract = findContractByAddress(transaction.to);
        if (matchingContract) {
          setSelectedContract(matchingContract);
          setWasAutoInferred(true);

          // Load the ABI for the matched contract
          const abi = await loadAbiForContract(matchingContract, true);
          if (abi) {
            setContractAbi(abi);
            await decodeTransactionWithAbi(transaction, receipt, abi);

            toaster.success({
              title: 'Transaction loaded',
              description: `Auto-loaded contract: ${matchingContract}`,
            });
          } else {
            setContractAbi(null);
            toaster.warning({
              title: 'Transaction loaded',
              description: `Found contract ${matchingContract} but failed to load ABI`,
            });
          }
        } else {
          setSelectedContract('');
          setContractAbi(null);
          setWasAutoInferred(false);
          toaster.info({
            title: 'Transaction loaded',
            description: 'Contract address not found in deployment',
          });
        }
      } else {
        setSelectedContract('');
        setContractAbi(null);
        setWasAutoInferred(false);
        toaster.success({
          title: 'Transaction loaded',
          description: 'Transaction details fetched successfully',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch transaction';
      setError(errorMessage);
      toaster.error({
        title: 'Failed to load transaction',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when a complete transaction hash is entered
  useEffect(() => {
    const isValidHash = txHash.startsWith('0x') && txHash.length === 66;
    const hasChanged = txHash !== lastFetchedHash;

    if (isValidHash && hasChanged && !loading) {
      handleExplore();
    }
  }, [txHash]);

  const toggleEvent = (index: number) => {
    setExpandedEvents(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleEventKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleEvent(index);
    }
  };

  return (
    <VStack gap={6} align="stretch">
      {/* Transaction Hash Input */}
      <Box>
        <Field.Root>
          <Grid templateColumns="200px 1fr auto" gap={3} alignItems="start">
            <Field.Label fontSize="lg" fontWeight="semibold" pt={2}>
              Transaction Hash
            </Field.Label>
            <Box>
              <Input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                textStyle="mono"
              />
              <Field.HelperText textStyle="helperText" mt={1}>
                {loading ? (
                  <Text color="blue.solid">Loading transaction...</Text>
                ) : (
                  'Paste a transaction hash (auto-fetches when complete)'
                )}
              </Field.HelperText>
            </Box>
            <Box minW="300px">
              <Field.Root>
                <Field.Label fontSize="sm" fontWeight="semibold">
                  Contract:
                  {wasAutoInferred && selectedContract && (
                    <Text as="span" ml={2} fontSize="xs" color="blue.fg" fontWeight="normal">
                      (auto-detected)
                    </Text>
                  )}
                  {loadingAbi && (
                    <Text as="span" ml={2} fontSize="xs" color="gray.500" fontWeight="normal">
                      (loading...)
                    </Text>
                  )}
                </Field.Label>
                <NativeSelectRoot size="sm" disabled={loadingAbi || !selectedNetwork || !selectedDeployment}>
                  <NativeSelectField
                    value={selectedContract}
                    onChange={(e) => handleContractChange(e.target.value)}
                    bg={{ base: 'white' }}
                    _dark={{ bg: 'gray.800' }}
                  >
                    <option value="">
                      {!selectedNetwork || !selectedDeployment
                        ? 'Select network/deployment first'
                        : availableContracts.length === 0
                        ? 'No contracts available'
                        : '-- Select a contract --'}
                    </option>
                    {availableContracts.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </NativeSelectField>
                </NativeSelectRoot>
                {!loadingAbi && availableContracts.length > 0 && !selectedContract && (
                  <Text fontSize="xs" color="gray.600" mt={1}>
                    {availableContracts.length} contract{availableContracts.length !== 1 ? 's' : ''} available
                  </Text>
                )}
              </Field.Root>
            </Box>
          </Grid>
        </Field.Root>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert.Root status="error" borderRadius="md">
          <Alert.Indicator />
          <Alert.Title textStyle="label">{error}</Alert.Title>
        </Alert.Root>
      )}

      {/* Transaction Details */}
      {transactionData && (
        <VStack gap={6} align="stretch">
          {/* Basic Transaction Info */}
          <Box layerStyle="card">
            <Box layerStyle="cardSection">
              <Heading size="md" mb={4}>Transaction Details</Heading>
              <VStack gap={3} align="stretch">
                <Box>
                  <Text textStyle="cardHeading">Block Number:</Text>
                  <Code layerStyle="codeInline" display="block">
                    {transactionData.blockNumber?.toString() || 'Pending'}
                  </Code>
                </Box>
                <Box>
                  <Text textStyle="cardHeading">From:</Text>
                  <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                    {transactionData.from}
                  </Code>
                </Box>
                <Box>
                  <Text textStyle="cardHeading">To:</Text>
                  <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                    {transactionData.to || 'Contract Creation'}
                  </Code>
                </Box>
                <Box>
                  <Text textStyle="cardHeading">Value:</Text>
                  <Code layerStyle="codeInline" display="block">
                    {transactionData.value.toString()} wei
                  </Code>
                </Box>
                <Box>
                  <Text textStyle="cardHeading">Gas Used:</Text>
                  <Code layerStyle="codeInline" display="block">
                    {receiptData?.gasUsed?.toString() || 'N/A'}
                  </Code>
                </Box>
                <Box>
                  <Text textStyle="cardHeading">Status:</Text>
                  <Code layerStyle="codeInline" display="block">
                    {receiptData?.status === 'success' ? '✓ Success' : '✗ Failed'}
                  </Code>
                </Box>
              </VStack>
            </Box>
          </Box>

          {/* Decoded Input */}
          {decodedInput && (
            <Box layerStyle="card">
              <Box layerStyle="cardSection">
                <Heading size="md" mb={4}>Decoded Input</Heading>
                {'error' in decodedInput ? (
                  <Alert.Root status="warning" borderRadius="md">
                    <Alert.Indicator />
                    <Alert.Title textStyle="label">{('error' in decodedInput) && decodedInput.error}</Alert.Title>
                  </Alert.Root>
                ) : (
                  <VStack gap={3} align="stretch">
                    <Box>
                      <Text textStyle="cardHeading" mb={2}>Function Signature:</Text>
                      <Code layerStyle="codeBlock">
                        {decodedInput.signature || decodedInput.functionName}
                      </Code>
                    </Box>
                    {decodedInput.args && (
                      <Box>
                        <Text textStyle="cardHeading" mb={2}>Arguments:</Text>
                        <Box layerStyle="codeBlock">
                          <JsonEditor
                            data={serializeBigInts(decodedInput.args)}
                            setData={() => {}}
                            rootName="args"
                            restrictEdit={true}
                            restrictDelete={true}
                            restrictAdd={true}
                          />
                        </Box>
                      </Box>
                    )}
                  </VStack>
                )}
              </Box>
            </Box>
          )}

          {/* Decoded Events */}
          {decodedEvents.length > 0 && (
            <Box layerStyle="card">
              <Box layerStyle="cardSection">
                <Heading size="md" mb={4}>Events ({decodedEvents.length})</Heading>
                <VStack gap={4} align="stretch">
                  {decodedEvents.map((event) => {
                    const isExpanded = expandedEvents[event.index] ?? event.decoded;
                    return (
                      <Box key={event.index} layerStyle="card">
                        {/* Event Header */}
                        <HStack
                          as="button"
                          onClick={() => toggleEvent(event.index)}
                          onKeyDown={(e) => handleEventKeyDown(e, event.index)}
                          p={3}
                          bg="header.bg"
                          cursor="pointer"
                          userSelect="none"
                          _hover={{ bg: 'header.hover' }}
                          _focus={{ outline: '2px solid', outlineColor: 'blue.solid', outlineOffset: '-2px' }}
                          width="full"
                          textAlign="left"
                          transition="all 0.2s"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          aria-label={`Event ${event.index + 1} - ${event.eventName || 'Raw Log'}`}
                        >
                          <Text fontSize="lg">{isExpanded ? '▼' : '▶'}</Text>
                          <VStack align="start" flex={1} gap={1}>
                            <HStack>
                              <Text fontWeight="bold" fontFamily="mono" fontSize="sm">
                                Event #{event.index + 1}
                                {event.eventName && `: ${event.eventName}`}
                              </Text>
                            </HStack>
                          </VStack>
                          {event.decoded && (
                            <Text fontSize="xs" color="green.solid" fontWeight="semibold">✓ Decoded</Text>
                          )}
                          {!event.decoded && (
                            <Text fontSize="xs" color="orange.solid" fontWeight="semibold">⚠ Raw Log</Text>
                          )}
                        </HStack>

                        {/* Expandable Content */}
                        <Collapsible.Root open={isExpanded}>
                          <Collapsible.Content>
                            <Box layerStyle="cardSection">
                              <VStack gap={3} align="stretch">
                                <Box>
                                  <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted">Address:</Text>
                                  <Code layerStyle="codeInline" display="block" mt={1} whiteSpace="pre-wrap" wordBreak="break-all">
                                    {event.address}
                                  </Code>
                                </Box>

                                {event.args && (
                                  <Box>
                                    <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted" mb={1}>Arguments:</Text>
                                    <Box layerStyle="codeBlock">
                                      <JsonEditor
                                        data={serializeBigInts(event.args)}
                                        setData={() => {}}
                                        rootName={`event_${event.index}`}
                                        restrictEdit={true}
                                        restrictDelete={true}
                                        restrictAdd={true}
                                      />
                                    </Box>
                                  </Box>
                                )}

                                {!event.decoded && event.topics && (
                                  <Box>
                                    <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted" mb={1}>Raw Topics:</Text>
                                    <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                                      {JSON.stringify(event.topics, null, 2)}
                                    </Code>
                                  </Box>
                                )}

                                {!event.decoded && event.data && (
                                  <Box>
                                    <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted" mb={1}>Raw Data:</Text>
                                    <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                                      {event.data}
                                    </Code>
                                  </Box>
                                )}
                              </VStack>
                            </Box>
                          </Collapsible.Content>
                        </Collapsible.Root>
                      </Box>
                    );
                  })}
                </VStack>
              </Box>
            </Box>
          )}

          {/* No Events */}
          {receiptData && decodedEvents.length === 0 && (
            <Box layerStyle="card">
              <Box layerStyle="cardSection">
                <Heading size="md" mb={2}>Events</Heading>
                <Text fontSize="sm" color="fg.muted">
                  No events were emitted in this transaction
                </Text>
              </Box>
            </Box>
          )}
        </VStack>
      )}

      {/* Empty State */}
      {!loading && !transactionData && !error && (
        <Center py={12}>
          <VStack gap={2}>
            <Text color="fg.muted" fontSize="lg">
              Enter a transaction hash to explore
            </Text>
            <Text color="fg.subtle" fontSize="sm">
              The contract will be auto-detected from the transaction, or you can select one manually
            </Text>
          </VStack>
        </Center>
      )}
    </VStack>
  );
}
