'use client';

import { Suspense } from 'react';
import {
  VStack,
  Text,
  Center,
  Spinner,
} from '@chakra-ui/react';
import EventLogsExplorer from '@/app/components/EventLogsExplorer';
import { genlayerTestnet } from '@/app/wagmi';
import { useContract } from '@/app/context/ContractContext';

function EventsPageContent() {
  const { contractAbi, contractAddress } = useContract();

  return (
    <VStack gap={6} align="stretch">
      {contractAbi && contractAddress ? (
        <EventLogsExplorer
          contractAddress={contractAddress}
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
              Configure your deployment and contract settings on the left to search for event logs
            </Text>
          </VStack>
        </Center>
      )}
    </VStack>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={
      <Center py={12}>
        <VStack>
          <Spinner size="lg" />
          <Text color="gray.600">Loading...</Text>
        </VStack>
      </Center>
    }>
      <EventsPageContent />
    </Suspense>
  );
}
