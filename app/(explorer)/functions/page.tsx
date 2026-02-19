'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box,
  VStack,
  Field,
  Input,
  Text,
  Center,
  Heading,
  Spinner,
} from '@chakra-ui/react';
import FunctionCard from '@/app/components/FunctionCard';
import { mainnet } from '@/app/wagmi';
import { useContract } from '@/app/context/ContractContext';
import type { AbiFunction } from '@/app/types';

// Generate function signature for unique keys
function generateFunctionSignature(func: AbiFunction): string {
  const paramTypes = func.inputs.map(input => input.type).join(',');
  return `${func.name}(${paramTypes})`;
}

// Chain lookup for URL parameter support
const chainsByName = {
  'mainnet': mainnet,
} as const;

function FunctionsPageContent() {
  const { contractAbi, contractAddress, loadingAbiList, activeChain } = useContract();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  // Get chain from URL parameter or default to activeChain (GenLayer with custom RPC)
  const chainParam = searchParams?.get('chain') as keyof typeof chainsByName | null;
  const selectedChain = chainParam && chainsByName[chainParam] ? chainsByName[chainParam] : activeChain;

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape to clear search
      if (e.key === 'Escape' && searchTerm) {
        setSearchTerm('');
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [searchTerm]);

  // Get all functions from ABI
  const allFunctions: AbiFunction[] = contractAbi
    ? contractAbi.filter((item): item is AbiFunction => item.type === 'function')
    : [];

  // Separate read and write functions
  const allReadFunctions = allFunctions.filter(
    (func) => func.stateMutability === 'view' || func.stateMutability === 'pure'
  );
  const allWriteFunctions = allFunctions.filter(
    (func) => func.stateMutability !== 'view' && func.stateMutability !== 'pure'
  );

  // Filter functions based on search term
  const filterBySearch = (funcs: AbiFunction[]) => {
    if (!searchTerm.trim()) return funcs;
    const lowerSearch = searchTerm.toLowerCase();
    return funcs.filter(func => func.name.toLowerCase().includes(lowerSearch));
  };

  const readFunctions = filterBySearch(allReadFunctions);
  const writeFunctions = filterBySearch(allWriteFunctions);

  return (
    <VStack gap={6} align="stretch">
      {/* Search Bar */}
      {contractAbi && contractAddress && allFunctions.length > 0 && (
        <Box>
          <Field.Root>
            <Field.Label fontWeight="semibold">
              Search Functions
              <Text as="span" ml={2} fontSize="xs" color="gray.500" fontWeight="normal">
                (Ctrl+K or Cmd+K to focus)
              </Text>
            </Field.Label>
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by function name..."
              size="lg"
              fontFamily="mono"
            />
            {searchTerm && (
              <Text fontSize="xs" color="gray.600" mt={1}>
                Showing {readFunctions.length + writeFunctions.length} of {allFunctions.length} function{allFunctions.length !== 1 ? 's' : ''}
              </Text>
            )}
          </Field.Root>
        </Box>
      )}

      {/* Loading ABIs indicator */}
      {loadingAbiList && (
        <Center py={12}>
          <VStack>
            <Spinner size="lg" />
            <Text color="gray.600">Loading contract ABIs...</Text>
          </VStack>
        </Center>
      )}

      {/* Function List */}
      {contractAbi && contractAddress && allFunctions.length > 0 && (
        <>
          {readFunctions.length === 0 && writeFunctions.length === 0 ? (
            <Center py={12}>
              <VStack gap={2}>
                <Text color="gray.500" fontSize="lg">
                  No functions found matching &quot;{searchTerm}&quot;
                </Text>
                <Text color="gray.400" fontSize="sm">
                  Try a different search term
                </Text>
              </VStack>
            </Center>
          ) : (
            <VStack gap={8} align="stretch">
              {/* Read Functions */}
              {readFunctions.length > 0 && (
                <Box>
                  <Heading size="lg" mb={2}>Read Functions</Heading>
                  <Text fontSize="sm" color="gray.600" mb={4}>
                    {readFunctions.length} read function{readFunctions.length !== 1 ? 's' : ''} {searchTerm ? 'found' : 'available'}
                  </Text>
                  {readFunctions.map((func, index) => (
                    <FunctionCard
                      key={`read-${index}`}
                      func={func}
                      contractAddress={contractAddress}
                      contractAbi={contractAbi}
                      chain={selectedChain}
                    />
                  ))}
                </Box>
              )}

              {/* Write Functions */}
              {writeFunctions.length > 0 && (
                <Box>
                  <Heading size="lg" mb={2}>Write Functions</Heading>
                  <Text fontSize="sm" color="gray.600" mb={4}>
                    {writeFunctions.length} write function{writeFunctions.length !== 1 ? 's' : ''} {searchTerm ? 'found' : 'available'}
                  </Text>
                  {writeFunctions.map((func, index) => (
                    <FunctionCard
                      key={`write-${index}`}
                      func={func}
                      contractAddress={contractAddress}
                      contractAbi={contractAbi}
                      chain={selectedChain}
                    />
                  ))}
                </Box>
              )}
            </VStack>
          )}
        </>
      )}

      {/* No functions message */}
      {contractAbi && contractAddress && allFunctions.length === 0 && (
        <Center py={12}>
          <Text color="gray.600">
            No functions found in this contract&apos;s ABI
          </Text>
        </Center>
      )}

      {/* Empty state when no contract selected */}
      {!loadingAbiList && !contractAbi && (
        <Center py={12}>
          <VStack gap={2}>
            <Text color="gray.500" fontSize="lg">
              Select a contract from the sidebar to view functions
            </Text>
            <Text color="gray.400" fontSize="sm">
              Configure your deployment and contract settings on the left
            </Text>
          </VStack>
        </Center>
      )}
    </VStack>
  );
}

export default function FunctionsPage() {
  return (
    <Suspense fallback={
      <Center py={12}>
        <VStack>
          <Spinner size="lg" />
          <Text color="gray.600">Loading...</Text>
        </VStack>
      </Center>
    }>
      <FunctionsPageContent />
    </Suspense>
  );
}
