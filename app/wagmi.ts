import { defineChain } from 'viem'
import { mainnet } from 'viem/chains'
import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'

// Re-export mainnet for use in tests
export { mainnet }

// Default RPC endpoints
export const DEFAULT_RPC_URL = 'https://zksync-os-testnet-genlayer.zksync.dev';
export const DEFAULT_WS_URL = 'wss://zksync-os-testnet-genlayer.zksync.dev/ws';

// Define GenLayer Testnet with default RPC
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
      http: [DEFAULT_RPC_URL],
      webSocket: [DEFAULT_WS_URL],
    },
    public: {
      http: [DEFAULT_RPC_URL],
      webSocket: [DEFAULT_WS_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'Explorer',
      url: 'https://genlayer-testnet.explorer.caldera.xyz',
    },
  },
})

// Create a GenLayer chain definition with custom RPC URLs
export function createGenlayerChain(rpcUrl: string, wsUrl: string) {
  return defineChain({
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
        http: [rpcUrl],
        webSocket: [wsUrl],
      },
      public: {
        http: [rpcUrl],
        webSocket: [wsUrl],
      },
    },
    blockExplorers: {
      default: {
        name: 'Explorer',
        url: 'https://genlayer-testnet.explorer.caldera.xyz',
      },
    },
  })
}

export const config = createConfig({
  chains: [genlayerTestnet, mainnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  ssr: true,
  transports: {
    [genlayerTestnet.id]: http(DEFAULT_RPC_URL),
    [mainnet.id]: http(),
  },
})
