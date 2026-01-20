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
import { Chain } from 'viem';
import TransactionCard from './TransactionCard';

interface BlockExplorerProps {
  chain: Chain;
}

interface TransactionData {
  transaction: Transaction;
  receipt: TransactionReceipt;
}

export default function BlockExplorer({ chain }: BlockExplorerProps) {
  const [blockNumber, setBlockNumber] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [blockData, setBlockData] = useState<Block | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
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

      const transactionsList: TransactionData[] = [];

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

          transactionsList.push({
            transaction,
            receipt,
          });
        } catch (err) {
          console.error(`Failed to fetch transaction ${txHash}:`, err);
        }
      }

      setTransactions(transactionsList);
      setLastFetchedBlock(blockNumber);

      toaster.success({
        title: 'Block loaded',
        description: `Found ${transactionsList.length} transaction${transactionsList.length !== 1 ? 's' : ''}`,
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
                      key={txData.transaction.hash}
                      transaction={txData.transaction}
                      receipt={txData.receipt}
                      index={txIndex}
                      isExpanded={expandedTransactions[txIndex] ?? false}
                      onToggle={() => toggleTransaction(txIndex)}
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
