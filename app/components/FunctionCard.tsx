'use client';

import { useState } from 'react';
import { createPublicClient, http } from 'viem';

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

  const getStateMutabilityColor = () => {
    switch (func.stateMutability) {
      case 'view': return '#0070f3';
      case 'pure': return '#7928ca';
      default: return '#666';
    }
  };

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      marginBottom: '1rem',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '1rem',
          backgroundColor: '#f5f5f5',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          userSelect: 'none'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>{isExpanded ? '▼' : '▶'}</span>
        <span style={{
          fontWeight: 'bold',
          fontFamily: 'monospace',
          flex: 1
        }}>
          {func.name}
        </span>
        <span style={{
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          backgroundColor: getStateMutabilityColor(),
          color: 'white',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          textTransform: 'uppercase'
        }}>
          {func.stateMutability}
        </span>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div style={{ padding: '1rem', backgroundColor: 'white' }}>
          {/* Function Signature */}
          <div style={{
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            color: '#666',
            marginBottom: '1rem',
            padding: '0.5rem',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px'
          }}>
            {func.name}({func.inputs.map(i => `${i.type} ${i.name}`).join(', ')})
            {func.outputs.length > 0 && (
              <> → ({func.outputs.map(o => o.type).join(', ')})</>
            )}
          </div>

          {/* Input Fields */}
          {func.inputs.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Parameters:</div>
              {func.inputs.map((input, idx) => (
                <div key={idx} style={{ marginBottom: '0.75rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    marginBottom: '0.25rem',
                    color: '#333'
                  }}>
                    <span style={{ fontWeight: '500' }}>{input.name}</span>
                    <span style={{
                      marginLeft: '0.5rem',
                      color: '#666',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem'
                    }}>
                      ({input.type})
                    </span>
                  </label>
                  <input
                    type="text"
                    value={args[input.name] || ''}
                    onChange={(e) => handleArgChange(input.name, e.target.value)}
                    placeholder={`Enter ${input.type}`}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Call Button */}
          <button
            onClick={callFunction}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: getStateMutabilityColor(),
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              fontWeight: 'bold',
              width: '100%'
            }}
          >
            {loading ? 'Calling...' : `Execute`}
          </button>

          {/* Error Display */}
          {error && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c00',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          {/* Result Display */}
          {result !== null && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: '#efe',
              border: '1px solid #cfc',
              borderRadius: '4px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Result:</div>
              <pre style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
                fontSize: '0.875rem'
              }}>
                {typeof result === 'object'
                  ? JSON.stringify(result, (_key, value) =>
                      typeof value === 'bigint' ? value.toString() : value
                    , 2)
                  : String(result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
