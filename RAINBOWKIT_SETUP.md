# RainbowKit Integration

This project now includes RainbowKit for wallet connection and contract write operations.

## What Was Added

### 1. Dependencies
All required dependencies were already installed:
- `@rainbow-me/rainbowkit`
- `wagmi`
- `@tanstack/react-query`
- `viem`

### 2. Configuration Files

#### [app/wagmi.ts](app/wagmi.ts)
- Wagmi configuration with GenLayer Testnet chain
- RainbowKit setup with default wallets
- **Important**: Replace `'YOUR_PROJECT_ID'` with your actual WalletConnect Project ID from https://cloud.walletconnect.com

#### [app/providers.tsx](app/providers.tsx)
- Wrapped app with `WagmiProvider`, `QueryClientProvider`, and `RainbowKitProvider`
- Imports RainbowKit styles

### 3. Updated Components

#### [app/page.tsx](app/page.tsx)
- Added `ConnectButton` from RainbowKit in the header
- Now displays both read and write functions separately
- Write functions appear first, read functions below

#### [app/components/FunctionCard.tsx](app/components/FunctionCard.tsx)
- Added support for write operations using `useWriteContract` hook
- Shows different button text based on function type and wallet connection status
- Displays transaction status (pending/confirmed) for write operations
- Shows transaction hash when transaction is sent
- Read functions continue to work as before without requiring wallet connection

## How to Use

### 1. Get a WalletConnect Project ID
1. Visit https://cloud.walletconnect.com
2. Create a free account
3. Create a new project
4. Copy your Project ID
5. Replace `'YOUR_PROJECT_ID'` in `app/wagmi.ts` with your actual Project ID

### 2. Connect Your Wallet
- Click the "Connect Wallet" button in the top right
- Select your preferred wallet (MetaMask, WalletConnect, etc.)
- Approve the connection
- Make sure you're connected to GenLayer Testnet (Chain ID: 123420000220)

### 3. Execute Write Functions
- Write functions are displayed in the "Write Functions" section
- Enter the required parameters
- Click "Send Transaction"
- Approve the transaction in your wallet
- Wait for the transaction to be confirmed
- The transaction hash will be displayed

### 4. Execute Read Functions
- Read functions are displayed in the "Read Functions" section
- These work without wallet connection (same as before)
- Enter parameters and click "Execute"
- Results are displayed immediately

## Function Types

- **Write Functions** (orange/green badges): Require wallet connection, modify blockchain state
  - `nonpayable`: Standard write functions
  - `payable`: Functions that can receive native tokens

- **Read Functions** (blue/purple badges): No wallet needed, read-only
  - `view`: Can read contract state
  - `pure`: Don't access contract state

## Network Configuration

The app is configured for **GenLayer Testnet**:
- Chain ID: 123420000220
- RPC URL: https://genlayer-testnet.rpc.caldera.xyz/http
- Currency: GEN

If you need to add more networks, edit the `chains` array in `app/wagmi.ts`.
