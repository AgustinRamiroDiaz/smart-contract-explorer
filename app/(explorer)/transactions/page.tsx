'use client';

import { Suspense } from 'react';
import {
  VStack,
  Text,
  Center,
  Spinner,
} from '@chakra-ui/react';
import TransactionExplorer from '@/app/components/TransactionExplorer';
import { genlayerTestnet } from '@/app/wagmi';

function TransactionsPageContent() {
  return (
    <VStack gap={6} align="stretch">
      <TransactionExplorer chain={genlayerTestnet} />
    </VStack>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <Center py={12}>
        <VStack>
          <Spinner size="lg" />
          <Text color="gray.600">Loading...</Text>
        </VStack>
      </Center>
    }>
      <TransactionsPageContent />
    </Suspense>
  );
}
