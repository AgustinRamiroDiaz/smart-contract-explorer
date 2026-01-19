import { describe, it, expect } from 'vitest';
import { parseArgumentValue, getArgsArray } from './argumentParser';
import type { AbiParameter } from '../types';

describe('parseArgumentValue', () => {
  describe('basic types', () => {
    it('should parse uint256 to BigInt', () => {
      expect(parseArgumentValue('123', 'uint256')).toBe(BigInt(123));
    });

    it('should parse int256 to BigInt', () => {
      expect(parseArgumentValue('-123', 'int256')).toBe(BigInt(-123));
    });

    it('should parse bool true', () => {
      expect(parseArgumentValue('true', 'bool')).toBe(true);
    });

    it('should parse bool false', () => {
      expect(parseArgumentValue('false', 'bool')).toBe(false);
    });

    it('should parse address as string', () => {
      const addr = '0x1234567890123456789012345678901234567890';
      expect(parseArgumentValue(addr, 'address')).toBe(addr);
    });

    it('should parse bytes32 as string', () => {
      const bytes = '0x1234567890123456789012345678901234567890123456789012345678901234';
      expect(parseArgumentValue(bytes, 'bytes32')).toBe(bytes);
    });
  });

  describe('array types', () => {
    it('should parse bytes32[] as an array of hex strings', () => {
      const input = '["0x1234567890123456789012345678901234567890123456789012345678901234", "0xabcdef0000000000000000000000000000000000000000000000000000000000"]';
      const result = parseArgumentValue(input, 'bytes32[]');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect((result as string[])[0]).toBe('0x1234567890123456789012345678901234567890123456789012345678901234');
      expect((result as string[])[1]).toBe('0xabcdef0000000000000000000000000000000000000000000000000000000000');
    });

    it('should parse address[] as an array of addresses', () => {
      const input = '["0x1234567890123456789012345678901234567890", "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"]';
      const result = parseArgumentValue(input, 'address[]');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should parse uint256[] as an array of BigInts', () => {
      const input = '[100, 200, 300]';
      const result = parseArgumentValue(input, 'uint256[]');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect((result as bigint[])[0]).toBe(BigInt(100));
      expect((result as bigint[])[1]).toBe(BigInt(200));
      expect((result as bigint[])[2]).toBe(BigInt(300));
    });

    it('should parse bool[] as an array of booleans', () => {
      const input = '[true, false, true]';
      const result = parseArgumentValue(input, 'bool[]');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([true, false, true]);
    });

    it('should parse string[] as an array of strings', () => {
      const input = '["hello", "world"]';
      const result = parseArgumentValue(input, 'string[]');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(['hello', 'world']);
    });

    it('should handle empty arrays', () => {
      const result = parseArgumentValue('[]', 'bytes32[]');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });
});

describe('getArgsArray', () => {
  it('should convert args object to ordered array', () => {
    const inputs: AbiParameter[] = [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ];
    const args = {
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000',
    };

    const result = getArgsArray(inputs, args);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe('0x1234567890123456789012345678901234567890');
    expect(result[1]).toBe(BigInt(1000));
  });

  it('should handle bytes32[] parameter', () => {
    const inputs: AbiParameter[] = [
      { name: 'proofs', type: 'bytes32[]' },
    ];
    const args = {
      proofs: '["0x1234567890123456789012345678901234567890123456789012345678901234"]',
    };

    const result = getArgsArray(inputs, args);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0])).toBe(true);
  });
});
