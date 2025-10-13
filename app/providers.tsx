'use client'

import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from './wagmi'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={defaultSystem}>
          {children}
        </ChakraProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
