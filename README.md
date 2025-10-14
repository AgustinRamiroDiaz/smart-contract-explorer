# GenLayer Contract Explorer

A lightweight, client-side contract explorer for interacting with GenLayer smart contracts. This tool allows you to read contract state, execute functions, and interact with deployed contracts without needing to write any code.

## Why This Exists

When developing and testing smart contracts, you often need to:
- Quickly interact with deployed contracts to test functionality
- Read contract state without writing custom scripts
- Execute write functions and see transaction results
- Share a simple interface with team members for testing

Traditional block explorers can be complex and may not support custom chains immediately. This explorer is designed to be:
- **100% Client-Side**: No backend required, can be deployed to any CDN
- **Portable**: Works with any EVM-compatible chain
- **Simple**: Just upload your deployments file and select your ABIs folder
- **Developer-Friendly**: Designed for rapid development and testing workflows

## Features

- =Á **Folder-based ABI Loading**: Point to your Hardhat/Foundry artifacts folder
- = **Function Search**: Quickly find the function you need
- =Ý **Read & Write Functions**: Execute both view and state-changing functions
- =¼ **Wallet Integration**: Connect your wallet to sign transactions
- =¾ **Persistent State**: Remembers your configuration across sessions
- < **CDN Ready**: Fully static, deploy anywhere

## How to Run Locally

### Prerequisites

- Node.js 18+ and npm installed

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd simple-explorer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

To create a static build for CDN deployment:

```bash
npm run build
```

The static files will be generated in the `/out` directory. You can deploy this directory to any static hosting service (Netlify, Vercel, Cloudflare Pages, etc.).

## Usage

1. **Upload Deployments File**: Upload a JSON file containing your contract deployments in the format:
   ```json
   {
     "network-name": {
       "deployment-name": {
         "ContractName": "0x..."
       }
     }
   }
   ```

2. **Select ABIs Folder**: Click "Select ABIs Folder" and choose your contracts' artifacts directory (e.g., `artifacts/` from Hardhat or `out/` from Foundry)

3. **Select Network & Deployment**: Choose from your uploaded deployments

4. **Select Contract**: Pick the contract you want to interact with

5. **Interact**: The explorer will display all available functions, grouped by read/write operations

## Browser Compatibility

This app uses the File System Access API for folder selection, which is supported in:
-  Chrome/Chromium 86+
-  Edge 86+
-  Brave
-   Firefox (limited support)
-   Safari (limited support)

For unsupported browsers, you may need to manually upload ABI files.

## Tech Stack

- **Next.js 15** - React framework with static export
- **Chakra UI** - Component library
- **wagmi** - Web3 React hooks
- **viem** - TypeScript Ethereum library
- **json-edit-react** - JSON viewer component

## License

MIT
