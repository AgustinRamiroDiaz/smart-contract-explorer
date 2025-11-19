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
import { createPublicClient, http, type Chain, type Hash, decodeFunctionData } from 'viem';
import { ContractAbi } from '@/app/types';
import { useContract } from '@/app/context/ContractContext';

interface DebuggerProps {
  chain: Chain;
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

export default function Debugger({ chain }: DebuggerProps) {
  const {
    selectedContract,
    contractAddress,
    abisFolderHandle,
  } = useContract();

  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fromBlock, setFromBlock] = useState('');
  const [toBlock, setToBlock] = useState('');
  const [writeMethods, setWriteMethods] = useState<string[]>([]);
  const [selectedWriteMethods, setSelectedWriteMethods] = useState<string[]>([]);

  // Load write methods when contract changes
  useEffect(() => {
    const loadWriteMethods = async () => {
      if (!selectedContract) {
        setWriteMethods([]);
        setSelectedWriteMethods([]);
        return;
      }

      const contractAbi = await loadAbi(selectedContract);
      if (!contractAbi) {
        setWriteMethods([]);
        setSelectedWriteMethods([]);
        return;
      }

      // Get all write methods (non-view, non-pure functions)
      const methods = contractAbi
        .filter((item): item is any =>
          item.type === 'function' &&
          item.stateMutability !== 'view' &&
          item.stateMutability !== 'pure'
        )
        .map(item => item.name);

      setWriteMethods(methods);
      // Select all methods by default
      setSelectedWriteMethods(methods);
    };

    loadWriteMethods();
  }, [selectedContract]);

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
    if (!selectedContract) {
      setError('Please select a contract from the sidebar');
      return;
    }

    if (!contractAddress) {
      setError('Contract address not available');
      return;
    }

    if (selectedWriteMethods.length === 0) {
      setError('Please select at least one write method');
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

      const contractAbi = await loadAbi(selectedContract);
      if (!contractAbi) {
        throw new Error('Could not load contract ABI');
      }

      // Search transactions by decoding function calls
      try {
        const latestBlock = await client.getBlockNumber();
        const startBlock = fromBlock ? BigInt(fromBlock) : latestBlock - BigInt(100);
        const endBlock = toBlock ? BigInt(toBlock) : latestBlock;

        // Scan blocks for transactions to this contract
        for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
          try {
            const block = await client.getBlock({ blockNumber: blockNum, includeTransactions: true });

            for (const tx of block.transactions) {
              if (typeof tx === 'string') continue;

              if (tx.to?.toLowerCase() === contractAddress.toLowerCase()) {
                // Try to decode the transaction input
                const functions = contractAbi.filter((item): item is any => item.type === 'function');

                for (const func of functions) {
                  try {
                    const decoded = decodeFunctionData({
                      abi: [func],
                      data: tx.input,
                    }) as { functionName: string; args: any };

                    // Check if this function is in the selected write methods
                    if (selectedWriteMethods.includes(decoded.functionName)) {
                      searchResults.push({
                        type: 'transaction',
                        blockNumber: blockNum,
                        transactionHash: tx.hash,
                        address: contractAddress,
                        contractName: selectedContract,
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
        console.error(`Error searching transactions for ${selectedContract}:`, e);
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

  return (
    <VStack gap={6} align="stretch">
      <Box>
        <Heading size="lg" mb={4}>
          Debugger
        </Heading>
        <Text color="gray.600" _dark={{ color: 'gray.400' }} mb={6}>
          Search for all calls to the selected contract's write methods
        </Text>

        {!selectedContract && (
          <Card.Root bg="blue.50" _dark={{ bg: 'blue.900' }} borderColor="blue.200">
            <Card.Body>
              <Text color="blue.700" _dark={{ color: 'blue.200' }}>
                Please select a contract from the sidebar to begin
              </Text>
            </Card.Body>
          </Card.Root>
        )}

        {selectedContract && (
          <VStack gap={4} align="stretch">
            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">
                Selected Contract: <Badge colorScheme="purple">{selectedContract}</Badge>
              </Field.Label>
              <Code fontSize="xs" p={2} borderRadius="md">
                {contractAddress}
              </Code>
            </Field.Root>

            {writeMethods.length > 0 ? (
            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">
                Write Methods * ({selectedWriteMethods.length} of {writeMethods.length} selected)
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
                    checked={selectedWriteMethods.length === writeMethods.length}
                    onCheckedChange={(e) => {
                      if (e.checked) {
                        setSelectedWriteMethods(writeMethods);
                      } else {
                        setSelectedWriteMethods([]);
                      }
                    }}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label fontWeight="semibold">Select All</Checkbox.Label>
                  </Checkbox.Root>
                  <Box borderTopWidth="1px" pt={2}>
                    <VStack align="stretch" gap={2}>
                      {writeMethods.map((method) => (
                        <Checkbox.Root
                          key={method}
                          checked={selectedWriteMethods.includes(method)}
                          onCheckedChange={(e) => {
                            if (e.checked) {
                              setSelectedWriteMethods([...selectedWriteMethods, method]);
                            } else {
                              setSelectedWriteMethods(selectedWriteMethods.filter((m) => m !== method));
                            }
                          }}
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control />
                          <Checkbox.Label>{method}</Checkbox.Label>
                        </Checkbox.Root>
                      ))}
                    </VStack>
                  </Box>
                </VStack>
              </Box>
              <Field.HelperText fontSize="xs">
                Select which write methods to search for (all selected by default)
              </Field.HelperText>
            </Field.Root>
            ) : (
              <Card.Root bg="yellow.50" _dark={{ bg: 'yellow.900' }} borderColor="yellow.200">
                <Card.Body>
                  <Text color="yellow.700" _dark={{ color: 'yellow.200' }} fontSize="sm">
                    This contract has no write methods (all methods are view/pure functions).
                  </Text>
                </Card.Body>
              </Card.Root>
            )}

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

            <VStack gap={2} align="stretch">
              <Button
                colorScheme="blue"
                onClick={handleSearch}
                disabled={isSearching || !selectedContract || !contractAddress || selectedWriteMethods.length === 0}
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
              {!isSearching && selectedContract && (
                <Text fontSize="xs" color="gray.500" _dark={{ color: 'gray.400' }}>
                  {!contractAddress ? '⚠️ Contract address is missing' :
                   selectedWriteMethods.length === 0 ? '⚠️ Select at least one write method' :
                   '✓ Ready to search'}
                </Text>
              )}
            </VStack>
          </VStack>
        )}
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

      {!isSearching && results.length === 0 && !error && !selectedContract && (
        <Center py={12}>
          <VStack gap={2}>
            <Text color="gray.500" fontSize="lg">
              Select a contract and write methods to search
            </Text>
            <Text color="gray.400" fontSize="sm">
              All transactions calling the selected write methods will be displayed
            </Text>
          </VStack>
        </Center>
      )}
    </VStack>
  );
}
