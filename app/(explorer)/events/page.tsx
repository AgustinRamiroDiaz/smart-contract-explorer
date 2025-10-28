'use client';

import {
  VStack,
  Text,
  Center,
} from '@chakra-ui/react';
import EventLogsExplorer from '@/app/components/EventLogsExplorer';
import { genlayerTestnet } from '@/app/wagmi';
import { useContract } from '@/app/context/ContractContext';

export default function EventsPage() {
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
