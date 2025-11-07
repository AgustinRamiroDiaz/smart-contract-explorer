'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http, decodeEventLog, parseAbiItem, Hash } from 'viem';
import type { Chain } from 'viem';
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
  Button,
  Grid,
  Spinner,
  Dialog,
  Portal,
  IconButton,
  createListCollection,
} from '@chakra-ui/react';
import {
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxRoot,
} from '@/components/ui/combobox';
import { JsonEditor } from 'json-edit-react';
import { toaster } from '@/components/ui/toaster';
import { LuCopy } from 'react-icons/lu';
import type { EventLogsExplorerProps, DecodedEventLog, SerializableValue, AbiEvent } from '../types';

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

// Generate event signature for CLI commands
function generateEventSignature(event: AbiEvent): string {
  const paramTypes = event.inputs?.map(input => input.type).join(',') || '';
  return `${event.name}(${paramTypes})`;
}

// Generate Foundry cast logs command
function generateFoundryCommand(
  event: AbiEvent,
  contractAddress: string,
  fromBlock?: string,
  toBlock?: string,
  rpcUrl?: string
): string {
  const signature = generateEventSignature(event);
  const fromBlockFlag = fromBlock && fromBlock.trim() !== '' ? ` --from-block ${fromBlock}` : '';
  const toBlockFlag = toBlock && toBlock.trim() !== '' ? ` --to-block ${toBlock}` : '';
  const rpcUrlValue = rpcUrl || '$RPC_URL';

  return `cast logs --address ${contractAddress} "${signature}"${fromBlockFlag}${toBlockFlag} --rpc-url ${rpcUrlValue}`;
}

// Generate ZKsync CLI command for event logs
function generateZksyncCommand(
  event: AbiEvent,
  contractAddress: string,
  fromBlock?: string,
  toBlock?: string,
  chainNetwork?: string
): string {
  const signature = generateEventSignature(event);
  const fromBlockFlag = fromBlock && fromBlock.trim() !== '' ? ` --from-block ${fromBlock}` : '';
  const toBlockFlag = toBlock && toBlock.trim() !== '' ? ` --to-block ${toBlock}` : '';
  const chainValue = chainNetwork || 'zksync-sepolia';

  return `npx zksync-cli contract logs --chain "${chainValue}" --contract "${contractAddress}" --event "${signature}"${fromBlockFlag}${toBlockFlag}`;
}

