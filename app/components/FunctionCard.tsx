'use client';

import { useState, useEffect } from 'react';
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
  Collapsible,
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
import AddressInput from './AddressInput';
import { LuCopy } from 'react-icons/lu';

type AbiInput = {
  name: string;
  type: string;
  internalType?: string;
};

type AbiOutput = {
  name: string;
  type: string;
  internalType?: string;
};

type AbiFunction = {
  name: string;
  type: string;
  stateMutability: string;
  inputs: AbiInput[];
  outputs: AbiOutput[];
};

interface FunctionCardProps {
  func: AbiFunction;
  contractAddress: string;
  contractAbi: any[];
  chain: any;
}

// Utility function to convert BigInts to strings for JSON display
function serializeBigInts(obj: any): any {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, serializeBigInts(value)])
    );
  }
  return obj;
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
  rpcUrl: string = '$RPC_URL',
  blockNumber?: string,
  value?: string
): string {
  const isReadFunction = func.stateMutability === 'view' || func.stateMutability === 'pure';
  const command = isReadFunction ? 'cast call' : 'cast send';
  const signature = generateFunctionSignature(func);

  // Get args in order
  const argsArray = func.inputs.map(input => {
    const value = args[input.name] || '';
    // Quote string arguments that contain spaces or are addresses
    if (input.type === 'address' || input.type === 'string' || value.includes(' ')) {
      return `"${value}"`;
    }
    return value || '""';
  });

  const argsString = argsArray.length > 0 ? ' ' + argsArray.join(' ') : '';
  const privateKeyFlag = isReadFunction ? '' : ' --private-key $PRIVATE_KEY';
  const blockFlag = isReadFunction && blockNumber && blockNumber.trim() !== '' ? ` --block ${blockNumber}` : '';
  const valueFlag = func.stateMutability === 'payable' && value && value.trim() !== '' ? ` --value ${value}` : '';

  return `${command} ${contractAddress} "${signature}"${argsString} --rpc-url ${rpcUrl}${privateKeyFlag}${blockFlag}${valueFlag}`;
}

// Generate ZKsync CLI command
function generateZksyncCommand(
  func: AbiFunction,
  contractAddress: string,
  args: Record<string, string>,
  chain: string = 'zksync-sepolia',
  blockNumber?: string,
  value?: string
): string {
  const isReadFunction = func.stateMutability === 'view' || func.stateMutability === 'pure';
  const command = isReadFunction ? 'npx zksync-cli contract read' : 'npx zksync-cli contract write';
  const signature = generateFunctionSignature(func);

  // Get args in order
  const argsArray = func.inputs.map(input => {
    const value = args[input.name] || '';
    return `"${value}"`;
  });

  const argsString = argsArray.length > 0 ? ` --args ${argsArray.join(' ')}` : '';
  const outputType = func.outputs.length > 0 ? ` --output "${func.outputs.map(o => o.type).join(',')}"` : '';
  const blockFlag = isReadFunction && blockNumber && blockNumber.trim() !== '' ? ` --block ${blockNumber}` : '';
  const valueFlag = func.stateMutability === 'payable' && value && value.trim() !== '' ? ` --value ${value}` : '';

  return `${command} --chain "${chain}" --contract "${contractAddress}" --method "${signature}"${argsString}${isReadFunction ? outputType : ''}${blockFlag}${valueFlag}`;
}

