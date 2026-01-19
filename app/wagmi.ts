import { defineChain } from 'viem'
import { mainnet } from 'viem/chains'
import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'

// Re-export mainnet for use in tests
export { mainnet }

// Define GenLayer Testnet
export const genlayerTestnet = defineChain({
  id: 4221,
  name: 'GenLayer Testnet',
  network: 'genlayer-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'GenLayer',
    symbol: 'GEN',
  },
  rpcUrls: {
    default: {
      http: ['https://genlayer-testnet.rpc.caldera.xyz/http'],
    },
    public: {
      http: ['https://genlayer-testnet.rpc.caldera.xyz/http'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Explorer',
      url: 'https://genlayer-testnet.explorer.caldera.xyz',
    },
  },
})

export const config = createConfig({
  chains: [genlayerTestnet, mainnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  ssr: true,
  transports: {
    [genlayerTestnet.id]: http(),
    [mainnet.id]: http(),
  },
})
