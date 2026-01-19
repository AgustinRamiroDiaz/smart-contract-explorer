'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http, Transaction, TransactionReceipt, Hash, Block } from 'viem';
import {
  Box,
  Text,
  Input,
  Field,
  VStack,
  Code,
  Heading,
  Center,
  Grid,
} from '@chakra-ui/react';
import { toaster } from '@/components/ui/toaster';
import { useContract } from '../context/ContractContext';
import type { DecodedEventLog, DecodedFunctionData, ContractAbi } from '../types';
import { Chain } from 'viem';
import {
  findContractByAddress,
  loadAbiForContract,
  decodeTransactionWithAbi,
} from '../utils/transactionDecoder';
import TransactionCard from './TransactionCard';

interface BlockExplorerProps {
  chain: Chain;
}

interface TransactionWithDecoded {
  transaction: Transaction;
  receipt: TransactionReceipt;
  decodedInput: DecodedFunctionData | { error: string } | null;
  decodedEvents: DecodedEventLog[];
  contractName: string | null;
  contractAbi: ContractAbi | null;
  expandedEvents: Record<number, boolean>;
}

export default function BlockExplorer({ chain }: BlockExplorerProps) {
  const {
    deploymentsFile,
    selectedNetwork,
    selectedDeployment,
    abisFolderHandle,
  } = useContract();

  const [blockNumber, setBlockNumber] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [blockData, setBlockData] = useState<Block | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithDecoded[]>([]);
  const [lastFetchedBlock, setLastFetchedBlock] = useState<string>('');
  const [expandedTransactions, setExpandedTransactions] = useState<Record<number, boolean>>({});

  const handleExplore = async () => {
    if (!blockNumber) {
      setError('Please enter a block number');
      return;
    }

    setLoading(true);
    setError(null);
    setBlockData(null);
    setTransactions([]);

    try {
      const client = createPublicClient({
        chain,
        transport: http(),
      });

      // Parse block number
      const blockNum = BigInt(blockNumber);

      // Fetch block details
      const block = await client.getBlock({
        blockNumber: blockNum,
      });

      if (!block) {
        throw new Error('Block not found');
      }

      setBlockData(block);

      // Fetch all transactions from the block
      const txHashes = block.transactions as Hash[];

      if (txHashes.length === 0) {
        toaster.info({
          title: 'Block loaded',
          description: 'No transactions in this block',
        });
        setLastFetchedBlock(blockNumber);
        return;
      }

      const transactionsWithDecoded: TransactionWithDecoded[] = [];

      for (const txHash of txHashes) {
        try {
          // Fetch transaction details
          const transaction = await client.getTransaction({
            hash: txHash,
          });

          // Fetch transaction receipt
          const receipt = await client.getTransactionReceipt({
            hash: txHash,
          });

          // Auto-load contract ABI based on transaction's 'to' address
          let contractName: string | null = null;
          let contractAbi: ContractAbi | null = null;
          let decodedInput: DecodedFunctionData | { error: string } | null = null;
          let decodedEvents: DecodedEventLog[] = [];
          const expandedEvents: Record<number, boolean> = {};

          if (transaction.to) {
            const matchingContract = findContractByAddress(
              transaction.to,
              deploymentsFile,
              selectedNetwork,
              selectedDeployment
            );

            if (matchingContract) {
              contractName = matchingContract;
              const abi = await loadAbiForContract(matchingContract, abisFolderHandle);
              if (abi) {
                contractAbi = abi;
                const decoded = await decodeTransactionWithAbi(transaction, receipt, abi);
                decodedInput = decoded.decodedInput;
                decodedEvents = decoded.decodedEvents;

                // Initialize expanded state for events
                decodedEvents.forEach((event) => {
                  expandedEvents[event.index] = event.decoded;
                });
              }
            }
          }

          transactionsWithDecoded.push({
            transaction,
            receipt,
            decodedInput,
            decodedEvents,
            contractName,
            contractAbi,
            expandedEvents,
          });
        } catch (err) {
          console.error(`Failed to fetch transaction ${txHash}:`, err);
        }
      }

      setTransactions(transactionsWithDecoded);
      setLastFetchedBlock(blockNumber);

      toaster.success({
        title: 'Block loaded',
        description: `Found ${transactionsWithDecoded.length} transaction${transactionsWithDecoded.length !== 1 ? 's' : ''}`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch block';
      setError(errorMessage);
      toaster.error({
        title: 'Failed to load block',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when a valid block number is entered
  useEffect(() => {
    const isValidBlock = blockNumber && /^\d+$/.test(blockNumber);
    const hasChanged = blockNumber !== lastFetchedBlock;

    if (isValidBlock && hasChanged && !loading) {
      handleExplore();
    }
  }, [blockNumber]);

  const toggleTransaction = (index: number) => {
    setExpandedTransactions(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleEvent = (txIndex: number, eventIndex: number) => {
    setTransactions(prev => {
      const updated = [...prev];
      updated[txIndex] = {
        ...updated[txIndex],
        expandedEvents: {
          ...updated[txIndex].expandedEvents,
          [eventIndex]: !updated[txIndex].expandedEvents[eventIndex]
        }
      };
      return updated;
    });
  };

  return (
    <VStack gap={6} align="stretch">
      {/* Block Number Input */}
      <Box>
        <Field.Root>
          <Grid templateColumns="200px 1fr" gap={3} alignItems="start">
            <Field.Label fontSize="lg" fontWeight="semibold" pt={2}>
              Block Number
            </Field.Label>
            <Box>
              <Input
                value={blockNumber}
                onChange={(e) => setBlockNumber(e.target.value)}
                placeholder="Enter block number (e.g., 12345)"
                textStyle="mono"
              />
              <Field.HelperText textStyle="helperText" mt={1}>
                {loading ? (
                  <Text color="blue.solid">Loading block...</Text>
                ) : (
                  'Enter a block number (auto-fetches when complete)'
                )}
              </Field.HelperText>
            </Box>
          </Grid>
        </Field.Root>
      </Box>

      {/* Error Display */}
      {error && (
        <Box layerStyle="card">
          <Box layerStyle="cardSection">
            <Text color="red.solid" fontWeight="semibold">{error}</Text>
          </Box>
        </Box>
      )}

      {/* Block Details */}
      {blockData && (
        <VStack gap={6} align="stretch">
          {/* Block Info */}
          <Box layerStyle="card">
            <Box layerStyle="cardSection">
              <Heading size="md" mb={4}>Block Details</Heading>
              <VStack gap={3} align="stretch">
                <Box>
                  <Text textStyle="cardHeading">Block Number:</Text>
                  <Code layerStyle="codeInline" display="block">
                    {blockData.number?.toString()}
                  </Code>
                </Box>
                <Box>
                  <Text textStyle="cardHeading">Block Hash:</Text>
                  <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                    {blockData.hash}
                  </Code>
                </Box>
                <Box>
                  <Text textStyle="cardHeading">Parent Hash:</Text>
                  <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                    {blockData.parentHash}
                  </Code>
                </Box>
                <Box>
                  <Text textStyle="cardHeading">Timestamp:</Text>
                  <Code layerStyle="codeInline" display="block">
                    {new Date(Number(blockData.timestamp) * 1000).toLocaleString()}
                  </Code>
                </Box>
                <Box>
                  <Text textStyle="cardHeading">Transactions:</Text>
                  <Code layerStyle="codeInline" display="block">
                    {blockData.transactions.length}
                  </Code>
                </Box>
              </VStack>
            </Box>
          </Box>

          {/* Transactions List */}
          {transactions.length > 0 && (
            <Box layerStyle="card">
              <Box layerStyle="cardSection">
                <Heading size="md" mb={4}>Transactions ({transactions.length})</Heading>
                <VStack gap={4} align="stretch">
                  {transactions.map((txData, txIndex) => (
                    <TransactionCard
                      key={txIndex}
                      transaction={txData.transaction}
                      receipt={txData.receipt}
                      decodedInput={txData.decodedInput}
                      decodedEvents={txData.decodedEvents}
                      contractName={txData.contractName}
                      index={txIndex}
                      isExpanded={expandedTransactions[txIndex] ?? false}
                      onToggle={() => toggleTransaction(txIndex)}
                      expandedEvents={txData.expandedEvents}
                      onToggleEvent={(eventIndex) => toggleEvent(txIndex, eventIndex)}
                    />
                  ))}
                </VStack>
              </Box>
            </Box>
          )}
        </VStack>
      )}

      {/* Empty State */}
      {!loading && !blockData && !error && (
        <Center py={12}>
          <VStack gap={2}>
            <Text color="fg.muted" fontSize="lg">
              Enter a block number to explore
            </Text>
            <Text color="fg.subtle" fontSize="sm">
              All transactions in the block will be fetched and decoded automatically
            </Text>
          </VStack>
        </Center>
      )}
    </VStack>
  );
}
