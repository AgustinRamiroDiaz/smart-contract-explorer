# GenLayer Contract Explorer - Specification

## Overview

The GenLayer Contract Explorer is a web application that enables users to interact with smart contracts deployed on the GenLayer Testnet. It provides a user-friendly interface for discovering deployed contracts, connecting wallets, and executing both read and write operations on smart contracts.

## High-Level Architecture

The application consists of four main functional areas:

1. **Contract Discovery** - Loading and selecting contracts
2. **Wallet Management** - Connecting user wallets
3. **Contract Reading** - Executing view/pure functions
4. **Contract Writing** - Executing state-changing transactions

---

## 1. Loading Contract Addresses

### Purpose
Enable users to discover and select contracts deployed on the GenLayer Testnet.

### Data Source
- **Primary Source**: `/public/deployments.json`
- **Structure**: JSON file containing deployment configurations with contract addresses

### Expected Format
```json
{
  "deployment_name": {
    "contracts": {
      "ContractName": {
        "address": "0x..."
      }
    }
  }
}
```

### Behavior

#### 1.1 Loading Deployments
- On application startup, fetch and parse `deployments.json`
- Parse the JSON structure to extract available deployments
- Handle errors gracefully if file is missing or malformed
- Display deployment names in a user-selectable dropdown

#### 1.2 Selecting a Deployment
- User selects a deployment from dropdown (e.g., "deployment_asimov_phase3")
- Application extracts all contracts associated with that deployment
- Populate contract selector with available contract names
- Display contract count to user

#### 1.3 Selecting a Contract
- User selects a specific contract (e.g., "Staking", "Registry")
- Extract the contract address from the deployment data
- Store selected contract address in application state
- Load the corresponding ABI (see next section)
- Update UI to show selected contract information

#### 1.4 Error Handling
- Missing deployments file: Show error message, disable contract selection
- Invalid JSON: Show parsing error, provide helpful feedback
- Empty deployments: Inform user no contracts are available
- Network errors: Retry mechanism with user feedback

---

## 2. Loading Contract ABIs

### Purpose
Load the Application Binary Interface (ABI) for selected contracts to understand available functions and their signatures.

### Data Source
- **Primary Source**: `/public/abis/{ContractName}.sol/{ContractName}.json`
- **Structure**: JSON artifacts from Solidity compilation

### Expected Format
```json
{
  "abi": [
    {
      "type": "function",
      "name": "functionName",
      "inputs": [...],
      "outputs": [...],
      "stateMutability": "view" | "pure" | "nonpayable" | "payable"
    }
  ]
}
```

### Behavior

#### 2.1 Loading ABIs
- When a contract is selected, construct path: `/public/abis/{ContractName}.sol/{ContractName}.json`
- Fetch the ABI artifact file
- Parse JSON and extract the `abi` array
- Validate ABI structure (contains required fields)
- Store ABI in application state

#### 2.2 ABI Parsing
- Parse function signatures from ABI
- Categorize functions by type:
  - **Read functions**: `view` and `pure` functions
  - **Write functions**: `nonpayable` and `payable` functions
- Extract function parameters (name, type, components for structs/tuples)
- Extract return types for read functions

#### 2.3 Function Discovery
- Display available read functions in "Read Contract" section
- Display available write functions in "Write Contract" section
- Show function names in user-friendly format
- Display function parameters with type information

#### 2.4 Error Handling
- Missing ABI file: Show error, suggest checking contract name
- Invalid ABI format: Display parsing error
- Unsupported function types: Log warning, skip unsupported functions
- Network errors: Retry with backoff, show loading state

---

## 3. Connecting Wallet

### Purpose
Enable users to connect their Web3 wallets to sign transactions and interact with contracts.

### Technology Stack
- **RainbowKit**: Wallet connection UI components
- **wagmi**: React hooks for Ethereum interactions
- **viem**: Low-level Ethereum operations

### Behavior

#### 3.1 Initial State
- Application loads without wallet connection
- "Connect Wallet" button is prominently displayed
- Write operations are disabled until wallet is connected
- Read operations are available without wallet connection

#### 3.2 Wallet Connection Flow
1. User clicks "Connect Wallet" button
2. RainbowKit modal opens showing available wallet options:
   - MetaMask
   - Rainbow
   - Coinbase Wallet
   - WalletConnect (for mobile wallets)
3. User selects preferred wallet
4. Wallet browser extension/app prompts for connection approval
5. User approves connection in wallet
6. Application receives wallet address and connection status
7. UI updates to show:
   - Connected wallet address (truncated: `0x1234...5678`)
   - Account balance (optional)
   - Network information
   - Disconnect option

