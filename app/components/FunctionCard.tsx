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
} from '@chakra-ui/react';
import { JsonEditor } from 'json-edit-react';
import { toaster } from '@/components/ui/toaster';

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

export default function FunctionCard({
  func,
  contractAddress,
  contractAbi,
  chain
}: FunctionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const isReadFunction = func.stateMutability === 'view' || func.stateMutability === 'pure';

  const handleArgChange = (paramName: string, value: string) => {
    setArgs(prev => ({ ...prev, [paramName]: value }));
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
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const client = createPublicClient({
        chain,
        transport: http(),
      });

      const argsArray = getArgsArray();

      const data = await client.readContract({
        address: contractAddress as `0x${string}`,
        abi: contractAbi,
        functionName: func.name,
        args: argsArray,
      });

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

    setError(null);
    setResult(null);

    try {
      const argsArray = getArgsArray();

      writeContract({
        address: contractAddress as `0x${string}`,
        abi: contractAbi,
        functionName: func.name,
        args: argsArray,
      });
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
      >
        <Text fontSize="xl">{isExpanded ? '▼' : '▶'}</Text>
        <Text fontWeight="bold" fontFamily="mono" flex={1}>
          {func.name}
        </Text>
        <Badge colorScheme={getStateMutabilityColorScheme()} textTransform="uppercase">
          {func.stateMutability}
        </Badge>
      </HStack>

      {/* Expandable Content */}
      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
        <Box layerStyle="cardSection">
          {/* Function Signature */}
          <Code layerStyle="codeBlock" mb={4}>
            {func.name}({func.inputs.map(i => `${i.type} ${i.name}`).join(', ')})
            {func.outputs.length > 0 && (
              <> → ({func.outputs.map(o => o.type).join(', ')})</>
            )}
          </Code>

          {/* Input Fields */}
          {func.inputs.length > 0 && (
            <VStack gap={3} mb={4} align="stretch">
              <Text fontWeight="bold">Parameters:</Text>
              {func.inputs.map((input, idx) => (
                <Field.Root key={idx}>
                  <Field.Label textStyle="label">
                    <Text as="span" fontWeight="medium">{input.name}</Text>
                    <Text as="span" ml={2} color="fg.muted" textStyle="monoCode">
                      ({input.type})
                    </Text>
                  </Field.Label>
                  <Input
                    value={args[input.name] || ''}
                    onChange={(e) => handleArgChange(input.name, e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder={`Enter ${input.type}`}
                    textStyle="mono"
                  />
                </Field.Root>
              ))}
            </VStack>
          )}

          {/* Call Button */}
          <Button
            onClick={callFunction}
            loading={isReadFunction ? loading : (isWritePending || isConfirming)}
            loadingText={
              isReadFunction
                ? "Calling..."
                : isWritePending
                ? "Sending transaction..."
                : "Confirming..."
            }
            colorScheme={getStateMutabilityColorScheme()}
            width="full"
            mb={error || result !== null || hash ? 4 : 0}
            disabled={!isReadFunction && !isConnected}
          >
            {isReadFunction ? 'Execute' : isConnected ? 'Send Transaction' : 'Connect Wallet to Execute'}
          </Button>

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
            <Alert.Root status="success" borderRadius="md">
              <Box width="full">
                <Text fontWeight="bold" mb={2}>Result:</Text>
                <Box layerStyle="codeBlock" width="full" overflowX="auto">
                  {typeof result === 'object' ? (
                    <JsonEditor
                      data={serializeBigInts(result)}
                      setData={() => {}}
                      rootName="result"
                      restrictEdit={true}
                      restrictDelete={true}
                      restrictAdd={true}
                    />
                  ) : (
                    <Code>{String(result)}</Code>
                  )}
                </Box>
              </Box>
            </Alert.Root>
          )}
        </Box>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
}
