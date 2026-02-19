'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPublicClient, http } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import {
  Box,
  Button,
  Text,
  Input,
  Field,
  VStack,
  HStack,
  Badge,
  Code,
  Alert,
  Grid,
  Skeleton,
  Dialog,
  Portal,
  IconButton,
} from '@chakra-ui/react';
import { useColorMode } from '@/components/ui/color-mode';
import { JsonEditor, githubDarkTheme, githubLightTheme } from 'json-edit-react';
import { toaster } from '@/components/ui/toaster';
import { validateSolidityType, getPlaceholderForType } from '@/app/utils/validation';
import { getArgsArray } from '@/app/utils/argumentParser';
import AddressInput from './AddressInput';
import { LuCopy } from 'react-icons/lu';
import type { FunctionCardProps, AbiFunction, SerializableValue, ContractAbi } from '../types';

// Utility function to convert BigInts to strings for JSON display
function serializeBigInts(obj: unknown): SerializableValue {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts) as SerializableValue[];
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, SerializableValue> = {};
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

// Generate function signature for CLI commands
function generateFunctionSignature(func: AbiFunction): string {
  const paramTypes = func.inputs.map(input => input.type).join(',');
  return `${func.name}(${paramTypes})`;
}

// Generate Foundry cast command
function generateFoundryCommand(
  func: AbiFunction,
  contractAddress: string,
  args: Record<string, string>,
  rpcUrl?: string,
  blockNumber?: string,
  value?: string
): string {
  const isReadFunction = func.stateMutability === 'view' || func.stateMutability === 'pure';
  const command = isReadFunction ? 'cast call' : 'cast send';
  const signature = generateFunctionSignature(func);

  // Get args in order
  const argsArray = func.inputs.map(input => {
    const argValue = args[input.name] || '';
    // Quote string arguments that contain spaces or are addresses
    if (input.type === 'address' || input.type === 'string' || argValue.includes(' ')) {
      return `"${argValue}"`;
    }
    return argValue || '""';
  });

  const argsString = argsArray.length > 0 ? ' ' + argsArray.join(' ') : '';
  const privateKeyFlag = isReadFunction ? '' : ' --private-key $PRIVATE_KEY';
  const blockFlag = isReadFunction && blockNumber && blockNumber.trim() !== '' ? ` --block ${blockNumber}` : '';
  const valueFlag = func.stateMutability === 'payable' && value && value.trim() !== '' ? ` --value ${value}` : '';
  const rpcUrlValue = rpcUrl || '$RPC_URL';

  return `${command} ${contractAddress} "${signature}"${argsString} --rpc-url ${rpcUrlValue}${privateKeyFlag}${blockFlag}${valueFlag}`;
}

// Generate ZKsync CLI command
function generateZksyncCommand(
  func: AbiFunction,
  contractAddress: string,
  args: Record<string, string>,
  chainNetwork?: string,
  blockNumber?: string,
  value?: string
): string {
  const isReadFunction = func.stateMutability === 'view' || func.stateMutability === 'pure';
  const command = isReadFunction ? 'npx zksync-cli contract read' : 'npx zksync-cli contract write';
  const signature = generateFunctionSignature(func);

  // Get args in order
  const argsArray = func.inputs.map(input => {
    const argValue = args[input.name] || '';
    return `"${argValue}"`;
  });

  const argsString = argsArray.length > 0 ? ` --args ${argsArray.join(' ')}` : '';
  const outputType = func.outputs.length > 0 ? ` --output "${func.outputs.map(o => o.type).join(',')}"` : '';
  const blockFlag = isReadFunction && blockNumber && blockNumber.trim() !== '' ? ` --block ${blockNumber}` : '';
  const valueFlag = func.stateMutability === 'payable' && value && value.trim() !== '' ? ` --value ${value}` : '';
  const chainValue = chainNetwork || 'zksync-sepolia';

  return `${command} --chain "${chainValue}" --contract "${contractAddress}" --method "${signature}"${argsString}${isReadFunction ? outputType : ''}${blockFlag}${valueFlag}`;
}

// State reported by WriteHooksProvider to the parent FunctionCard
interface WriteHookState {
  isConnected: boolean;
  hash: `0x${string}` | undefined;
  isWritePending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
}

const defaultWriteState: WriteHookState = {
  isConnected: false,
  hash: undefined,
  isWritePending: false,
  isConfirming: false,
  isConfirmed: false,
};

