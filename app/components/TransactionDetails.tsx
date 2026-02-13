'use client';

import {
  Box,
  Text,
  Code,
  Alert,
  Heading,
  VStack,
  HStack,
  Collapsible,
  Grid,
} from '@chakra-ui/react';
import { JsonEditor } from 'json-edit-react';
import { Transaction, TransactionReceipt } from 'viem';
import type { DecodedEventLog, DecodedFunctionData } from '../types';
import { serializeBigInts } from '../utils/transactionDecoder';

interface TransactionDetailsProps {
  transaction: Transaction;
  receipt: TransactionReceipt;
  decodedInput: DecodedFunctionData | { error: string } | null;
  decodedEvents: DecodedEventLog[];
  expandedEvents: Record<number, boolean>;
  onToggleEvent: (index: number) => void;
  showHeader?: boolean;
}

export default function TransactionDetails({
  transaction,
  receipt,
  decodedInput,
  decodedEvents,
  expandedEvents,
  onToggleEvent,
  showHeader = true,
}: TransactionDetailsProps) {
  const handleEventKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleEvent(index);
    }
  };

  return (
    <VStack gap={6} align="stretch">
      {/* Basic Transaction Info */}
      {showHeader && (
        <Box layerStyle="card">
          <Box layerStyle="cardSection">
            <Heading size="md" mb={4}>Transaction Details</Heading>
            <Grid templateColumns="120px 1fr" gap={3} alignItems="center">
              <Text textStyle="cardHeading">Block Number</Text>
              <Code layerStyle="codeInline">
                {transaction.blockNumber?.toString() || 'Pending'}
              </Code>

              <Text textStyle="cardHeading">From</Text>
              <Code layerStyle="codeInline" whiteSpace="pre-wrap" wordBreak="break-all">
                {transaction.from}
              </Code>

              <Text textStyle="cardHeading">To</Text>
              <Code layerStyle="codeInline" whiteSpace="pre-wrap" wordBreak="break-all">
                {transaction.to || 'Contract Creation'}
              </Code>

              <Text textStyle="cardHeading">Value</Text>
              <Code layerStyle="codeInline">
                {transaction.value.toString()} wei
              </Code>

              <Text textStyle="cardHeading">Gas Used</Text>
              <Code layerStyle="codeInline">
                {receipt?.gasUsed?.toString() || 'N/A'}
              </Code>

              <Text textStyle="cardHeading">Status</Text>
              <Code layerStyle="codeInline">
                {receipt?.status === 'success' ? '✓ Success' : '✗ Failed'}
              </Code>
            </Grid>
          </Box>
        </Box>
      )}

      {/* Decoded Input */}
      {decodedInput && (
        <Box layerStyle="card">
          <Box layerStyle="cardSection">
            <Heading size="md" mb={4}>Decoded Input</Heading>
            {'error' in decodedInput ? (
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
                      onClick={() => onToggleEvent(event.index)}
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

      {/* No Events or Raw Logs */}
      {receipt && decodedEvents.length === 0 && (
        <Box layerStyle="card">
          <Box layerStyle="cardSection">
            <Heading size="md" mb={4}>Events</Heading>
            {receipt.logs && receipt.logs.length > 0 ? (
              <VStack gap={4} align="stretch">
                <Alert.Root status="info" borderRadius="md">
                  <Alert.Indicator />
                  <Alert.Title textStyle="label">
                    Showing raw logs. Select a contract to decode events.
                  </Alert.Title>
                </Alert.Root>
                {receipt.logs.map((log, index) => {
                  const isExpanded = expandedEvents[index] ?? false;
                  return (
                    <Box key={index} layerStyle="card">
                      {/* Log Header */}
                      <HStack
                        as="button"
                        onClick={() => onToggleEvent(index)}
                        onKeyDown={(e) => handleEventKeyDown(e, index)}
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
                        aria-label={`Raw Log ${index + 1}`}
                      >
                        <Text fontSize="lg">{isExpanded ? '▼' : '▶'}</Text>
                        <VStack align="start" flex={1} gap={1}>
                          <Text fontWeight="bold" fontFamily="mono" fontSize="sm">
                            Log #{index + 1}
                          </Text>
                        </VStack>
                        <Text fontSize="xs" color="orange.solid" fontWeight="semibold">⚠ Raw Log</Text>
                      </HStack>

                      {/* Expandable Content */}
                      <Collapsible.Root open={isExpanded}>
                        <Collapsible.Content>
                          <Box layerStyle="cardSection">
                            <VStack gap={3} align="stretch">
                              <Box>
                                <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted">Address:</Text>
                                <Code layerStyle="codeInline" display="block" mt={1} whiteSpace="pre-wrap" wordBreak="break-all">
                                  {log.address}
                                </Code>
                              </Box>

                              {log.topics && log.topics.length > 0 && (
                                <Box>
                                  <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted" mb={1}>Topics:</Text>
                                  <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                                    {JSON.stringify(log.topics, null, 2)}
                                  </Code>
                                </Box>
                              )}

                              {log.data && log.data !== '0x' && (
                                <Box>
                                  <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted" mb={1}>Data:</Text>
                                  <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                                    {log.data}
                                  </Code>
                                </Box>
                              )}

                              <Box>
                                <Text textStyle="monoCode" fontWeight="semibold" color="fg.muted">Log Index:</Text>
                                <Code layerStyle="codeInline" display="block" mt={1}>
                                  {log.logIndex?.toString() || 'N/A'}
                                </Code>
                              </Box>
                            </VStack>
                          </Box>
                        </Collapsible.Content>
                      </Collapsible.Root>
                    </Box>
                  );
                })}
              </VStack>
            ) : (
              <Text fontSize="sm" color="fg.muted">
                No events were emitted in this transaction
              </Text>
            )}
          </Box>
        </Box>
      )}
    </VStack>
  );
}
