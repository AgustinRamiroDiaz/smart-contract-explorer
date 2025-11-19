'use client';

import { Suspense } from 'react';
import {
  VStack,
  Text,
  Center,
  Spinner,
} from '@chakra-ui/react';
import Debugger from '@/app/components/Debugger';
import { genlayerTestnet } from '@/app/wagmi';

function DebuggerPageContent() {
  return (
    <VStack gap={6} align="stretch">
      <Debugger chain={genlayerTestnet} />
    </VStack>
  );
}

export default function DebuggerPage() {
  return (
    <Suspense fallback={
      <Center py={12}>
        <VStack>
          <Spinner size="lg" />
          <Text color="gray.600">Loading...</Text>
        </VStack>
      </Center>
    }>
      <DebuggerPageContent />
    </Suspense>
  );
}
