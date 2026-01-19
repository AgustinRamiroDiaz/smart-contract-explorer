import type { AbiParameter } from '../types';

/**
 * Parse a single element value based on the Solidity base type.
 * This handles non-array types.
 */
function parseElementValue(value: unknown, baseType: string): unknown {
  if (baseType.includes('uint') || baseType.includes('int')) {
    if (typeof value === 'number' || typeof value === 'string') {
      return BigInt(value);
    }
    return BigInt(0);
  }
  if (baseType === 'bool') {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return false;
  }
  return value;
}

/**
 * Parse a single argument value from string input to the appropriate type
 * based on the Solidity type.
 */
export function parseArgumentValue(value: string, type: string): unknown {
  // Handle array types
  if (type.endsWith('[]')) {
    const baseType = type.slice(0, -2);
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return value;
      }
      return parsed.map(element => parseElementValue(element, baseType));
    } catch {
      // If JSON parsing fails, return the original value
      return value;
    }
  }

  // Basic type conversion for non-array types
  if (type.includes('uint') || type.includes('int')) {
    return value ? BigInt(value) : BigInt(0);
  }
  if (type === 'bool') {
    return value.toLowerCase() === 'true';
  }
  return value;
}

/**
 * Convert a record of argument values to an ordered array based on ABI inputs.
 */
export function getArgsArray(
  inputs: AbiParameter[],
  args: Record<string, string>
): unknown[] {
  return inputs.map(input => {
    const argValue = args[input.name] || '';
    return parseArgumentValue(argValue, input.type);
  });
}
