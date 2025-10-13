'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button, Box, Text } from '@chakra-ui/react';
import { useEffect } from 'react';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, error, isPending, status } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    console.log('Connect status:', status);
    console.log('isPending:', isPending);
    console.log('error:', error);
  }, [status, isPending, error]);

  if (isConnected && address) {
    return (
      <Box>
        <Button onClick={() => disconnect()} colorScheme="blue" variant="outline">
          <Text fontSize="sm">
            {address.slice(0, 6)}...{address.slice(-4)}
          </Text>
        </Button>
      </Box>
    );
  }

  const handleConnect = () => {
    const connector = connectors[0];
    console.log('Available connectors:', connectors);
    console.log('Connector details:', connector);

    if (connector) {
      console.log('Connecting with connector:', connector.name, connector.id);
      try {
        connect({ connector, chainId: 123420000220 });
      } catch (err) {
        console.error('Connect error:', err);
      }
    } else {
      console.error('No connectors available. Make sure you have a wallet extension installed (e.g., MetaMask)');
    }
  };

  return (
    <Box>
      <Button
        onClick={handleConnect}
        colorScheme="blue"
        loading={isPending}
        disabled={!connectors.length}
      >
        {connectors.length ? 'Connect Wallet' : 'No Wallet Found'}
      </Button>
      {error && (
        <Text fontSize="xs" color="red.500" mt={1}>
          {error.message}
        </Text>
      )}
    </Box>
  );
}