#### 3.3 Network Verification
- Verify wallet is connected to GenLayer Testnet (Chain ID: 123420000220)
- If wrong network:
  - Prompt user to switch networks
  - Provide "Switch Network" button
  - Attempt automatic network switch via wallet API
  - Show network details (RPC URL, Chain ID, Currency)

#### 3.4 Wallet State Management
- Persist wallet connection across page refreshes (using localStorage)
- Handle wallet disconnection events
- Handle account changes (user switches accounts in wallet)
- Handle network changes (user switches networks)
- Show loading states during connection process

#### 3.5 Security Considerations
- Never request private keys
- Only request permissions when necessary
- Display clear messaging about what user is signing
- Validate all wallet responses before proceeding

#### 3.6 Error Handling
- User rejects connection: Show friendly message, allow retry
- Wallet not installed: Show installation instructions
- Network error: Display error, provide troubleshooting steps
- Session timeout: Prompt user to reconnect

---

## 4. Reading from Contracts

### Purpose
Execute read-only contract functions (view/pure) to query blockchain state without requiring transactions.

### Characteristics
- No wallet connection required
- No gas fees
- Instant results
- No blockchain state changes

### Behavior

#### 4.1 Function Selection
- Display list of read functions from contract ABI
- Show function names and parameters
- Highlight currently selected function
- Display function signature for clarity

#### 4.2 Parameter Input
- Dynamically generate input fields based on function parameters
- Support various Solidity types:
  - **Primitive types**: uint256, int256, bool, address, bytes
  - **Strings**: UTF-8 text input
  - **Arrays**: Dynamic array inputs
  - **Structs/Tuples**: Nested input groups
- Provide input validation:
  - Address format validation (checksummed addresses)
  - Numeric range validation
  - Type-specific constraints
- Show placeholder text with examples
- Display parameter types alongside inputs

#### 4.3 Function Execution
1. User fills in required parameters (if any)
2. User clicks "Read" or "Query" button
3. Application validates all inputs
4. Construct contract call using viem/wagmi:
   - Contract address
   - Function name
   - ABI fragment
   - Input parameters
5. Execute read call via RPC
6. Wait for response
7. Parse return values

#### 4.4 Result Display
- Show results in human-readable format
- Handle different return types:
  - **Numbers**: Display with proper formatting (handle BigInt)
  - **Addresses**: Display with copy-to-clipboard functionality
  - **Booleans**: Show as true/false
  - **Strings**: Display as text
  - **Arrays**: Show as formatted lists
  - **Structs**: Display as key-value pairs
- Show loading indicator during execution
- Display timestamp of last read
- Allow copying results

#### 4.5 Advanced Features
- Batching multiple reads (optional)
- Automatic refresh at intervals (optional)
- Historical reads at specific block numbers (optional)
- Decode complex return types

#### 4.6 Error Handling
- Contract reverts: Display revert reason
- Invalid parameters: Show validation errors before execution
- Network errors: Show retry option
- ABI mismatch: Clear error message
- Timeout: Cancel and inform user

---

## 5. Writing to Contracts

### Purpose
Execute state-changing contract functions that modify blockchain state through transactions.

### Characteristics
- Requires wallet connection
- Costs gas fees
- Requires user confirmation
- Changes blockchain state
- Returns transaction hash

### Behavior

#### 5.1 Pre-Conditions
- Wallet must be connected (show connection prompt if not)
- Wallet must be on correct network (GenLayer Testnet)
- User must have sufficient native token balance for gas

#### 5.2 Function Selection
- Display list of write functions from contract ABI
- Show function names and parameters
- Indicate if function is payable (accepts ETH/native token)
- Display estimated gas costs (optional)

#### 5.3 Parameter Input
- Same input mechanisms as read functions
- Additional field for payable functions:
  - ETH/native token amount to send
  - Value input with unit selector (wei, gwei, ether)
- Real-time input validation
- Show parameter descriptions from NatSpec (if available)

#### 5.4 Transaction Preparation
1. User fills in all required parameters
2. Application validates inputs
3. Estimate gas for transaction:
   - Call `estimateGas` with parameters
   - Add gas buffer (e.g., 20% extra)
   - Display estimated gas cost to user
4. Show transaction summary:
   - Function name
   - Parameters
   - Gas estimate
   - Total cost
   - Receiving contract address

