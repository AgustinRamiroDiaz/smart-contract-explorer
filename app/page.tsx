'use client';

import { useState } from 'react';
import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';

// Define GenLayer Testnet
const genlayerTestnet = defineChain({
  id: 123420000220,
  name: 'GenLayer Testnet',
  network: 'genlayer-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'GenLayer',
    symbol: 'GEN',
  },
  rpcUrls: {
    default: {
      http: ['https://genlayer-testnet.rpc.caldera.xyz/http'],
    },
    public: {
      http: ['https://genlayer-testnet.rpc.caldera.xyz/http'],
    },
  },
});

export default function Page() {
  const [contractAddress, setContractAddress] = useState('');
  const [owner, setOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readOwner = async () => {
    if (!contractAddress) {
      setError('Please enter a contract address');
      return;
    }

    setLoading(true);
    setError(null);
    setOwner(null);

    try {
      const client = createPublicClient({
        chain: genlayerTestnet,
        transport: http(),
      });

      const data = await client.readContract({
        address: contractAddress as `0x${string}`,
        abi: [
          {
            name: 'owner',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'address' }],
          },
        ],
        functionName: 'owner',
      });

      setOwner(data as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read owner');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>GenLayer Contract Explorer</h1>

      <div style={{ marginTop: '2rem' }}>
        <label htmlFor="address" style={{ display: 'block', marginBottom: '0.5rem' }}>
          Contract Address:
        </label>
        <input
          id="address"
          type="text"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
          placeholder="0x..."
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '1rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      <button
        onClick={readOwner}
        disabled={loading}
        style={{
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Reading...' : 'Read Owner'}
      </button>

      {error && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00' }}>
          {error}
        </div>
      )}

      {owner && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#efe', border: '1px solid #cfc', borderRadius: '4px' }}>
          <strong>Owner:</strong> {owner}
        </div>
      )}
    </div>
  );
}
