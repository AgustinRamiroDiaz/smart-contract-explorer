'use client';

import { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
  Grid,
  GridItem,
  Container,
  HStack,
} from '@chakra-ui/react';
import { Button } from '@chakra-ui/react';
import Sidebar from '@/app/components/Sidebar';
import SetupModal from '@/app/components/SetupModal';
import { useContract } from '@/app/context/ContractContext';

interface ExplorerLayoutProps {
  children: ReactNode;
}

export default function ExplorerLayout({ children }: ExplorerLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    showSetupModal,
    setShowSetupModal,
    handleSetupComplete,
    deploymentsFileHandle,
    abisFolderHandle,
  } = useContract();

  const isActive = (path: string) => pathname === path;

  // Helper function to build URL with current query params
  const buildUrlWithParams = (path: string) => {
    const params = searchParams?.toString();
    return params ? `${path}?${params}` : path;
  };

  return (
    <Box minH="100vh">
      {/* Setup Modal */}
      <SetupModal
        open={showSetupModal}
        onComplete={handleSetupComplete}
        onSkip={() => setShowSetupModal(false)}
        hasDeploymentsFile={deploymentsFileHandle !== null}
        hasFolderHandle={abisFolderHandle !== null}
      />

      {/* Main Layout */}
      <Grid templateColumns="350px 1fr" h="100vh">
        {/* Sidebar */}
        <GridItem>
          <Sidebar />
        </GridItem>

        {/* Main Panel */}
        <GridItem
          overflowY="auto"
          bg={{ base: 'white' }}
          _dark={{ bg: 'gray.800' }}
        >
          {/* Navigation Tabs */}
          <Box borderBottomWidth="1px" px={6} pt={4} pb={2}>
            <HStack gap={2}>
              <Link href={buildUrlWithParams('/functions')} passHref>
                <Button
                  variant={isActive('/functions') ? 'solid' : 'ghost'}
                  colorScheme={isActive('/functions') ? 'blue' : 'gray'}
                  size="sm"
                >
                  Function Calling
                </Button>
              </Link>
              <Link href={buildUrlWithParams('/transactions')} passHref>
                <Button
                  variant={isActive('/transactions') ? 'solid' : 'ghost'}
                  colorScheme={isActive('/transactions') ? 'blue' : 'gray'}
                  size="sm"
                >
                  Transaction Explorer
                </Button>
              </Link>
              <Link href={buildUrlWithParams('/blocks')} passHref>
                <Button
                  variant={isActive('/blocks') ? 'solid' : 'ghost'}
                  colorScheme={isActive('/blocks') ? 'blue' : 'gray'}
                  size="sm"
                >
                  Block Explorer
                </Button>
              </Link>
              <Link href={buildUrlWithParams('/events')} passHref>
                <Button
                  variant={isActive('/events') ? 'solid' : 'ghost'}
                  colorScheme={isActive('/events') ? 'blue' : 'gray'}
                  size="sm"
                >
                  Event Logs
                </Button>
              </Link>
            </HStack>
          </Box>

          {/* Page Content */}
          <Container maxW="container.lg" py={6}>
            {children}
          </Container>
        </GridItem>
      </Grid>
    </Box>
  );
}
