'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http, decodeFunctionData, decodeEventLog } from 'viem';
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
} from '@chakra-ui/react';
import { JsonEditor } from 'json-edit-react';
import { toaster } from '@/components/ui/toaster';

interface TransactionExplorerProps {
  contractAbi: any[];
  chain: any;
}

// Utility function to convert BigInts to strings for JSON display
function serializeBigInts(obj: any): any {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, serializeBigInts(value)])
    );
  }
  return obj;
}

export default function TransactionExplorer({
  contractAbi,
  chain
}: TransactionExplorerProps) {
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [decodedInput, setDecodedInput] = useState<any>(null);
  const [decodedEvents, setDecodedEvents] = useState<any[]>([]);
  const [lastFetchedHash, setLastFetchedHash] = useState<string>('');
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>({});

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

      // Decode transaction input
      if (transaction.input && transaction.input !== '0x') {
        try {
          const decoded = decodeFunctionData({
            abi: contractAbi,
            data: transaction.input,
          });
          setDecodedInput(decoded);
        } catch (err) {
          console.error('Failed to decode input:', err);
          setDecodedInput({ error: 'Failed to decode input data. The ABI might not match this transaction.' });
        }
      }

      // Decode events/logs
      if (receipt.logs && receipt.logs.length > 0) {
        const decodedLogs = receipt.logs.map((log: any, index: number) => {
          try {
            // Try to decode each log with the ABI
            const topics = log.topics;
            if (topics && topics.length > 0) {
              // Find the matching event in the ABI
              const events = contractAbi.filter((item: any) => item.type === 'event');

              for (const event of events) {
                try {
                  const decoded = decodeEventLog({
                    abi: [event],
                    data: log.data,
                    topics: topics,
                  }) as { eventName: string; args: any };
                  return {
                    index,
                    address: log.address,
                    eventName: decoded.eventName,
                    args: decoded.args,
                    decoded: true,
                  };
                } catch {
                  // Try next event
                  continue;
                }
              }
            }

            // If we couldn't decode, return raw log
            return {
              index,
              address: log.address,
              topics: log.topics,
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

        // Set initial expanded state: decoded events are expanded, raw logs are collapsed
        const initialExpandedState: Record<number, boolean> = {};
        decodedLogs.forEach((event) => {
          initialExpandedState[event.index] = event.decoded;
        });
        setExpandedEvents(initialExpandedState);
      }

      setLastFetchedHash(txHash);
      toaster.success({
        title: 'Transaction loaded',
        description: 'Transaction details fetched successfully',
      });
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
          <Field.Label fontSize="lg" fontWeight="semibold">
            Transaction Hash
          </Field.Label>
          <Input
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x..."
            fontFamily="mono"
            fontSize="sm"
          />
          <Field.HelperText fontSize="xs">
            {loading ? (
              <Text color="blue.600">Loading transaction...</Text>
            ) : (
              'Paste a transaction hash (auto-fetches when complete)'
            )}
          </Field.HelperText>
        </Field.Root>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert.Root status="error" borderRadius="md">
          <Alert.Indicator />
          <Alert.Title fontSize="sm">{error}</Alert.Title>
        </Alert.Root>
      )}

      {/* Transaction Details */}
      {transactionData && (
        <VStack gap={6} align="stretch">
          {/* Basic Transaction Info */}
          <Box borderWidth="1px" borderRadius="lg" p={4}>
            <Heading size="md" mb={4}>Transaction Details</Heading>
            <VStack gap={3} align="stretch">
              <Box>
                <Text fontSize="sm" fontWeight="semibold" color="gray.600">Block Number:</Text>
                <Code display="block" p={2} fontSize="xs">
                  {transactionData.blockNumber?.toString() || 'Pending'}
                </Code>
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="semibold" color="gray.600">From:</Text>
                <Code display="block" p={2} fontSize="xs" whiteSpace="pre-wrap" wordBreak="break-all">
                  {transactionData.from}
                </Code>
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="semibold" color="gray.600">To:</Text>
                <Code display="block" p={2} fontSize="xs" whiteSpace="pre-wrap" wordBreak="break-all">
                  {transactionData.to || 'Contract Creation'}
                </Code>
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="semibold" color="gray.600">Value:</Text>
                <Code display="block" p={2} fontSize="xs">
                  {transactionData.value.toString()} wei
                </Code>
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="semibold" color="gray.600">Gas Used:</Text>
                <Code display="block" p={2} fontSize="xs">
                  {receiptData?.gasUsed?.toString() || 'N/A'}
                </Code>
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="semibold" color="gray.600">Status:</Text>
                <Code display="block" p={2} fontSize="xs">
                  {receiptData?.status === 'success' ? '✓ Success' : '✗ Failed'}
                </Code>
              </Box>
            </VStack>
          </Box>

          {/* Decoded Input */}
          {decodedInput && (
            <Box borderWidth="1px" borderRadius="lg" p={4}>
              <Heading size="md" mb={4}>Decoded Input</Heading>
              {decodedInput.error ? (
                <Alert.Root status="warning" borderRadius="md">
                  <Alert.Indicator />
                  <Alert.Title fontSize="sm">{decodedInput.error}</Alert.Title>
                </Alert.Root>
              ) : (
                <VStack gap={3} align="stretch">
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" color="gray.600">Function Name:</Text>
                    <Code display="block" p={2} fontSize="sm">
                      {decodedInput.functionName}
                    </Code>
                  </Box>
                  {decodedInput.args && (
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold" color="gray.600" mb={2}>Arguments:</Text>
                      <Box bg="gray.50" p={3} borderRadius="md">
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
          )}

          {/* Decoded Events */}
          {decodedEvents.length > 0 && (
            <Box borderWidth="1px" borderRadius="lg" p={4}>
              <Heading size="md" mb={4}>Events ({decodedEvents.length})</Heading>
              <VStack gap={4} align="stretch">
                {decodedEvents.map((event) => {
                  const isExpanded = expandedEvents[event.index] ?? event.decoded;
                  return (
                    <Box key={event.index} borderWidth="1px" borderRadius="lg" overflow="hidden">
                      {/* Event Header */}
                      <HStack
                        as="button"
                        onClick={() => toggleEvent(event.index)}
                        onKeyDown={(e) => handleEventKeyDown(e, event.index)}
                        p={3}
                        bg="gray.50"
                        cursor="pointer"
                        userSelect="none"
                        _hover={{ bg: 'gray.100' }}
                        _focus={{ outline: '2px solid', outlineColor: 'blue.500', outlineOffset: '-2px' }}
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
                          <Text fontSize="xs" color="green.600" fontWeight="semibold">✓ Decoded</Text>
                        )}
                        {!event.decoded && (
                          <Text fontSize="xs" color="orange.600" fontWeight="semibold">⚠ Raw Log</Text>
                        )}
                      </HStack>

                      {/* Expandable Content */}
                      <Collapsible.Root open={isExpanded}>
                        <Collapsible.Content>
                          <Box p={4} bg="white">
                            <VStack gap={3} align="stretch">
                              <Box>
                                <Text fontSize="xs" fontWeight="semibold" color="gray.600">Address:</Text>
                                <Code display="block" p={2} fontSize="xs" mt={1} whiteSpace="pre-wrap" wordBreak="break-all">
                                  {event.address}
                                </Code>
                              </Box>

                              {event.args && (
                                <Box>
                                  <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>Arguments:</Text>
                                  <Box bg="gray.50" p={2} borderRadius="md">
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
                                  <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>Raw Topics:</Text>
                                  <Code display="block" p={2} fontSize="xs" whiteSpace="pre-wrap" wordBreak="break-all">
                                    {JSON.stringify(event.topics, null, 2)}
                                  </Code>
                                </Box>
                              )}

                              {!event.decoded && event.data && (
                                <Box>
                                  <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>Raw Data:</Text>
                                  <Code display="block" p={2} fontSize="xs" whiteSpace="pre-wrap" wordBreak="break-all">
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
          )}

          {/* No Events */}
          {receiptData && decodedEvents.length === 0 && (
            <Box borderWidth="1px" borderRadius="lg" p={4}>
              <Heading size="md" mb={2}>Events</Heading>
              <Text fontSize="sm" color="gray.600">
                No events were emitted in this transaction
              </Text>
            </Box>
          )}
        </VStack>
      )}

      {/* Empty State */}
      {!loading && !transactionData && !error && (
        <Center py={12}>
          <VStack gap={2}>
            <Text color="gray.500" fontSize="lg">
              Enter a transaction hash to explore
            </Text>
            <Text color="gray.400" fontSize="sm">
              The transaction will be decoded using the selected ABI from the sidebar
            </Text>
          </VStack>
        </Center>
      )}
    </VStack>
  );
}