#### 5.5 Transaction Execution Flow
1. User clicks "Write" or "Execute" button
2. Application constructs transaction:
   - Contract address
   - Function signature
   - Encoded parameters
   - Gas limit
   - Value (if payable)
3. Send transaction request to wallet
4. Wallet popup shows transaction details
5. User reviews and approves in wallet
6. Transaction is signed and broadcast
7. Application receives transaction hash
8. Monitor transaction status

#### 5.6 Transaction Monitoring
- Display transaction hash with link to block explorer
- Show transaction status:
  - **Pending**: Waiting for confirmation
  - **Success**: Transaction mined successfully
  - **Failed**: Transaction reverted
- Show confirmations count
- Display gas used
- Show block number when mined
- Provide link to view transaction details

#### 5.7 Post-Transaction Actions
- Show success/failure notification
- Display transaction receipt details
- Parse events/logs emitted (optional)
- Suggest refreshing read data to see changes
- Clear input form (optional)
- Show transaction history (optional)

#### 5.8 Error Handling
- Insufficient balance: Clear error with balance info
- User rejects transaction: Show cancellation message
- Gas estimation fails: Show error, allow manual gas input
- Transaction reverts: Display revert reason from receipt
- Network errors: Provide retry mechanism
- Nonce issues: Suggest checking pending transactions
- Timeout: Show pending status, allow monitoring

#### 5.9 Security Warnings
- Warn users about irreversible actions
- Display clear transaction costs
- Highlight payable functions
- Show warnings for high-value transactions
- Require explicit confirmation for sensitive operations

---

## 6. User Interface Requirements

### 6.1 Layout
- **Header**: App title, wallet connection status
- **Main Section**:
  - Deployment selector
  - Contract selector
  - Tab navigation (Read / Write)
  - Function selector
  - Parameter inputs
  - Action buttons
  - Results display area

### 6.2 Responsiveness
- Mobile-friendly design
- Responsive breakpoints for tablets and desktops
- Touch-friendly controls

### 6.3 Accessibility
- Keyboard navigation support
- Screen reader friendly
- Clear error messages
- Loading states for all async operations

### 6.4 User Feedback
- Loading spinners for async operations
- Success/error notifications
- Confirmation dialogs for important actions
- Tooltips for complex parameters
- Help text for common issues

---

## 7. Data Flow Summary

```
1. App Loads
   ↓
2. Load deployments.json
   ↓
3. User selects deployment
   ↓
4. User selects contract
   ↓
5. Load contract ABI
   ↓
6. Parse functions (read/write)
   ↓
7a. READ PATH:              7b. WRITE PATH:
    - Select read function      - User connects wallet
    - Enter parameters          - Verify network
    - Execute call             - Select write function
    - Display results          - Enter parameters
                               - Estimate gas
                               - Send transaction
                               - Monitor status
                               - Display receipt
```

---

## 8. Configuration

### 8.1 Chain Configuration
- **Chain ID**: 123420000220
- **Network Name**: GenLayer Testnet
- **RPC URL**: https://genlayer-testnet.rpc.caldera.xyz/http
- **Currency**: Native token (symbol TBD)
- **Block Explorer**: (URL TBD)

### 8.2 WalletConnect Configuration
- **Project ID**: Configured in `lib/wagmi.ts`
- Obtain from WalletConnect Cloud

### 8.3 Data Paths
- **Deployments**: `/public/deployments.json`
- **ABIs**: `/public/abis/{ContractName}.sol/{ContractName}.json`

---

## 9. Future Enhancements (Optional)

- Multi-chain support
- Contract verification
- Function parameter history
- Transaction simulation before execution
- Event log monitoring
- Contract source code display
- Function documentation from NatSpec
- Batch transaction execution
- Gas price recommendations
- ENS name resolution
- Token balance display
- Contract favorites/bookmarks

---

## 10. Technical Constraints

- Next.js 14.2.5+ (App Router)
- React 18+
- TypeScript for type safety
- wagmi v2 for Ethereum interactions
- viem v2 for low-level operations
- RainbowKit for wallet UI
- Tailwind CSS for styling

---

## 11. Success Criteria

The application is successful when:

1. Users can browse all available contract deployments
2. Users can view all contracts within a deployment
3. Users can see all available functions (read and write) for any contract
4. Users can execute read functions without wallet connection
5. Users can connect their wallet using common providers
6. Users can execute write functions and receive transaction receipts
7. All errors are handled gracefully with helpful messages
8. The interface is intuitive and requires no technical documentation
9. Transactions are transparent with clear cost estimates
10. Users can verify transaction outcomes on the blockchain
