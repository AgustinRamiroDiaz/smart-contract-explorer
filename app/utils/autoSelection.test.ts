import { describe, it, expect } from 'vitest';
import { getAutoSelectedNetwork, getAutoSelectedDeployment } from './autoSelection';
import type { DeploymentsFile } from '../types';

describe('getAutoSelectedNetwork', () => {
  it('returns null for empty deployments', () => {
    expect(getAutoSelectedNetwork({})).toBeNull();
  });

  it('returns the network when exactly one exists', () => {
    const data: DeploymentsFile = {
      testnet: { v1: { Token: '0x123' } },
    };
    expect(getAutoSelectedNetwork(data)).toBe('testnet');
  });

  it('returns null when multiple networks exist', () => {
    const data: DeploymentsFile = {
      testnet: { v1: { Token: '0x123' } },
      mainnet: { v1: { Token: '0x456' } },
    };
    expect(getAutoSelectedNetwork(data)).toBeNull();
  });
});

describe('getAutoSelectedDeployment', () => {
  const data: DeploymentsFile = {
    testnet: { v1: { Token: '0x123' } },
    mainnet: {
      v1: { Token: '0x123' },
      v2: { Token: '0x456' },
    },
  };

  it('returns null for empty network string', () => {
    expect(getAutoSelectedDeployment(data, '')).toBeNull();
  });

  it('returns null for nonexistent network', () => {
    expect(getAutoSelectedDeployment(data, 'devnet')).toBeNull();
  });

  it('returns the deployment when exactly one exists', () => {
    expect(getAutoSelectedDeployment(data, 'testnet')).toBe('v1');
  });

  it('returns null when multiple deployments exist', () => {
    expect(getAutoSelectedDeployment(data, 'mainnet')).toBeNull();
  });
});