export default function EventLogsExplorer({
  contractAddress,
  contractAbi,
  chain
}: EventLogsExplorerProps) {
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  const [fromBlock, setFromBlock] = useState<string>('');
  const [toBlock, setToBlock] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<DecodedEventLog[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const [fetchingBlockNumber, setFetchingBlockNumber] = useState<boolean>(false);
  const [isCommandsModalOpen, setIsCommandsModalOpen] = useState<boolean>(false);

  // Get all events from ABI
  const events = contractAbi.filter((item): item is AbiEvent => item.type === 'event');

  // Create collection for Combobox component
  const allEventItems = events.map((event) => ({
    label: `${event.name}(${event.inputs?.map((input) => `${input.type} ${input.name}`).join(', ')})`,
    value: event.name,
  }));

  // Filter items based on input value
  // Show all items if no input or if input exactly matches the selected event
  const selectedItemLabel = allEventItems.find(item => item.value === selectedEvent)?.label;
  const shouldFilter = inputValue && inputValue !== selectedItemLabel;

  const filteredEventItems = shouldFilter
    ? allEventItems.filter((item) =>
        item.label.toLowerCase().includes(inputValue.toLowerCase())
      )
    : allEventItems;

  const eventCollection = createListCollection({
    items: filteredEventItems,
  });

  // Fetch the latest block number when component mounts
  useEffect(() => {
    const fetchLatestBlock = async () => {
      setFetchingBlockNumber(true);
      try {
        const client = createPublicClient({
          chain,
          transport: http(),
        });

        const blockNumber = await client.getBlockNumber();
        setFromBlock(blockNumber.toString());
      } catch (err) {
        console.error('Failed to fetch latest block number:', err);
        // Don't show error to user, just log it
      } finally {
        setFetchingBlockNumber(false);
      }
    };

    fetchLatestBlock();
  }, [chain]);

  const handleSearch = async () => {
    if (!selectedEvent) {
      setError('Please select an event type');
      return;
    }

    if (!contractAddress || !contractAddress.startsWith('0x')) {
      setError('Invalid contract address');
      return;
    }

    setLoading(true);
    setError(null);
    setLogs([]);

    try {
      const client = createPublicClient({
        chain,
        transport: http(),
      });

      // Find the selected event in the ABI
      const selectedEventAbi = events.find((e) => e.name === selectedEvent);
      if (!selectedEventAbi) {
        throw new Error('Event not found in ABI');
      }

      interface FilterParams {
        address: `0x${string}`;
        event: AbiEvent;
        fromBlock?: bigint;
        toBlock?: bigint;
      }

      // Build the filter parameters
      const filterParams: FilterParams = {
        address: contractAddress as `0x${string}`,
        event: selectedEventAbi,
      };

      // Add block range if specified
      if (fromBlock && fromBlock.trim() !== '') {
        filterParams.fromBlock = BigInt(fromBlock);
      }
      if (toBlock && toBlock.trim() !== '') {
        filterParams.toBlock = BigInt(toBlock);
      }

      // Fetch logs
      const fetchedLogs = await client.getLogs(filterParams);

      if (fetchedLogs.length === 0) {
        toaster.info({
          title: 'No logs found',
          description: 'No events found for the specified criteria',
        });
      } else {
        toaster.success({
          title: 'Logs loaded',
          description: `Found ${fetchedLogs.length} event${fetchedLogs.length !== 1 ? 's' : ''}`,
        });
      }

      // Decode the logs
      const decodedLogs: DecodedEventLog[] = fetchedLogs.map((log, index: number) => {
        try {
          const decoded = decodeEventLog({
            abi: [selectedEventAbi],
            data: log.data,
            topics: log.topics,
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
        } catch (err) {
          return {
            index,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            address: log.address,
            topics: log.topics as Hash[],
            data: log.data,
            error: 'Failed to decode log',
            decoded: false,
          };
        }
      });

      setLogs(decodedLogs);

      // Set initial expanded state: all logs collapsed by default
      const initialExpandedState: Record<number, boolean> = {};
      decodedLogs.forEach((log) => {
        initialExpandedState[log.index] = false;
      });
      setExpandedLogs(initialExpandedState);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch logs';
      setError(errorMessage);
      toaster.error({
        title: 'Failed to load logs',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleLog = (index: number) => {
    setExpandedLogs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleLogKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleLog(index);
    }
  };

  const copyCommand = async (type: 'foundry' | 'zksync') => {
    const selectedEventAbi = events.find((e) => e.name === selectedEvent);
    if (!selectedEventAbi) return;

    const rpcUrl: string | undefined = chain.rpcUrls?.default?.http?.[0] || chain.rpcUrls?.public?.http?.[0];
    const chainNetwork: string | undefined = 'network' in chain ? (chain.network as string) : undefined;
    const command = type === 'foundry'
      ? generateFoundryCommand(selectedEventAbi, contractAddress, fromBlock, toBlock, rpcUrl)
      : generateZksyncCommand(selectedEventAbi, contractAddress, fromBlock, toBlock, chainNetwork);

    try {
      await navigator.clipboard.writeText(command);
      toaster.success({
        title: 'Command copied',
        description: `${type === 'foundry' ? 'Foundry' : 'ZKsync CLI'} command copied to clipboard`,
      });
    } catch (err) {
      toaster.error({
        title: 'Failed to copy',
        description: 'Could not copy command to clipboard',
      });
    }
  };

  return (
    <VStack gap={6} align="stretch">
      {/* Search Form */}
      <Box>
        <Heading size="md" mb={4}>Search Contract Logs</Heading>
        <VStack gap={4} align="stretch">
          {/* Event Selection */}
          <Field.Root>
            <Field.Label fontSize="sm" fontWeight="semibold">Select Event Type:</Field.Label>
            <ComboboxRoot
              collection={eventCollection}
              size="sm"
              value={selectedEvent ? [selectedEvent] : []}
              onValueChange={(details) => {
                setSelectedEvent(details.value[0] || '');
                // Update input value to show selected event
                const selectedItem = eventCollection.items.find(item => item.value === details.value[0]);
                if (selectedItem) {
                  setInputValue(selectedItem.label);
                }
              }}
              inputValue={inputValue}
              onInputValueChange={(details) => setInputValue(details.inputValue)}
              openOnClick
            >
              <ComboboxLabel>Select an event</ComboboxLabel>
              <ComboboxInput placeholder="Search or select an event..." clearable />
              <ComboboxContent>
                {eventCollection.items.map((event) => (
                  <ComboboxItem item={event} key={event.value}>
                    {event.label}
                  </ComboboxItem>
                ))}
              </ComboboxContent>
            </ComboboxRoot>
          </Field.Root>
          {events.length === 0 && (
            <Alert.Root status="info" size="sm" mt={2}>
              <Alert.Indicator />
              <Alert.Title fontSize="xs">No events found in the contract ABI</Alert.Title>
            </Alert.Root>
          )}

          {/* Block Range */}
          <Grid templateColumns="1fr 1fr" gap={4}>
            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">From Block:</Field.Label>
              <Input
                value={fromBlock}
                onChange={(e) => setFromBlock(e.target.value)}
                placeholder={fetchingBlockNumber ? "Fetching latest block..." : "Start block (optional)"}
                type="number"
                textStyle="mono"
                disabled={fetchingBlockNumber}
              />
              <Field.HelperText fontSize="xs">
                {fetchingBlockNumber ? "Loading current block number..." : "Defaults to latest block"}
              </Field.HelperText>
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">To Block:</Field.Label>
              <Input
                value={toBlock}
                onChange={(e) => setToBlock(e.target.value)}
                placeholder="End block (optional)"
                type="number"
                textStyle="mono"
              />
              <Field.HelperText fontSize="xs">
                Leave empty to search to latest block
              </Field.HelperText>
            </Field.Root>
          </Grid>

          {/* Search Button and CLI Commands */}
          <HStack gap={2}>
            <Button
              onClick={handleSearch}
              colorScheme="blue"
              loading={loading}
              loadingText="Searching..."
              disabled={!selectedEvent || !contractAddress}
              flex="1"
            >
              Search Logs
            </Button>
            <Button
              onClick={() => setIsCommandsModalOpen(true)}
              variant="outline"
              disabled={!selectedEvent || !contractAddress}
            >
              CLI Commands
            </Button>
          </HStack>
        </VStack>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert.Root status="error" borderRadius="md">
          <Alert.Indicator />
          <Alert.Title textStyle="label">{error}</Alert.Title>
        </Alert.Root>
      )}

      {/* Loading State */}
      {loading && (
        <Center py={12}>
          <VStack>
            <Spinner size="lg" />
            <Text color="gray.600">Searching for logs...</Text>
          </VStack>
        </Center>
      )}

      {/* Results */}
      {!loading && logs.length > 0 && (
        <Box layerStyle="card">
          <Box layerStyle="cardSection">
            <Heading size="md" mb={4}>Event Logs ({logs.length})</Heading>
            <VStack gap={4} align="stretch">
              {logs.map((log) => {
                const isExpanded = expandedLogs[log.index] ?? false;
                return (
                  <Box key={log.index} layerStyle="card">
                    {/* Log Header */}
                    <HStack
                      as="button"
                      onClick={() => toggleLog(log.index)}
                      onKeyDown={(e) => handleLogKeyDown(e, log.index)}
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
                      aria-label={`Log ${log.index + 1} - ${log.eventName || 'Raw Log'}`}
                    >
                      <Text fontSize="lg">{isExpanded ? '▼' : '▶'}</Text>
                      <VStack align="start" flex={1} gap={1}>
                        <HStack>
                          <Text fontWeight="bold" fontFamily="mono" fontSize="sm">
                            {log.eventName || 'Unknown Event'} #{log.index + 1}
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                          Block: {log.blockNumber?.toString()} | Tx: {log.transactionHash?.slice(0, 10)}...
                        </Text>
                      </VStack>
                      {log.decoded && (
                        <Text fontSize="xs" color="green.solid" fontWeight="semibold">✓ Decoded</Text>
                      )}
                      {!log.decoded && (
                        <Text fontSize="xs" color="orange.solid" fontWeight="semibold">⚠ Raw Log</Text>
                      )}
                    </HStack>

                    {/* Expandable Content */}
                    <Collapsible.Root open={isExpanded}>
                      <Collapsible.Content>
                        <Box layerStyle="cardSection">
                          <VStack gap={3} align="stretch">
                            <Box>
                              <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted">Block Number:</Text>
                              <Code layerStyle="codeInline" display="block" mt={1}>
                                {log.blockNumber?.toString()}
                              </Code>
                            </Box>

                            <Box>
                              <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted">Transaction Hash:</Text>
                              <Code layerStyle="codeInline" display="block" mt={1} whiteSpace="pre-wrap" wordBreak="break-all">
                                {log.transactionHash}
                              </Code>
                            </Box>

                            <Box>
                              <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted">Log Index:</Text>
                              <Code layerStyle="codeInline" display="block" mt={1}>
                                {log.logIndex?.toString()}
                              </Code>
                            </Box>

                            <Box>
                              <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted">Address:</Text>
                              <Code layerStyle="codeInline" display="block" mt={1} whiteSpace="pre-wrap" wordBreak="break-all">
                                {log.address}
                              </Code>
                            </Box>

                            {log.args && (
                              <Box>
                                <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted" mb={1}>Arguments:</Text>
                                <Box layerStyle="codeBlock">
                                  <JsonEditor
                                    data={serializeBigInts(log.args)}
                                    setData={() => {}}
                                    rootName={`log_${log.index}`}
                                    restrictEdit={true}
                                    restrictDelete={true}
                                    restrictAdd={true}
                                  />
                                </Box>
                              </Box>
                            )}

                            {!log.decoded && log.topics && (
                              <Box>
                                <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted" mb={1}>Raw Topics:</Text>
                                <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                                  {JSON.stringify(log.topics, null, 2)}
                                </Code>
                              </Box>
                            )}

                            {!log.decoded && log.data && (
                              <Box>
                                <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted" mb={1}>Raw Data:</Text>
                                <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                                  {log.data}
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

      {/* Empty State */}
      {!loading && !error && logs.length === 0 && selectedEvent && (
        <Center py={12}>
          <VStack gap={2}>
            <Text color="fg.muted" fontSize="lg">
              No logs found
            </Text>
            <Text color="fg.subtle" fontSize="sm">
              Try adjusting your search criteria or block range
            </Text>
          </VStack>
        </Center>
      )}

      {/* Initial Empty State */}
      {!loading && !error && logs.length === 0 && !selectedEvent && (
        <Center py={12}>
          <VStack gap={2}>
            <Text color="fg.muted" fontSize="lg">
              Select an event type and search for logs
            </Text>
            <Text color="fg.subtle" fontSize="sm">
              Choose an event from the dropdown above to get started
            </Text>
          </VStack>
        </Center>
      )}

      {/* Commands Modal */}
      <Dialog.Root open={isCommandsModalOpen} onOpenChange={(e) => setIsCommandsModalOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="4xl">
              <Dialog.Header>
                <Dialog.Title>CLI Commands for Event Logs</Dialog.Title>
              </Dialog.Header>
              <Dialog.CloseTrigger />
              <Dialog.Body>
                {selectedEvent && events.find((e) => e.name === selectedEvent) ? (
                  <VStack gap={4} align="stretch">
                    {/* Foundry Command */}
                    <Box>
                      <Text fontWeight="bold" mb={2}>Foundry Cast Logs Command</Text>
                      <HStack gap={2} align="start">
                        <Code
                          layerStyle="codeBlock"
                          flex="1"
                          display="block"
                          whiteSpace="pre-wrap"
                          wordBreak="break-all"
                          p={3}
                        >
                          {generateFoundryCommand(
                            events.find((e) => e.name === selectedEvent)!,
                            contractAddress,
                            fromBlock,
                            toBlock,
                            chain.rpcUrls?.default?.http?.[0] || chain.rpcUrls?.public?.http?.[0]
                          )}
                        </Code>
                        <IconButton
                          aria-label="Copy Foundry command"
                          onClick={() => copyCommand('foundry')}
                          size="sm"
                          variant="ghost"
                        >
                          <LuCopy />
                        </IconButton>
                      </HStack>
                    </Box>

                    {/* ZKsync Command */}
                    <Box>
                      <Text fontWeight="bold" mb={2}>ZKsync CLI Logs Command</Text>
                      <HStack gap={2} align="start">
                        <Code
                          layerStyle="codeBlock"
                          flex="1"
                          display="block"
                          whiteSpace="pre-wrap"
                          wordBreak="break-all"
                          p={3}
                        >
                          {generateZksyncCommand(
                            events.find((e) => e.name === selectedEvent)!,
                            contractAddress,
                            fromBlock,
                            toBlock,
                            'network' in chain ? (chain.network as string) : undefined
                          )}
                        </Code>
                        <IconButton
                          aria-label="Copy ZKsync command"
                          onClick={() => copyCommand('zksync')}
                          size="sm"
                          variant="ghost"
                        >
                          <LuCopy />
                        </IconButton>
                      </HStack>
                    </Box>
                  </VStack>
                ) : (
                  <Text color="fg.muted">Please select an event to see CLI commands</Text>
                )}
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  );
}
