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
import { useContract } from '@/app/context/ContractContext';

function DebuggerPageContent() {
  const { deploymentsFile, selectedNetwork, abisFolderHandle } = useContract();

  return (
    <VStack gap={6} align="stretch">
      {deploymentsFile && selectedNetwork && abisFolderHandle ? (
        <Debugger
          deploymentsFile={deploymentsFile}
          selectedNetwork={selectedNetwork}
          chain={genlayerTestnet}
          abisFolderHandle={abisFolderHandle}
        />
      ) : (
        <Center py={12}>
          <VStack gap={2}>
            <Text color="gray.500" fontSize="lg">
              Select a network from the sidebar
            </Text>
            <Text color="gray.400" fontSize="sm">
              Configure your deployment settings on the left to use the debugger
            </Text>
          </VStack>
        </Center>
      )}
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
