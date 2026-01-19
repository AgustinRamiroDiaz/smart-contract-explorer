'use client';

import { Suspense } from 'react';
import {
  VStack,
  Text,
  Center,
  Spinner,
} from '@chakra-ui/react';
import BlockExplorer from '@/app/components/BlockExplorer';
import { genlayerTestnet } from '@/app/wagmi';

function BlocksPageContent() {
  return (
    <VStack gap={6} align="stretch">
      <BlockExplorer chain={genlayerTestnet} />
    </VStack>
  );
}

export default function BlocksPage() {
  return (
    <Suspense fallback={
      <Center py={12}>
        <VStack>
          <Spinner size="lg" />
          <Text color="gray.600">Loading...</Text>
        </VStack>
      </Center>
    }>
      <BlocksPageContent />
    </Suspense>
  );
}
