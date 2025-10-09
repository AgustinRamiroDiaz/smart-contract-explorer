'use client';

import { useState } from 'react';
import { createPublicClient, http } from 'viem';
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

  const handleArgChange = (paramName: string, value: string) => {
    setArgs(prev => ({ ...prev, [paramName]: value }));
  };

  const callFunction = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const client = createPublicClient({
        chain,
        transport: http(),
      });

      // Convert args to array in correct order
      const argsArray = func.inputs.map(input => {
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

      const data = await client.readContract({
        address: contractAddress as `0x${string}`,
        abi: contractAbi,
        functionName: func.name,
        args: argsArray,
      });

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to call function');
    } finally {
      setLoading(false);
    }
  };

  const getStateMutabilityColorScheme = () => {
    switch (func.stateMutability) {
      case 'view': return 'blue';
      case 'pure': return 'purple';
      default: return 'gray';
    }
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden" mb={4}>
      {/* Header */}
      <HStack
        onClick={() => setIsExpanded(!isExpanded)}
        p={4}
        bg="gray.50"
        cursor="pointer"
        userSelect="none"
        _hover={{ bg: 'gray.100' }}
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
        <Box p={4} bg="white">
          {/* Function Signature */}
          <Code
            display="block"
            p={2}
            mb={4}
            bg="gray.50"
            borderRadius="md"
            fontSize="sm"
            whiteSpace="pre-wrap"
          >
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
                  <Field.Label fontSize="sm">
                    <Text as="span" fontWeight="medium">{input.name}</Text>
                    <Text as="span" ml={2} color="gray.600" fontFamily="mono" fontSize="xs">
                      ({input.type})
                    </Text>
                  </Field.Label>
                  <Input
                    value={args[input.name] || ''}
                    onChange={(e) => handleArgChange(input.name, e.target.value)}
                    placeholder={`Enter ${input.type}`}
                    fontFamily="mono"
                    fontSize="sm"
                  />
                </Field.Root>
              ))}
            </VStack>
          )}

          {/* Call Button */}
          <Button
            onClick={callFunction}
            isLoading={loading}
            loadingText="Calling..."
            colorScheme={getStateMutabilityColorScheme()}
            width="full"
            mb={error || result !== null ? 4 : 0}
          >
            Execute
          </Button>

          {/* Error Display */}
          {error && (
            <Alert.Root status="error" borderRadius="md" mb={4}>
              <Alert.Indicator />
              <Alert.Title fontSize="sm">{error}</Alert.Title>
            </Alert.Root>
          )}

          {/* Result Display */}
          {result !== null && (
            <Alert.Root status="success" borderRadius="md">
              <Box width="full">
                <Text fontWeight="bold" mb={2}>Result:</Text>
                <Code
                  display="block"
                  p={2}
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                  fontSize="sm"
                  width="full"
                >
                  {typeof result === 'object'
                    ? JSON.stringify(result, (_key, value) =>
                        typeof value === 'bigint' ? value.toString() : value
                      , 2)
                    : String(result)}
                </Code>
              </Box>
            </Alert.Root>
          )}
        </Box>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
}
