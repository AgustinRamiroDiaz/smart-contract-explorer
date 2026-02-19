import { describe, it, expect } from 'vitest';
import { findBestAbiMatch } from './abiMatcher';

describe('findBestAbiMatch', () => {
  const abis = new Set([
    'IGenLayerStaking',
    'ERC20',
    'GenLayerToken',
    'IGenLayerConsensus',
  ]);

  it('returns null for empty contract name', () => {
    expect(findBestAbiMatch('', abis)).toBeNull();
  });

  it('returns null for empty ABI set', () => {
    expect(findBestAbiMatch('Staking', new Set())).toBeNull();
  });

  it('returns null when no match exists', () => {
    expect(findBestAbiMatch('Nonexistent', abis)).toBeNull();
  });

  it('matches exactly (score 1)', () => {
    const result = findBestAbiMatch('ERC20', abis);
    expect(result).toEqual({ abiName: 'ERC20', score: 1 });
  });

  it('matches case-insensitively (score 2)', () => {
    const result = findBestAbiMatch('erc20', abis);
    expect(result).toEqual({ abiName: 'ERC20', score: 2 });
  });

  it('matches as suffix (score 3)', () => {
    const result = findBestAbiMatch('Staking', abis);
    expect(result).toEqual({ abiName: 'IGenLayerStaking', score: 3 });
  });

  it('matches suffix case-insensitively', () => {
    const result = findBestAbiMatch('staking', abis);
    expect(result).toEqual({ abiName: 'IGenLayerStaking', score: 3 });
  });

  it('matches as substring (score 4)', () => {
    const result = findBestAbiMatch('GenLayer', abis);
    // Multiple matches — shortest ABI name wins the tie-break
    expect(result).not.toBeNull();
    expect(result!.score).toBe(4);
    expect(result!.abiName).toBe('GenLayerToken');
  });

  it('prefers exact over case-insensitive', () => {
    const names = new Set(['erc20', 'ERC20']);
    const result = findBestAbiMatch('ERC20', names);
    expect(result).toEqual({ abiName: 'ERC20', score: 1 });
  });

  it('prefers case-insensitive over suffix', () => {
    const names = new Set(['IGenLayerStaking', 'Staking']);
    const result = findBestAbiMatch('staking', names);
    expect(result).toEqual({ abiName: 'Staking', score: 2 });
  });

  it('prefers suffix over substring', () => {
    const names = new Set(['XStaking', 'StakingManager']);
    const result = findBestAbiMatch('Staking', names);
    // 'XStaking' ends with 'Staking' (suffix, score 3)
    // 'StakingManager' contains 'Staking' (substring, score 4)
    expect(result).toEqual({ abiName: 'XStaking', score: 3 });
  });

  it('tie-breaks by shorter ABI name', () => {
    const names = new Set(['ABCToken', 'ABCTokenLong']);
    const result = findBestAbiMatch('Token', names);
    // Both are suffix matches (score 3), shorter name wins
    expect(result).toEqual({ abiName: 'ABCToken', score: 3 });
  });

  it('accepts an array as well as a Set', () => {
    const result = findBestAbiMatch('ERC20', ['ERC20', 'GenLayerToken']);
    expect(result).toEqual({ abiName: 'ERC20', score: 1 });
  });
});