export default function FunctionCard({
  func,
  contractAddress,
  contractAbi,
  chain
}: FunctionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCommandsModalOpen, setIsCommandsModalOpen] = useState(false);
  const [blockNumber, setBlockNumber] = useState<string>('');
  const [value, setValue] = useState<string>('');

  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });
  const { colorMode } = useColorMode();

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
  const getArgsArray = () => {
    return func.inputs.map(input => {
      const value = args[input.name] || '';
      // Basic type conversion
      if (input.type.includes('uint') || input.type.includes('int')) {
        return value ? BigInt(value) : BigInt(0);
      }
      if (input.type === 'bool') {
        return value.toLowerCase() === 'true';
      }
      return value;
    });
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

      const argsArray = getArgsArray();

      const readParams: any = {
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

  const callWriteFunction = async () => {
    if (!isConnected) {
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
      const argsArray = getArgsArray();

      const writeParams: any = {
        address: contractAddress as `0x${string}`,
        abi: contractAbi,
        functionName: func.name,
        args: argsArray,
      };

      // Add value if specified for payable functions
      if (func.stateMutability === 'payable' && value && value.trim() !== '') {
        writeParams.value = BigInt(value);
      }

      writeContract(writeParams);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send transaction';
      setError(errorMessage);
      toaster.error({
        title: 'Transaction failed',
        description: errorMessage,
      });
    }
  };

  // Show toast notifications for transaction status changes
  useEffect(() => {
    if (hash && !isConfirming && !isConfirmed) {
      toaster.info({
        title: 'Transaction sent',
        description: `Transaction ${hash.slice(0, 10)}... has been sent`,
      });
    }
  }, [hash]);

  useEffect(() => {
    if (isConfirmed && hash) {
      toaster.success({
        title: 'Transaction confirmed',
        description: `${func.name}() executed successfully`,
      });
    }
  }, [isConfirmed, hash, func.name]);

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
    const rpcUrl = chain.rpcUrls?.default?.http?.[0] || chain.rpcUrls?.public?.http?.[0];
    const command = type === 'foundry'
      ? generateFoundryCommand(func, contractAddress, args, rpcUrl, blockNumber, value)
      : generateZksyncCommand(func, contractAddress, args, chain.network || 'zksync-sepolia', blockNumber, value);

    try {
      await navigator.clipboard.writeText(command);
      toaster.success({
        title: 'Command copied',
        description: `${type === 'foundry' ? 'Foundry' : 'ZKsync CLI'} command copied to clipboard`,
      });
    } catch (err) {
      toaster.error({
        title: 'Failed to copy',
        description: 'Could not copy command to clipboard',
      });
    }
  };

  return (
    <Box layerStyle="card" mb={4}>
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
          loading={isReadFunction ? loading : (isWritePending || isConfirming)}
          loadingText={
            isReadFunction
              ? "Calling..."
              : isWritePending
              ? "Sending..."
              : "Confirming..."
          }
          colorScheme={getStateMutabilityColorScheme()}
          size="sm"
          disabled={!isFormReady() || (!isReadFunction && !isConnected)}
        >
          {isReadFunction ? 'Execute' : 'Send'}
        </Button>
      </HStack>

      {/* Expandable Content */}
      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
        <Box layerStyle="cardSection">
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
          {!isReadFunction && hash && (
            <Alert.Root status={isConfirmed ? "success" : "info"} borderRadius="md" mb={4}>
              <Alert.Indicator />
              <Box width="full">
                <Text fontWeight="bold" mb={1}>
                  {isConfirming ? 'Transaction Pending' : isConfirmed ? 'Transaction Confirmed' : 'Transaction Sent'}
                </Text>
                <Code layerStyle="codeInline" display="block" whiteSpace="pre-wrap" wordBreak="break-all">
                  {hash}
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
            <Box layerStyle="codeBlock" width="full" overflowX="auto">
              <Box width="full" css={{ '& > div': { width: '100% !important', maxWidth: '100% !important' } }}>
                <JsonEditor
                  data={serializeBigInts(result)}
                  setData={() => {}}
                  rootName="result"
                  restrictEdit={true}
                  restrictDelete={true}
                  restrictAdd={true}
                  theme={colorMode === 'dark' ? githubDarkTheme : githubLightTheme}
                />
              </Box>
            </Box>
          )}
        </Box>
        </Collapsible.Content>
      </Collapsible.Root>

      {/* Commands Modal */}
      <Dialog.Root open={isCommandsModalOpen} onOpenChange={(e) => setIsCommandsModalOpen(e.open)}>
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
                        {generateZksyncCommand(func, contractAddress, args, chain.network || 'zksync-sepolia', blockNumber, value)}
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
      </Dialog.Root>
    </Box>
  );
}
