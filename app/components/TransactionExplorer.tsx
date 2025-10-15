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

          // Find the matching function in the ABI to get full signature
          const matchingFunction = contractAbi.find(
            (item: any) => item.type === 'function' && item.name === decoded.functionName
          );

          setDecodedInput({
            ...decoded,
            signature: matchingFunction ? `${matchingFunction.name}(${matchingFunction.inputs.map((input: any) => `${input.type} ${input.name}`).join(', ')})` : decoded.functionName
          });
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
            textStyle="mono"
          />
          <Field.HelperText textStyle="helperText">
            {loading ? (
              <Text color="blue.solid">Loading transaction...</Text>
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
                {decodedInput.error ? (
                  <Alert.Root status="warning" borderRadius="md">
                    <Alert.Indicator />
                    <Alert.Title textStyle="label">{decodedInput.error}</Alert.Title>
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
              The transaction will be decoded using the selected ABI from the sidebar
            </Text>
          </VStack>
        </Center>
      )}
    </VStack>
  );
}
