'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http, Transaction, TransactionReceipt } from 'viem';
import {
  Box,
  Text,
  Input,
  Field,
  VStack,
  Center,
  Grid,
} from '@chakra-ui/react';
import { toaster } from '@/components/ui/toaster';
import type { TransactionExplorerProps } from '../types';
import TransactionCard from './TransactionCard';

export default function TransactionExplorer({
  chain
}: TransactionExplorerProps) {
  const [txHash, setTxHash] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionData, setTransactionData] = useState<Transaction | null>(null);
  const [receiptData, setReceiptData] = useState<TransactionReceipt | null>(null);
  const [lastFetchedHash, setLastFetchedHash] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const handleExplore = async () => {
    if (!txHash || !txHash.startsWith('0x')) {
      setError('Please enter a valid transaction hash starting with 0x');
      return;
    }

    setLoading(true);
    setError(null);
    setTransactionData(null);
    setReceiptData(null);

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
      setLastFetchedHash(txHash);
      setIsExpanded(true);

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

  return (
    <VStack gap={6} align="stretch">
      {/* Transaction Hash Input */}
      <Box>
        <Field.Root>
          <Grid templateColumns="200px 1fr" gap={3} alignItems="start">
            <Field.Label fontSize="lg" fontWeight="semibold" pt={2}>
              Transaction Hash
            </Field.Label>
            <Box>
              <Input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                textStyle="mono"
              />
              <Field.HelperText textStyle="helperText" mt={1}>
                {loading ? (
                  <Text color="blue.solid">Loading transaction...</Text>
                ) : (
                  'Paste a transaction hash (auto-fetches when complete)'
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

      {/* Transaction Card */}
      {transactionData && receiptData && (
        <TransactionCard
          transaction={transactionData}
          receipt={receiptData}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
      )}

      {/* Empty State */}
      {!loading && !transactionData && !error && (
        <Center py={12}>
          <VStack gap={2}>
            <Text color="fg.muted" fontSize="lg">
              Enter a transaction hash to explore
            </Text>
            <Text color="fg.subtle" fontSize="sm">
              The contract will be auto-detected from the transaction, or you can select one manually
            </Text>
          </VStack>
        </Center>
      )}
    </VStack>
  );
}
