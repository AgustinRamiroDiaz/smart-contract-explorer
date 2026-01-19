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
  NativeSelectRoot,
  NativeSelectField,
} from '@chakra-ui/react';
import { toaster } from '@/components/ui/toaster';
import { useContract } from '../context/ContractContext';
import type { TransactionExplorerProps, DecodedEventLog, DecodedFunctionData, ContractAbi } from '../types';
import {
  findContractByAddress,
  loadAbiForContract,
  decodeTransactionWithAbi,
  getAvailableContracts,
} from '../utils/transactionDecoder';
import TransactionDetails from './TransactionDetails';

export default function TransactionExplorer({
  chain
}: TransactionExplorerProps) {
  const {
    deploymentsFile,
    selectedNetwork,
    selectedDeployment,
    abisFolderHandle,
    availableAbis
  } = useContract();

  const [txHash, setTxHash] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionData, setTransactionData] = useState<Transaction | null>(null);
  const [receiptData, setReceiptData] = useState<TransactionReceipt | null>(null);
  const [decodedInput, setDecodedInput] = useState<DecodedFunctionData | { error: string } | null>(null);
  const [decodedEvents, setDecodedEvents] = useState<DecodedEventLog[]>([]);
  const [lastFetchedHash, setLastFetchedHash] = useState<string>('');
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>({});
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [contractAbi, setContractAbi] = useState<ContractAbi | null>(null);
  const [loadingAbi, setLoadingAbi] = useState<boolean>(false);
  const [wasAutoInferred, setWasAutoInferred] = useState<boolean>(false);

  // Get available contracts from the current deployment that have ABIs
  const availableContracts = getAvailableContracts(
    deploymentsFile,
    selectedNetwork,
    selectedDeployment,
    availableAbis
  );

  // Handle manual contract selection from dropdown
  const handleContractChange = async (contractName: string) => {
    setSelectedContract(contractName);
    setWasAutoInferred(false);

    if (!contractName) {
      setContractAbi(null);
      setDecodedInput(null);
      setDecodedEvents([]);
      return;
    }

    // Load the ABI for the selected contract
    setLoadingAbi(true);
    const abi = await loadAbiForContract(contractName, abisFolderHandle);
    setLoadingAbi(false);

    if (abi) {
      setContractAbi(abi);

      // Re-decode the transaction if one is loaded
      if (transactionData && receiptData) {
        const { decodedInput: newDecodedInput, decodedEvents: newDecodedEvents } =
          await decodeTransactionWithAbi(transactionData, receiptData, abi);
        setDecodedInput(newDecodedInput);
        setDecodedEvents(newDecodedEvents);

        const initialExpandedState: Record<number, boolean> = {};
        newDecodedEvents.forEach((event) => {
          initialExpandedState[event.index] = event.decoded;
        });
        setExpandedEvents(initialExpandedState);
      }

      toaster.success({
        title: 'Contract loaded',
        description: `Loaded ABI for ${contractName}`,
      });
    } else {
      setContractAbi(null);
      toaster.error({
        title: 'Failed to load ABI',
        description: `Could not load ABI for ${contractName}`,
      });
    }
  };

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
      setLastFetchedHash(txHash);

      // Auto-load contract ABI based on transaction's 'to' address
      if (transaction.to) {
        const matchingContract = findContractByAddress(
          transaction.to,
          deploymentsFile,
          selectedNetwork,
          selectedDeployment
        );

        if (matchingContract) {
          setSelectedContract(matchingContract);
          setWasAutoInferred(true);

          // Load the ABI for the matched contract
          const abi = await loadAbiForContract(matchingContract, abisFolderHandle);
          if (abi) {
            setContractAbi(abi);
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
              title: 'Transaction loaded',
              description: `Auto-loaded contract: ${matchingContract}`,
            });
          } else {
            setContractAbi(null);
            toaster.warning({
              title: 'Transaction loaded',
              description: `Found contract ${matchingContract} but failed to load ABI`,
            });
          }
        } else {
          setSelectedContract('');
          setContractAbi(null);
          setWasAutoInferred(false);
          toaster.info({
            title: 'Transaction loaded',
            description: 'Contract address not found in deployment',
          });
        }
      } else {
        setSelectedContract('');
        setContractAbi(null);
        setWasAutoInferred(false);
        toaster.success({
          title: 'Transaction loaded',
          description: 'Transaction details fetched successfully',
        });
      }
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

  return (
    <VStack gap={6} align="stretch">
      {/* Transaction Hash Input */}
      <Box>
        <Field.Root>
          <Grid templateColumns="200px 1fr auto" gap={3} alignItems="start">
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
            <Box minW="300px">
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

      {/* Transaction Details */}
      {transactionData && receiptData && (
        <TransactionDetails
          transaction={transactionData}
          receipt={receiptData}
          decodedInput={decodedInput}
          decodedEvents={decodedEvents}
          expandedEvents={expandedEvents}
          onToggleEvent={toggleEvent}
          showHeader={true}
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
