'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Heading,
  Card,
  Badge,
  Spinner,
  Center,
  Code,
  Field,
} from '@chakra-ui/react';
import { Checkbox } from '@chakra-ui/react';
import { NativeSelectRoot, NativeSelectField } from '@chakra-ui/react';
import { createPublicClient, http, type Chain, type Hash, isAddress, encodeAbiParameters, keccak256, parseAbiParameters, decodeEventLog, decodeFunctionData } from 'viem';
import { ContractAbi, DecodedEventLog } from '@/app/types';
import type { DeploymentsFile } from '@/app/types';

interface DebuggerProps {
  deploymentsFile: DeploymentsFile;
  selectedNetwork: string;
  chain: Chain;
  abisFolderHandle: FileSystemDirectoryHandle | null;
}

interface SearchResult {
  type: 'event' | 'transaction';
  blockNumber: bigint;
  transactionHash: Hash;
  address?: string;
  contractName?: string;
  eventName?: string;
  decoded: any;
  raw?: any;
}

export default function Debugger({
  deploymentsFile,
  selectedNetwork,
  chain,
  abisFolderHandle,
}: DebuggerProps) {
  const [searchValue, setSearchValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fromBlock, setFromBlock] = useState('');
  const [toBlock, setToBlock] = useState('');
  const [selectedDeployment, setSelectedDeployment] = useState<string>('');
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [availableContracts, setAvailableContracts] = useState<string[]>([]);

  // Update available contracts when deployment changes
  useEffect(() => {
    if (selectedDeployment && deploymentsFile[selectedNetwork]?.[selectedDeployment]) {
      const contracts = Object.keys(deploymentsFile[selectedNetwork][selectedDeployment]);
      setAvailableContracts(contracts);
      // Select all contracts by default
      setSelectedContracts(contracts);
    } else {
      setAvailableContracts([]);
      setSelectedContracts([]);
    }
  }, [selectedDeployment, selectedNetwork, deploymentsFile]);

  // Helper function to load ABI from folder
  const loadAbi = async (contractName: string): Promise<ContractAbi | null> => {
    if (!abisFolderHandle) return null;

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
      const abi: ContractAbi = Array.isArray(data) ? data : data.abi;

      return abi && Array.isArray(abi) ? abi : null;
    } catch (err) {
      console.error(`Error loading ABI for ${contractName}:`, err);
      return null;
    }
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      setError('Please enter a search value');
      return;
    }

    if (!selectedDeployment) {
      setError('Please select a deployment');
      return;
    }

    if (selectedContracts.length === 0) {
      setError('Please select at least one contract');
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      const client = createPublicClient({
        chain,
        transport: http(),
      });

      const searchResults: SearchResult[] = [];

      // Get the selected deployment
      const networkDeployments = deploymentsFile[selectedNetwork];
      if (!networkDeployments) {
        throw new Error('No deployments found for selected network');
      }

      const deployment = networkDeployments[selectedDeployment];
      if (!deployment) {
        throw new Error('Selected deployment not found');
      }

      // Prepare search value as a topic (if it's a valid hex or address)
      let searchTopic: Hash | undefined;
      try {
        // Try to format as address first
        if (isAddress(searchValue)) {
          searchTopic = ('0x' + searchValue.replace('0x', '').toLowerCase().padStart(64, '0')) as Hash;
        } else if (searchValue.startsWith('0x')) {
          // Already hex
          searchTopic = searchValue.padEnd(66, '0') as Hash;
        } else {
          // Try to encode as string/bytes
          const encoded = encodeAbiParameters(
            parseAbiParameters('string'),
            [searchValue]
          );
          searchTopic = keccak256(encoded);
        }
      } catch (e) {
        // If encoding fails, we'll just search in decoded values
      }

      // Search through selected contracts only
      for (const contractName of selectedContracts) {
        const address = deployment[contractName];
        if (!address) continue;

        const contractAbi = await loadAbi(contractName);
        if (!contractAbi) continue;

          // Search events by topics
          try {
            const logs = await client.getLogs({
              address: address as `0x${string}`,
              fromBlock: fromBlock ? BigInt(fromBlock) : undefined,
              toBlock: toBlock ? BigInt(toBlock) : undefined,
            });

            // Filter logs that contain the search value
            for (const log of logs) {
              let matchFound = false;
              let decodedArgs: any = null;

              // Check if search value is in topics
              if (searchTopic && log.topics.some(topic =>
                topic.toLowerCase().includes(searchTopic!.toLowerCase().replace('0x', '')) ||
                searchTopic!.toLowerCase().includes(topic.toLowerCase().replace('0x', ''))
              )) {
                matchFound = true;
              }

              // Try to decode and check if search value is in decoded args
              const events = contractAbi.filter((item): item is any => item.type === 'event');
              for (const event of events) {
                try {
                  const decoded = decodeEventLog({
                    abi: [event],
                    data: log.data,
                    topics: log.topics,
                  }) as { eventName: string; args: any };

                  decodedArgs = decoded.args;
                  const argsString = JSON.stringify(decoded.args, (_, v) =>
                    typeof v === 'bigint' ? v.toString() : v
                  ).toLowerCase();

                  if (argsString.includes(searchValue.toLowerCase())) {
                    matchFound = true;
                  }

                  if (matchFound) {
                    searchResults.push({
                      type: 'event',
                      blockNumber: log.blockNumber!,
                      transactionHash: log.transactionHash!,
                      address: address,
                      contractName,
                      eventName: decoded.eventName,
                      decoded: decoded.args,
                      raw: log,
                    });
                    break;
                  }
                } catch (e) {
                  // Continue to next event
                }
              }

              // If no event decoded but topic matched, add as raw
              if (matchFound && !decodedArgs) {
                searchResults.push({
                  type: 'event',
                  blockNumber: log.blockNumber!,
                  transactionHash: log.transactionHash!,
                  address: address,
                  contractName,
                  decoded: null,
                  raw: log,
                });
              }
            }
          } catch (e) {
            console.error(`Error searching events for ${contractName}:`, e);
          }

          // Search transactions by decoding function calls
          try {
            const latestBlock = await client.getBlockNumber();
            const startBlock = fromBlock ? BigInt(fromBlock) : latestBlock - BigInt(100);
            const endBlock = toBlock ? BigInt(toBlock) : latestBlock;

            // Scan recent blocks for transactions to this contract
            for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
              try {
                const block = await client.getBlock({ blockNumber: blockNum, includeTransactions: true });

                for (const tx of block.transactions) {
                  if (typeof tx === 'string') continue;

                  if (tx.to?.toLowerCase() === address.toLowerCase()) {
                    // Try to decode the transaction input
                    const functions = contractAbi.filter((item): item is any => item.type === 'function');

                    for (const func of functions) {
                      try {
                        const decoded = decodeFunctionData({
                          abi: [func],
                          data: tx.input,
                        }) as { functionName: string; args: any };

                        const argsString = JSON.stringify(decoded.args, (_, v) =>
                          typeof v === 'bigint' ? v.toString() : v
                        ).toLowerCase();

                        if (argsString.includes(searchValue.toLowerCase())) {
                          searchResults.push({
                            type: 'transaction',
                            blockNumber: blockNum,
                            transactionHash: tx.hash,
                            address: address,
                            contractName,
                            eventName: decoded.functionName,
                            decoded: decoded.args,
                            raw: tx,
                          });
                          break;
                        }
                      } catch (e) {
                        // Continue to next function
                      }
                    }
                  }
                }
              } catch (e) {
                console.error(`Error scanning block ${blockNum}:`, e);
              }
            }
          } catch (e) {
            console.error(`Error searching transactions for ${contractName}:`, e);
          }
      }

      // Sort by block number descending
      searchResults.sort((a, b) => Number(b.blockNumber - a.blockNumber));
      setResults(searchResults);

      if (searchResults.length === 0) {
        setError('No results found');
      }
    } catch (e) {
      console.error('Search error:', e);
      setError(e instanceof Error ? e.message : 'An error occurred during search');
    } finally {
      setIsSearching(false);
    }
  };

  // Get available deployments
  const availableDeployments = Object.keys(deploymentsFile[selectedNetwork] || {});

  return (
    <VStack gap={6} align="stretch">
      <Box>
        <Heading size="lg" mb={4}>
          Debugger
        </Heading>
        <Text color="gray.600" _dark={{ color: 'gray.400' }} mb={6}>
          Search for events and transactions containing a specific value
        </Text>

        <VStack gap={4} align="stretch">
          <Field.Root>
            <Field.Label fontSize="sm" fontWeight="semibold">Deployment *</Field.Label>
            <NativeSelectRoot>
              <NativeSelectField
                value={selectedDeployment}
                onChange={(e) => setSelectedDeployment(e.target.value)}
                placeholder="Select a deployment"
              >
                <option value="">Select a deployment</option>
                {availableDeployments.map((deployment) => (
                  <option key={deployment} value={deployment}>
                    {deployment}
                  </option>
                ))}
              </NativeSelectField>
            </NativeSelectRoot>
            <Field.HelperText fontSize="xs">
              Select the deployment to search within
            </Field.HelperText>
          </Field.Root>

          {selectedDeployment && availableContracts.length > 0 && (
            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">
                Contracts * ({selectedContracts.length} of {availableContracts.length} selected)
              </Field.Label>
              <Box
                p={3}
                borderWidth="1px"
                borderRadius="md"
                maxH="200px"
                overflowY="auto"
              >
                <VStack align="stretch" gap={2}>
                  <Checkbox.Root
                    checked={selectedContracts.length === availableContracts.length}
                    onCheckedChange={(e) => {
                      if (e.checked) {
                        setSelectedContracts(availableContracts);
                      } else {
                        setSelectedContracts([]);
                      }
                    }}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label fontWeight="semibold">Select All</Checkbox.Label>
                  </Checkbox.Root>
                  <Box borderTopWidth="1px" pt={2}>
                    {availableContracts.map((contract) => (
                      <Checkbox.Root
                        key={contract}
                        checked={selectedContracts.includes(contract)}
                        onCheckedChange={(e) => {
                          if (e.checked) {
                            setSelectedContracts([...selectedContracts, contract]);
                          } else {
                            setSelectedContracts(selectedContracts.filter((c) => c !== contract));
                          }
                        }}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                        <Checkbox.Label>{contract}</Checkbox.Label>
                      </Checkbox.Root>
                    ))}
                  </Box>
                </VStack>
              </Box>
              <Field.HelperText fontSize="xs">
                Select which contracts to search (all selected by default)
              </Field.HelperText>
            </Field.Root>
          )}

          <Field.Root>
            <Field.Label fontSize="sm" fontWeight="semibold">Search Value *</Field.Label>
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="e.g., ABC, 0x1234..., or an address"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <Field.HelperText fontSize="xs">
              Enter a value to search in event topics and transaction parameters
            </Field.HelperText>
          </Field.Root>

          <HStack gap={4}>
            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">From Block (optional)</Field.Label>
              <Input
                type="number"
                value={fromBlock}
                onChange={(e) => setFromBlock(e.target.value)}
                placeholder="Start block"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">To Block (optional)</Field.Label>
              <Input
                type="number"
                value={toBlock}
                onChange={(e) => setToBlock(e.target.value)}
                placeholder="End block (latest if empty)"
              />
            </Field.Root>
          </HStack>

          <Button
            colorScheme="blue"
            onClick={handleSearch}
            disabled={isSearching || !searchValue.trim() || !selectedDeployment || selectedContracts.length === 0}
            width="full"
          >
            {isSearching ? (
              <HStack>
                <Spinner size="sm" />
                <Text>Searching...</Text>
              </HStack>
            ) : (
              'Search'
            )}
          </Button>
        </VStack>
      </Box>

      {error && (
        <Card.Root bg="red.50" _dark={{ bg: 'red.900' }} borderColor="red.200">
          <Card.Body>
            <Text color="red.700" _dark={{ color: 'red.200' }}>
              {error}
            </Text>
          </Card.Body>
        </Card.Root>
      )}

      {results.length > 0 && (
        <Box>
          <Heading size="md" mb={4}>
            Results ({results.length})
          </Heading>

          <VStack gap={4} align="stretch">
            {results.map((result, idx) => (
              <Card.Root key={idx}>
                <Card.Body>
                  <VStack align="stretch" gap={3}>
                    <HStack justify="space-between">
                      <HStack>
                        <Badge colorScheme={result.type === 'event' ? 'green' : 'blue'}>
                          {result.type}
                        </Badge>
                        {result.contractName && (
                          <Badge colorScheme="purple">{result.contractName}</Badge>
                        )}
                        {result.eventName && (
                          <Text fontWeight="bold">{result.eventName}</Text>
                        )}
                      </HStack>
                      <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
                        Block: {result.blockNumber.toString()}
                      </Text>
                    </HStack>

                    <Box>
                      <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={1}>
                        Transaction Hash:
                      </Text>
                      <Code fontSize="xs" p={2} borderRadius="md">
                        {result.transactionHash}
                      </Code>
                    </Box>

                    {result.address && (
                      <Box>
                        <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={1}>
                          Contract Address:
                        </Text>
                        <Code fontSize="xs" p={2} borderRadius="md">
                          {result.address}
                        </Code>
                      </Box>
                    )}

                    {result.decoded && (
                      <Box>
                        <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={1}>
                          Decoded Data:
                        </Text>
                        <Code
                          display="block"
                          whiteSpace="pre-wrap"
                          p={3}
                          borderRadius="md"
                          fontSize="xs"
                        >
                          {JSON.stringify(
                            result.decoded,
                            (_, v) => (typeof v === 'bigint' ? v.toString() : v),
                            2
                          )}
                        </Code>
                      </Box>
                    )}
                  </VStack>
                </Card.Body>
              </Card.Root>
            ))}
          </VStack>
        </Box>
      )}

      {!isSearching && results.length === 0 && !error && (
        <Center py={12}>
          <VStack gap={2}>
            <Text color="gray.500" fontSize="lg">
              Enter a search value to find matching events and transactions
            </Text>
            <Text color="gray.400" fontSize="sm">
              Searches will look through event topics and transaction parameters
            </Text>
          </VStack>
        </Center>
      )}
    </VStack>
  );
}