// Deferred wagmi hooks — only mounted when a write function card is expanded.
// This avoids calling useWriteContract/useWaitForTransactionReceipt/useAccount
// for every collapsed card, which was the main performance bottleneck during
// contract switching (50 cards × 3 hooks each = ~190ms).
function WriteHooksProvider({
  onStateChange,
  writeContractRef,
  funcName,
}: {
  onStateChange: (state: WriteHookState) => void;
  writeContractRef: React.MutableRefObject<((params: Record<string, unknown>) => void) | null>;
  funcName: string;
}) {
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Expose writeContract to parent via ref
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writeContractRef.current = writeContract as any;
    return () => { writeContractRef.current = null; };
  }, [writeContract, writeContractRef]);

  // Report hook state to parent
  useEffect(() => {
    onStateChange({ isConnected, hash, isWritePending, isConfirming, isConfirmed });
  }, [isConnected, hash, isWritePending, isConfirming, isConfirmed, onStateChange]);

  // Toast: transaction sent
  useEffect(() => {
    if (hash && !isConfirming && !isConfirmed) {
      toaster.info({
        title: 'Transaction sent',
        description: `Transaction ${hash.slice(0, 10)}... has been sent`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  // Toast: transaction confirmed
  useEffect(() => {
    if (isConfirmed && hash) {
      toaster.success({
        title: 'Transaction confirmed',
        description: `${funcName}() executed successfully`,
      });
    }
  }, [isConfirmed, hash, funcName]);

  return null;
}

// Deferred color-mode read — only mounts when there is a result to display,
// avoiding 50 context subscriptions for collapsed cards.
function ResultDisplay({ data }: { data: SerializableValue }) {
  const { colorMode } = useColorMode();
  return (
    <Box layerStyle="codeBlock" width="full" overflowX="auto">
      <Box width="full" css={{ '& > div': { width: '100% !important', maxWidth: '100% !important' } }}>
        <JsonEditor
          data={data}
          setData={() => {}}
          rootName="result"
          restrictEdit={true}
          restrictDelete={true}
          restrictAdd={true}
          theme={colorMode === 'dark' ? githubDarkTheme : githubLightTheme}
        />
      </Box>
    </Box>
  );
}

export default function FunctionCard({
  func,
  contractAddress,
  contractAbi,
  chain
}: FunctionCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCommandsModalOpen, setIsCommandsModalOpen] = useState<boolean>(false);
  const [blockNumber, setBlockNumber] = useState<string>('');
  const [value, setValue] = useState<string>('');

  // Write hook state — deferred to WriteHooksProvider (only mounts when expanded)
  const [writeState, setWriteState] = useState<WriteHookState>(defaultWriteState);

  // Reset state when the function changes (e.g., contract switch with index-based keys).
  // This is React's "adjusting state when a prop changes" pattern — setState during render
  // causes React to restart the render with the updated state, no extra commit.
  const [prevFuncSig, setPrevFuncSig] = useState(() => generateFunctionSignature(func));
  const currentFuncSig = generateFunctionSignature(func);
  if (currentFuncSig !== prevFuncSig) {
    setPrevFuncSig(currentFuncSig);
    setIsExpanded(false);
    setArgs({});
    setValidationErrors({});
    setTouchedFields({});
    setResult(null);
    setLoading(false);
    setError(null);
    setIsCommandsModalOpen(false);
    setBlockNumber('');
    setValue('');
    setWriteState(defaultWriteState);
  }
  const writeContractRef = useRef<((params: Record<string, unknown>) => void) | null>(null);

  const isReadFunction = func.stateMutability === 'view' || func.stateMutability === 'pure';

  // Check if all required inputs are filled and valid
  const isFormReady = (): boolean => {
    // If no inputs, form is ready
    if (func.inputs.length === 0) {
      return true;
    }

    // Check if all inputs have values
    const allInputsFilled = func.inputs.every(input => {
      const value = args[input.name];
      return value && value.trim() !== '';
    });

    if (!allInputsFilled) {
      return false;
    }

    // Check if there are any validation errors
    const hasValidationErrors = Object.keys(validationErrors).length > 0;
    return !hasValidationErrors;
  };

  // Validate all inputs and mark them as touched
  const validateAllInputs = (): boolean => {
    let hasErrors = false;
    const newErrors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};

    func.inputs.forEach(input => {
      newTouched[input.name] = true;
      const value = args[input.name] || '';
      const validation = validateSolidityType(value, input.type);

      if (!validation.isValid && validation.error) {
        newErrors[input.name] = validation.error;
        hasErrors = true;
      }
    });

    setTouchedFields(newTouched);
    setValidationErrors(newErrors);
    return hasErrors;
  };

  const handleArgChange = (paramName: string, value: string, type: string) => {
    setArgs(prev => ({ ...prev, [paramName]: value }));

    // Validate the input
    if (value.trim() === '') {
      // Clear validation error for empty fields (they'll be caught at submission)
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[paramName];
        return newErrors;
      });
    } else {
      const validation = validateSolidityType(value, type);
      if (!validation.isValid && validation.error) {
        setValidationErrors(prev => ({ ...prev, [paramName]: validation.error! }));
      } else {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[paramName];
          return newErrors;
        });
      }
    }
  };

  const handleInputBlur = (paramName: string) => {
    setTouchedFields(prev => ({ ...prev, [paramName]: true }));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      callFunction();
    }
  };

  // Convert args to array in correct order
  const getArgsArrayForCall = (): unknown[] => {
    return getArgsArray(func.inputs, args);
  };

  const callReadFunction = async () => {
    // Validate all inputs before calling
    const hasErrors = validateAllInputs();
    if (hasErrors) {
      toaster.error({
        title: 'Invalid inputs',
        description: 'Please fix the errors in the form',
      });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const client = createPublicClient({
        chain,
        transport: http(),
      });

      const argsArray = getArgsArrayForCall();

      interface ReadContractParams {
        address: `0x${string}`;
        abi: ContractAbi;
        functionName: string;
        args: unknown[];
        blockNumber?: bigint;
      }

      const readParams: ReadContractParams = {
        address: contractAddress as `0x${string}`,
        abi: contractAbi,
        functionName: func.name,
        args: argsArray,
      };

      // Add block number if specified
      if (blockNumber && blockNumber.trim() !== '') {
        readParams.blockNumber = BigInt(blockNumber);
      }

      const data = await client.readContract(readParams);

      setResult(data);
      toaster.success({
        title: 'Function executed successfully',
        description: `${func.name}() completed`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to call function';
      setError(errorMessage);
      toaster.error({
        title: 'Function execution failed',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const callWriteFunction = useCallback(async () => {
    if (!writeState.isConnected) {
      const errorMessage = 'Please connect your wallet first';
      setError(errorMessage);
      toaster.error({
        title: 'Wallet not connected',
        description: errorMessage,
      });
      return;
    }

    // Validate all inputs before calling
    const hasErrors = validateAllInputs();
    if (hasErrors) {
      toaster.error({
        title: 'Invalid inputs',
        description: 'Please fix the errors in the form',
      });
      return;
    }

    setError(null);
    setResult(null);

    try {
      const argsArray = getArgsArrayForCall();

      interface WriteContractParams {
        address: `0x${string}`;
        abi: ContractAbi;
        functionName: string;
        args: unknown[];
        value?: bigint;
      }

      const writeParams: WriteContractParams = {
        address: contractAddress as `0x${string}`,
        abi: contractAbi,
        functionName: func.name,
        args: argsArray,
      };

      // Add value if specified for payable functions
      if (func.stateMutability === 'payable' && value && value.trim() !== '') {
        writeParams.value = BigInt(value);
      }

      writeContractRef.current?.(writeParams as unknown as Record<string, unknown>);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send transaction';
      setError(errorMessage);
      toaster.error({
        title: 'Transaction failed',
        description: errorMessage,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writeState.isConnected, func, args, contractAddress, contractAbi, value]);

  const callFunction = isReadFunction ? callReadFunction : callWriteFunction;

  const getStateMutabilityColorScheme = () => {
    switch (func.stateMutability) {
      case 'view': return 'blue';
      case 'pure': return 'purple';
      case 'payable': return 'green';
      default: return 'orange';
    }
  };

  const handleToggle = () => setIsExpanded(!isExpanded);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  const copyCommand = async (type: 'foundry' | 'zksync') => {
    const rpcUrl: string | undefined = chain.rpcUrls?.default?.http?.[0] || chain.rpcUrls?.public?.http?.[0];
    const chainNetwork: string | undefined = 'network' in chain ? (chain.network as string) : undefined;
    const command = type === 'foundry'
      ? generateFoundryCommand(func, contractAddress, args, rpcUrl, blockNumber, value)
      : generateZksyncCommand(func, contractAddress, args, chainNetwork, blockNumber, value);

    try {
      await navigator.clipboard.writeText(command);
      toaster.success({
        title: 'Command copied',
        description: `${type === 'foundry' ? 'Foundry' : 'ZKsync CLI'} command copied to clipboard`,
      });
    } catch {
      toaster.error({
        title: 'Failed to copy',
        description: 'Could not copy command to clipboard',
      });
    }
  };

  return (
    <Box layerStyle="card" mb={4}>
      {/* Deferred write hooks — only mount when a write card is expanded */}
      {isExpanded && !isReadFunction && (
        <WriteHooksProvider
          onStateChange={setWriteState}
          writeContractRef={writeContractRef}
          funcName={func.name}
        />
      )}

      {/* Header */}
      <HStack
        as="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        layerStyle="collapsibleHeader"
        width="full"
        textAlign="left"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${func.name} function - ${func.stateMutability}`}
        gap={2}
      >
        <Text fontSize="xl">{isExpanded ? '▼' : '▶'}</Text>
        <Box flex={1}>
          <Text fontWeight="bold" fontFamily="mono" display="inline">
            {func.name}
          </Text>
          <Text fontFamily="mono" color="fg.muted" fontSize="sm" display="inline">
            ({func.inputs.map(i => `${i.type} ${i.name}`).join(', ')})
            {func.outputs.length > 0 && (
              <> → ({func.outputs.map(o => o.type).join(', ')})</>
            )}
          </Text>
        </Box>
        <Badge colorScheme={getStateMutabilityColorScheme()} textTransform="uppercase">
          {func.stateMutability}
        </Badge>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setIsCommandsModalOpen(true);
          }}
          variant="ghost"
          size="sm"
        >
          CLI commands
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            if (!isExpanded) {
              setIsExpanded(true);
            }
            callFunction();
          }}
          loading={isReadFunction ? loading : (writeState.isWritePending || writeState.isConfirming)}
          loadingText={
            isReadFunction
              ? "Calling..."
              : writeState.isWritePending
              ? "Sending..."
              : "Confirming..."
          }
          colorScheme={getStateMutabilityColorScheme()}
          size="sm"
          disabled={!isFormReady() || (!isReadFunction && !writeState.isConnected)}
        >
          {isReadFunction ? 'Execute' : 'Send'}
        </Button>
      </HStack>

      {/* Expandable Content — plain conditional render (no Collapsible wrapper overhead) */}
      {isExpanded && <Box layerStyle="cardSection">
        {/* Two-column layout for Parameters and Block Number/Value */}
        <Grid
          templateColumns={isReadFunction || func.stateMutability === 'payable' ? "1fr 300px" : "1fr"}
          gap={6}
          alignItems="start"
        >
          {/* Input Fields */}
          {func.inputs.length > 0 && (
            <VStack gap={3} align="stretch">
              <Text fontWeight="bold">Parameters:</Text>
              {func.inputs.map((input, idx) => {
                const hasError = touchedFields[input.name] && validationErrors[input.name];
                return (
                  <Field.Root key={idx} invalid={!!hasError}>
                    <Grid templateColumns="200px 1fr" gap={3} alignItems="start">
                      <Field.Label textStyle="label" pt={2}>
                        <Text as="span" fontWeight="medium">{input.name}</Text>
                        <Text as="span" ml={2} color="fg.muted" textStyle="monoCode">
                          ({input.type})
                        </Text>
                      </Field.Label>
                      <Box>
                        {input.type === 'address' ? (
                          <AddressInput
                            value={args[input.name] || ''}
                            onChange={(e) => handleArgChange(input.name, e.target.value, input.type)}
                            onBlur={() => handleInputBlur(input.name)}
                            onKeyDown={handleInputKeyDown}
                            placeholder={getPlaceholderForType(input.type)}
                          />
                        ) : (
                          <Input
                            value={args[input.name] || ''}
                            onChange={(e) => handleArgChange(input.name, e.target.value, input.type)}
                            onBlur={() => handleInputBlur(input.name)}
                            onKeyDown={handleInputKeyDown}
                            placeholder={getPlaceholderForType(input.type)}
                            textStyle="mono"
                          />
                        )}
                        {hasError && (
                          <Field.ErrorText textStyle="helperText" mt={1}>
                            {validationErrors[input.name]}
                          </Field.ErrorText>
                        )}
                      </Box>
                    </Grid>
                  </Field.Root>
                );
              })}
            </VStack>
          )}

          {/* Block Number Input (for read functions) */}
          {isReadFunction && (
            <VStack gap={3} align="stretch">
              <Text fontWeight="bold">Block Number:</Text>
              <Field.Root>
                <VStack gap={2} align="stretch">
                  <Input
                    value={blockNumber}
                    onChange={(e) => setBlockNumber(e.target.value)}
                    placeholder="Latest block"
                    textStyle="mono"
                    type="number"
                  />
                  <Text fontSize="xs" color="fg.muted">
                    Leave empty for latest block
                  </Text>
                </VStack>
              </Field.Root>
            </VStack>
          )}

          {/* Value Input (for payable functions) */}
          {func.stateMutability === 'payable' && (
            <VStack gap={3} align="stretch">
              <Text fontWeight="bold">Value (wei):</Text>
              <Field.Root>
                <VStack gap={2} align="stretch">
                  <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                    textStyle="mono"
                    type="number"
                  />
                  <Text fontSize="xs" color="fg.muted">
                    Amount of wei to send with transaction
                  </Text>
                </VStack>
              </Field.Root>
            </VStack>
          )}
        </Grid>

        {/* Loading Skeleton for Read Functions */}
        {loading && isReadFunction && (
          <Box borderRadius="md" p={4} bg="bg.muted" mb={4}>
            <Text fontWeight="bold" mb={2}>Result:</Text>
            <VStack gap={2} align="stretch">
              <Skeleton height="20px" />
              <Skeleton height="20px" />
              <Skeleton height="20px" width="80%" />
            </VStack>
          </Box>
        )}

        {/* Write Function Status */}
        {!isReadFunction && writeState.hash && (
          <Alert.Root status={writeState.isConfirmed ? "success" : "info"} borderRadius="md" mb={4}>
            <Alert.Indicator />
            <Box width="full">
              <Text fontWeight="bold" mb={1}>
                {writeState.isConfirming ? 'Transaction Pending' : writeState.isConfirmed ? 'Transaction Confirmed' : 'Transaction Sent'}
              </Text>
              <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                {writeState.hash}
              </Code>
            </Box>
          </Alert.Root>
        )}

        {/* Error Display */}
        {error && (
          <Alert.Root status="error" borderRadius="md" mb={4}>
            <Alert.Indicator />
            <Alert.Title textStyle="label">{error}</Alert.Title>
          </Alert.Root>
        )}

        {/* Result Display (for read functions) */}
        {result !== null && isReadFunction && (
          <ResultDisplay data={serializeBigInts(result)} />
        )}
      </Box>}

      {/* Commands Modal — only mount when open to avoid 50 Portals */}
      {isCommandsModalOpen && <Dialog.Root open={isCommandsModalOpen} onOpenChange={(e) => setIsCommandsModalOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="4xl">
              <Dialog.Header>
                <Dialog.Title>CLI Commands</Dialog.Title>
              </Dialog.Header>
              <Dialog.CloseTrigger />
              <Dialog.Body>
                <VStack gap={4} align="stretch">
                  {/* Foundry Command */}
                  <Box>
                    <Text fontWeight="bold" mb={2}>Foundry Cast Command</Text>
                    <HStack gap={2} align="start">
                      <Code
                        layerStyle="codeBlock"
                        flex="1"
                        display="block"
                        whiteSpace="pre-wrap"
                        wordBreak="break-all"
                        p={3}
                      >
                        {generateFoundryCommand(func, contractAddress, args, chain.rpcUrls?.default?.http?.[0] || chain.rpcUrls?.public?.http?.[0], blockNumber, value)}
                      </Code>
                      <IconButton
                        aria-label="Copy Foundry command"
                        onClick={() => copyCommand('foundry')}
                        size="sm"
                        variant="ghost"
                      >
                        <LuCopy />
                      </IconButton>
                    </HStack>
                  </Box>

                  {/* ZKsync Command */}
                  <Box>
                    <Text fontWeight="bold" mb={2}>ZKsync CLI Command</Text>
                    <HStack gap={2} align="start">
                      <Code
                        layerStyle="codeBlock"
                        flex="1"
                        display="block"
                        whiteSpace="pre-wrap"
                        wordBreak="break-all"
                        p={3}
                      >
                        {generateZksyncCommand(func, contractAddress, args, ('network' in chain ? (chain.network as string) : undefined), blockNumber, value)}
                      </Code>
                      <IconButton
                        aria-label="Copy ZKsync command"
                        onClick={() => copyCommand('zksync')}
                        size="sm"
                        variant="ghost"
                      >
                        <LuCopy />
                      </IconButton>
                    </HStack>
                  </Box>
                </VStack>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>}
    </Box>
  );
}
