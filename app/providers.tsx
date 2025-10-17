'use client'

import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from './wagmi'
import { useState } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { ColorModeProvider } from '@/components/ui/color-mode'
import { system } from './theme'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={system}>
          <ColorModeProvider
            attribute="class"
            defaultTheme="light"
            themes={['light', 'dark']}
          >
            {children}
            <Toaster />
          </ColorModeProvider>
        </ChakraProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
