/**
 * Shared utilities for decoding transactions and loading ABIs
 */

import { decodeFunctionData, decodeEventLog, Transaction, TransactionReceipt, Hash } from 'viem';
import type { DecodedEventLog, DecodedFunctionData, AbiFunction, AbiEvent, ContractAbi, DeploymentsFile } from '../types';

// Utility function to convert BigInts to strings for JSON display
export function serializeBigInts(obj: unknown): unknown {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value);
    }
    return result;
  }
  if (obj === null || typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  return String(obj);
}

/**
 * Find a contract by its address in the current deployment
 */
export function findContractByAddress(
  address: string,
  deploymentsFile: DeploymentsFile,
  selectedNetwork: string,
  selectedDeployment: string
): string | null {
  if (!selectedNetwork || !selectedDeployment) return null;

  const deployment = deploymentsFile[selectedNetwork]?.[selectedDeployment];
  if (!deployment) return null;

  // Search for the contract with matching address (case-insensitive)
  const normalizedAddress = address.toLowerCase();
  for (const [contractName, contractAddress] of Object.entries(deployment)) {
    if (contractAddress.toLowerCase() === normalizedAddress) {
      return contractName;
    }
  }

  return null;
}

/**
 * Load ABI for a specific contract from the ABIs folder
 */
export async function loadAbiForContract(
  contractName: string,
  abisFolderHandle: FileSystemDirectoryHandle | null
): Promise<ContractAbi | null> {
  if (!abisFolderHandle) {
    return null;
  }

  try {
    const solDir = await abisFolderHandle.getDirectoryHandle(`${contractName}.sol`);
    const jsonFile = await solDir.getFileHandle(`${contractName}.json`);
    const file = await jsonFile.getFile();
    const text = await file.text();

    interface ArtifactFile {
      abi: ContractAbi;
      [key: string]: unknown;
    }

    const data = JSON.parse(text) as ContractAbi | ArtifactFile;

    // Handle both raw ABI arrays and artifact objects with an abi field
    const abi: ContractAbi = Array.isArray(data) ? data : data.abi;

    if (!abi || !Array.isArray(abi)) {
      return null;
    }

    return abi;
  } catch (err) {
    console.error('Error loading ABI:', err);
    return null;
  }
}

/**
 * Decode transaction input and events with a given ABI
 */
export async function decodeTransactionWithAbi(
  transaction: Transaction,
  receipt: TransactionReceipt,
  abi: ContractAbi
): Promise<{
  decodedInput: DecodedFunctionData | { error: string } | null;
  decodedEvents: DecodedEventLog[];
}> {
  let decodedInput: DecodedFunctionData | { error: string } | null = null;
  let decodedEvents: DecodedEventLog[] = [];

  // Decode transaction input
  if (transaction.input && transaction.input !== '0x') {
    try {
      const decoded = decodeFunctionData({
        abi: abi,
        data: transaction.input,
      });

      const matchingFunction = abi.find(
        (item): item is AbiFunction => item.type === 'function' && item.name === decoded.functionName
      );

      decodedInput = {
        functionName: decoded.functionName,
        args: decoded.args || [],
        signature: matchingFunction ? `${matchingFunction.name}(${matchingFunction.inputs.map((input) => `${input.type} ${input.name}`).join(', ')})` : decoded.functionName
      };
    } catch {
      decodedInput = { error: 'Failed to decode input data. The ABI might not match this transaction.' };
    }
  }

  // Decode events/logs
  if (receipt.logs && receipt.logs.length > 0) {
    decodedEvents = receipt.logs.map((log, index: number) => {
      try {
        const topics = log.topics;
        if (topics && topics.length > 0) {
          const events = abi.filter((item): item is AbiEvent => item.type === 'event');

          for (const event of events) {
            try {
              const decoded = decodeEventLog({
                abi: [event],
                data: log.data,
                topics: topics,
              });
              return {
                index,
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                logIndex: log.logIndex,
                address: log.address,
                eventName: decoded.eventName,
                args: decoded.args as Record<string, unknown>,
                decoded: true,
              };
            } catch {
              continue;
            }
          }
        }

        return {
          index,
          address: log.address,
          topics: log.topics as Hash[],
          data: log.data,
          decoded: false,
        };
      } catch {
        return {
          index,
          address: log.address,
          error: 'Failed to decode log',
          decoded: false,
        };
      }
    });
  }

  return { decodedInput, decodedEvents };
}

/**
 * Get list of available contracts from the current deployment that have ABIs
 */
export function getAvailableContracts(
  deploymentsFile: DeploymentsFile,
  selectedNetwork: string,
  selectedDeployment: string,
  availableAbis: Set<string>
): string[] {
  if (!selectedNetwork || !selectedDeployment) return [];

  return Object.keys(deploymentsFile[selectedNetwork]?.[selectedDeployment] || {}).filter(
    (key) => {
      const hasAddress = deploymentsFile[selectedNetwork][selectedDeployment][key]?.startsWith('0x');
      const hasAbi = availableAbis.has(key);
      return hasAddress && hasAbi;
    }
  );
}
