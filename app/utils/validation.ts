/**
 * Validation utilities for Solidity types
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates if a string is a valid Ethereum address
 */
export function isValidAddress(value: string): boolean {
  if (!value) return false;
  // Check if it starts with 0x and has 40 hex characters
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

/**
 * Validates if a string is a valid integer (supports decimal and hex)
 */
export function isValidInteger(value: string, signed: boolean = false): boolean {
  if (!value) return false;

  // Hex format
  if (value.startsWith('0x')) {
    return /^0x[0-9a-fA-F]+$/.test(value);
  }

  // Decimal format
  if (signed) {
    return /^-?\d+$/.test(value);
  }
  return /^\d+$/.test(value);
}

/**
 * Validates if a string is a valid boolean
 */
export function isValidBoolean(value: string): boolean {
  return value === 'true' || value === 'false' || value === '1' || value === '0';
}

/**
 * Validates if a string is a valid bytes value (hex)
 */
export function isValidBytes(value: string): boolean {
  if (!value) return false;
  // Must start with 0x and have even number of hex characters
  return /^0x([0-9a-fA-F]{2})*$/.test(value);
}

/**
 * Validates if a string is a valid fixed-size bytes (e.g., bytes32)
 */
export function isValidFixedBytes(value: string, size: number): boolean {
  if (!value) return false;
  // Must be 0x followed by exactly size*2 hex characters
  const expectedLength = 2 + size * 2; // "0x" + size bytes in hex
  return value.length === expectedLength && /^0x[0-9a-fA-F]+$/.test(value);
}

/**
 * Validates if a string is a valid string value
 */
export function isValidString(value: string): boolean {
  // Any string is valid, but we can check if it's empty
  return value !== undefined && value !== null;
}

/**
 * Main validation function that routes to specific validators based on Solidity type
 */
export function validateSolidityType(value: string, type: string): ValidationResult {
  // Empty value
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'Value is required'
    };
  }

  const normalizedValue = value.trim();

  // Address
  if (type === 'address') {
    if (!isValidAddress(normalizedValue)) {
      return {
        isValid: false,
        error: 'Must be a valid address (0x + 40 hex characters)'
      };
    }
    return { isValid: true };
  }

  // Unsigned integers
  if (type.startsWith('uint')) {
    if (!isValidInteger(normalizedValue, false)) {
      return {
        isValid: false,
        error: 'Must be a positive integer (decimal or 0x hex)'
      };
    }
    // Check bit size if specified
    const match = type.match(/^uint(\d+)$/);
    if (match) {
      const bits = parseInt(match[1]);
      if (normalizedValue.startsWith('0x')) {
        const hexLength = normalizedValue.length - 2;
        const maxHexLength = Math.ceil(bits / 4);
        if (hexLength > maxHexLength) {
          return {
            isValid: false,
            error: `Value exceeds ${bits} bits`
          };
        }
      } else {
        try {
          const bigintValue = BigInt(normalizedValue);
          const maxValue = (BigInt(1) << BigInt(bits)) - BigInt(1);
          if (bigintValue > maxValue || bigintValue < BigInt(0)) {
            return {
              isValid: false,
              error: `Value must be between 0 and 2^${bits}-1`
            };
          }
        } catch {
          return {
            isValid: false,
            error: 'Invalid number format'
          };
        }
      }
    }
    return { isValid: true };
  }

  // Signed integers
  if (type.startsWith('int')) {
    if (!isValidInteger(normalizedValue, true)) {
      return {
        isValid: false,
        error: 'Must be an integer (decimal or 0x hex)'
      };
    }
    // Check bit size if specified
    const match = type.match(/^int(\d+)$/);
    if (match) {
      const bits = parseInt(match[1]);
      if (!normalizedValue.startsWith('0x')) {
        try {
          const bigintValue = BigInt(normalizedValue);
          const maxValue = (BigInt(1) << BigInt(bits - 1)) - BigInt(1);
          const minValue = -(BigInt(1) << BigInt(bits - 1));
          if (bigintValue > maxValue || bigintValue < minValue) {
            return {
              isValid: false,
              error: `Value must be between -2^${bits-1} and 2^${bits-1}-1`
            };
          }
        } catch {
          return {
            isValid: false,
            error: 'Invalid number format'
          };
        }
      }
    }
    return { isValid: true };
  }

  // Boolean
  if (type === 'bool') {
    if (!isValidBoolean(normalizedValue)) {
      return {
        isValid: false,
        error: 'Must be true, false, 1, or 0'
      };
    }
    return { isValid: true };
  }

  // Fixed-size bytes (bytes1, bytes2, ..., bytes32)
  const fixedBytesMatch = type.match(/^bytes(\d+)$/);
  if (fixedBytesMatch) {
    const size = parseInt(fixedBytesMatch[1]);
    if (size < 1 || size > 32) {
      return {
        isValid: false,
        error: `Invalid bytes size: ${size}`
      };
    }
    if (!isValidFixedBytes(normalizedValue, size)) {
      return {
        isValid: false,
        error: `Must be 0x followed by ${size * 2} hex characters`
      };
    }
    return { isValid: true };
  }

  // Dynamic bytes
  if (type === 'bytes') {
    if (!isValidBytes(normalizedValue)) {
      return {
        isValid: false,
        error: 'Must be valid hex bytes (0x + even hex characters)'
      };
    }
    return { isValid: true };
  }

  // String
  if (type === 'string') {
    if (!isValidString(normalizedValue)) {
      return {
        isValid: false,
        error: 'Invalid string value'
      };
    }
    return { isValid: true };
  }

  // Arrays (basic check)
  if (type.endsWith('[]')) {
    // Could be more sophisticated, but for now we'll allow it
    // and let the contract call fail if it's wrong
    return { isValid: true };
  }

  // Tuples and other complex types - allow for now
  if (type.startsWith('(') || type.includes('tuple')) {
    return { isValid: true };
  }

  // Unknown type - allow but warn
  console.warn(`Unknown Solidity type: ${type}`);
  return { isValid: true };
}

/**
 * Get a placeholder hint for a given Solidity type
 */
export function getPlaceholderForType(type: string): string {
  if (type === 'address') {
    return '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  }
  if (type.startsWith('uint')) {
    return '123 or 0x7b';
  }
  if (type.startsWith('int')) {
    return '-123 or 123 or 0x7b';
  }
  if (type === 'bool') {
    return 'true or false';
  }
  if (type.startsWith('bytes')) {
    const match = type.match(/^bytes(\d+)$/);
    if (match) {
      const size = parseInt(match[1]);
      return `0x${'00'.repeat(size)}`;
    }
    return '0x1234abcd';
  }
  if (type === 'string') {
    return 'Enter text';
  }
  if (type.endsWith('[]')) {
    return 'Array (JSON format)';
  }
  return `Enter ${type}`;
}
