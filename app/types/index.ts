/**
 * Shared TypeScript types for the Contract Explorer application
 */

import { Chain, Hash, TransactionReceipt, Transaction, Log } from 'viem';

// ============================================================================
// ABI Types
// ============================================================================

export interface AbiParameter {
  name: string;
  type: string;
  internalType?: string;
  components?: AbiParameter[];
  indexed?: boolean;
}

export interface AbiFunction {
  name: string;
  type: 'function';
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
  inputs: AbiParameter[];
  outputs: AbiParameter[];
}

export interface AbiEvent {
  name: string;
  type: 'event';
  inputs: AbiParameter[];
  anonymous?: boolean;
}

export interface AbiConstructor {
  type: 'constructor';
  stateMutability: 'nonpayable' | 'payable';
  inputs: AbiParameter[];
}

export interface AbiFallback {
  type: 'fallback';
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
}

export interface AbiReceive {
  type: 'receive';
  stateMutability: 'payable';
}

export interface AbiError {
  name: string;
  type: 'error';
  inputs: AbiParameter[];
}

export type AbiItem =
  | AbiFunction
  | AbiEvent
  | AbiConstructor
  | AbiFallback
  | AbiReceive
  | AbiError;

export type ContractAbi = AbiItem[];

// ============================================================================
// Deployment Types
// ============================================================================

export type Deployment = Record<string, string>; // contract name -> address
export type Network = Record<string, Deployment>; // deployment name -> deployment
export type DeploymentsFile = Record<string, Network>; // network name -> network

// ============================================================================
// Transaction & Event Types
// ============================================================================

export interface DecodedFunctionData {
  functionName: string;
  args?: readonly unknown[] | Record<string, unknown>;
  signature?: string;
}

export interface DecodedEventLog {
  index: number;
  blockNumber?: bigint;
  transactionHash?: Hash;
  logIndex?: number;
  address: string;
  eventName?: string;
  args?: Record<string, unknown> | readonly unknown[];
  topics?: Hash[];
  data?: string;
  decoded: boolean;
  error?: string;
}

// Type aliases for viem's transaction types
export type TransactionData = Transaction;
export type ReceiptData = TransactionReceipt;

// ============================================================================
// Component Props Types
// ============================================================================

export interface TransactionExplorerProps {
  chain: Chain;
}

export interface FunctionCardProps {
  func: AbiFunction;
  contractAddress: string;
  contractAbi: ContractAbi;
  chain: Chain;
}

export interface EventLogsExplorerProps {
  contractAddress: string;
  contractAbi: ContractAbi;
  chain: Chain;
}

export interface SetupModalProps {
  open: boolean;
  onComplete: (
    fileHandle: FileSystemFileHandle | null,
    folderHandle: FileSystemDirectoryHandle | null
  ) => void;
  onSkip: () => void;
  hasDeploymentsFile: boolean;
  hasFolderHandle: boolean;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface JsonData {
  [key: string]: unknown;
}

// ============================================================================
// Context Types
// ============================================================================

export interface ContractContextType {
  deploymentsFile: DeploymentsFile;
  setDeploymentsFile: (file: DeploymentsFile) => void;
  deploymentsFileHandle: FileSystemFileHandle | null;
  setDeploymentsFileHandle: (handle: FileSystemFileHandle | null) => void;
  selectedNetwork: string;
  setSelectedNetwork: (network: string) => void;
  selectedDeployment: string;
  setSelectedDeployment: (deployment: string) => void;
  selectedContract: string;
  setSelectedContract: (contract: string) => void;
  contractAddress: string;
  setContractAddress: (address: string) => void;
  contractAbi: ContractAbi | null;
  setContractAbi: (abi: ContractAbi | null) => void;
  loadingAbi: boolean;
  setLoadingAbi: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  abisFolderHandle: FileSystemDirectoryHandle | null;
  setAbisFolderHandle: (handle: FileSystemDirectoryHandle | null) => void;
  availableAbis: Set<string>;
  setAvailableAbis: (abis: Set<string>) => void;
  loadingAbiList: boolean;
  setLoadingAbiList: (loading: boolean) => void;
  isInitializing: boolean;
  showSetupModal: boolean;
  setShowSetupModal: (show: boolean) => void;
  handleSelectDeploymentsFile: () => Promise<void>;
  handleSelectAbisFolder: () => Promise<void>;
  handleSetupComplete: (
    fileHandle: FileSystemFileHandle | null,
    folderHandle: FileSystemDirectoryHandle | null
  ) => Promise<void>;
  handleReconfigure: () => void;
  scanAbisFolder: (dirHandle: FileSystemDirectoryHandle) => Promise<void>;
  loadAbiFromFolder: (contractName: string) => Promise<void>;
}

// ============================================================================
// Utility Types
// ============================================================================

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue };

// Type guard to check if an ABI item is a function
export function isAbiFunction(item: AbiItem): item is AbiFunction {
  return item.type === 'function';
}

// Type guard to check if an ABI item is an event
export function isAbiEvent(item: AbiItem): item is AbiEvent {
  return item.type === 'event';
}

// Type guard to check if an ABI item is a constructor
export function isAbiConstructor(item: AbiItem): item is AbiConstructor {
  return item.type === 'constructor';
}

// Type guard to check if an ABI item is an error
export function isAbiError(item: AbiItem): item is AbiError {
  return item.type === 'error';
}
