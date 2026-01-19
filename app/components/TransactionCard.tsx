'use client';

import {
  Box,
  Text,
  HStack,
  VStack,
  Collapsible,
} from '@chakra-ui/react';
import { Transaction, TransactionReceipt } from 'viem';
import type { DecodedEventLog, DecodedFunctionData } from '../types';
import TransactionDetails from './TransactionDetails';

interface TransactionCardProps {
  transaction: Transaction;
  receipt: TransactionReceipt;
  decodedInput: DecodedFunctionData | { error: string } | null;
  decodedEvents: DecodedEventLog[];
  contractName: string | null;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  expandedEvents: Record<number, boolean>;
  onToggleEvent: (index: number) => void;
}

export default function TransactionCard({
  transaction,
  receipt,
  decodedInput,
  decodedEvents,
  contractName,
  index,
  isExpanded,
  onToggle,
  expandedEvents,
  onToggleEvent,
}: TransactionCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <Box layerStyle="card">
      {/* Transaction Header */}
      <HStack
        as="button"
        onClick={onToggle}
        onKeyDown={handleKeyDown}
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
        aria-label={`Transaction ${index + 1}`}
      >
        <Text fontSize="lg">{isExpanded ? '▼' : '▶'}</Text>
        <VStack align="start" flex={1} gap={1}>
          <HStack>
            <Text fontWeight="bold" fontFamily="mono" fontSize="sm">
              Transaction #{index + 1}
            </Text>
            {contractName && (
              <Text fontSize="xs" color="blue.fg" fontWeight="semibold">
                ({contractName})
              </Text>
            )}
          </HStack>
          <Text fontSize="xs" color="gray.600" fontFamily="mono">
            {transaction.hash.slice(0, 20)}...
          </Text>
        </VStack>
        <Text fontSize="xs" color={receipt.status === 'success' ? 'green.solid' : 'red.solid'} fontWeight="semibold">
          {receipt.status === 'success' ? '✓ Success' : '✗ Failed'}
        </Text>
      </HStack>

      {/* Expandable Content */}
      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
          <Box layerStyle="cardSection">
            <TransactionDetails
              transaction={transaction}
              receipt={receipt}
              decodedInput={decodedInput}
              decodedEvents={decodedEvents}
              expandedEvents={expandedEvents}
              onToggleEvent={onToggleEvent}
              showHeader={false}
            />
          </Box>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
}
