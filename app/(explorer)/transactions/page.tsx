'use client';

import {
  VStack,
  Text,
  Center,
} from '@chakra-ui/react';
import TransactionExplorer from '@/app/components/TransactionExplorer';
import { genlayerTestnet } from '@/app/wagmi';
import { useContract } from '@/app/context/ContractContext';

export default function TransactionsPage() {
  const { contractAbi } = useContract();

  return (
    <VStack gap={6} align="stretch">
      {contractAbi ? (
        <TransactionExplorer
          contractAbi={contractAbi}
          chain={genlayerTestnet}
        />
      ) : (
        <Center py={12}>
          <VStack gap={2}>
            <Text color="gray.500" fontSize="lg">
              Select a contract from the sidebar
            </Text>
            <Text color="gray.400" fontSize="sm">
              Configure your deployment and contract settings on the left to explore transactions
            </Text>
          </VStack>
        </Center>
      )}
    </VStack>
  );
}
