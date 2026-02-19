'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Text,
  HStack,
  VStack,
  Collapsible,
  NativeSelectRoot,
  NativeSelectField,
  Field,
} from '@chakra-ui/react';
import { Transaction, TransactionReceipt } from 'viem';
import { toaster } from '@/components/ui/toaster';
import { useContract } from '../context/ContractContext';
import type { DecodedEventLog, DecodedFunctionData } from '../types';
import {
  findContractByAddress,
  loadAbiForContract,
  decodeTransactionWithAbi,
  getAvailableContracts,
} from '../utils/transactionDecoder';
import TransactionDetails from './TransactionDetails';

interface TransactionCardProps {
  transaction: Transaction;
  receipt: TransactionReceipt;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function TransactionCard({
  transaction,
  receipt,
  isExpanded,
  onToggle,
}: TransactionCardProps) {
  const {
    deploymentsFile,
    selectedNetwork,
    selectedDeployment,
    abisFolderHandle,
    availableAbis,
  } = useContract();

  const [selectedContract, setSelectedContract] = useState<string>('');
  const [decodedInput, setDecodedInput] = useState<DecodedFunctionData | { error: string } | null>(null);
  const [decodedEvents, setDecodedEvents] = useState<DecodedEventLog[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>({});
  const [loadingAbi, setLoadingAbi] = useState<boolean>(false);
  const [wasAutoInferred, setWasAutoInferred] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);

  const availableContracts = getAvailableContracts(
    deploymentsFile,
    selectedNetwork,
    selectedDeployment,
    availableAbis
  );

  // Auto-detect contract on mount or when transaction changes
  useEffect(() => {
    const autoDetectContract = async () => {
      if (!transaction.to || initialized) return;

      const matchingContract = findContractByAddress(
        transaction.to,
        deploymentsFile,
        selectedNetwork,
        selectedDeployment
      );

      if (matchingContract) {
        setSelectedContract(matchingContract);
        setWasAutoInferred(true);

        const abi = await loadAbiForContract(matchingContract, abisFolderHandle, availableAbis);
        if (abi) {
          const { decodedInput: newDecodedInput, decodedEvents: newDecodedEvents } =
            await decodeTransactionWithAbi(transaction, receipt, abi);
          setDecodedInput(newDecodedInput);
          setDecodedEvents(newDecodedEvents);

          const initialExpandedState: Record<number, boolean> = {};
          newDecodedEvents.forEach((event) => {
            initialExpandedState[event.index] = event.decoded;
          });
          setExpandedEvents(initialExpandedState);
        }
      }
      setInitialized(true);
    };

    autoDetectContract();
  }, [transaction, receipt, deploymentsFile, selectedNetwork, selectedDeployment, abisFolderHandle, initialized]);

  const handleContractChange = async (contractName: string) => {
    setSelectedContract(contractName);
    setWasAutoInferred(false);

    if (!contractName) {
      setDecodedInput(null);
      setDecodedEvents([]);
      return;
    }

    setLoadingAbi(true);
    const abi = await loadAbiForContract(contractName, abisFolderHandle, availableAbis);
    setLoadingAbi(false);

    if (abi) {
      const { decodedInput: newDecodedInput, decodedEvents: newDecodedEvents } =
        await decodeTransactionWithAbi(transaction, receipt, abi);
      setDecodedInput(newDecodedInput);
      setDecodedEvents(newDecodedEvents);

      const initialExpandedState: Record<number, boolean> = {};
      newDecodedEvents.forEach((event) => {
        initialExpandedState[event.index] = event.decoded;
      });
      setExpandedEvents(initialExpandedState);

      toaster.success({
        title: 'Contract loaded',
        description: `Loaded ABI for ${contractName}`,
      });
    } else {
      toaster.error({
        title: 'Failed to load ABI',
        description: `Could not load ABI for ${contractName}`,
      });
    }
  };

  const toggleEvent = (eventIndex: number) => {
    setExpandedEvents(prev => ({
      ...prev,
      [eventIndex]: !prev[eventIndex]
    }));
  };

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
        aria-label={`Transaction ${transaction.hash}`}
      >
        <Text fontSize="lg">{isExpanded ? '▼' : '▶'}</Text>
        <VStack align="start" flex={1} gap={1}>
          <HStack>
            <Text fontWeight="bold" fontSize="sm">
              Transaction
            </Text>
            {selectedContract && (
              <Text fontSize="xs" color="blue.fg" fontWeight="semibold">
                ({selectedContract})
              </Text>
            )}
          </HStack>
          <Text fontSize="xs" color="gray.600" fontFamily="mono">
            {transaction.hash}
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
            {/* Contract Selector */}
            <Box mb={4}>
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

            <TransactionDetails
              transaction={transaction}
              receipt={receipt}
              decodedInput={decodedInput}
              decodedEvents={decodedEvents}
              expandedEvents={expandedEvents}
              onToggleEvent={toggleEvent}
              showHeader={true}
            />
          </Box>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
}
