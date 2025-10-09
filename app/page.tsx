'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';

type Deployment = Record<string, string>; // contract name -> address

type Network = Record<string, Deployment>; // deployment name -> deployment

type DeploymentsFile = Record<string, Network>; // network name -> network

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

type AbiFunction = {
  name: string;
  type: string;
  stateMutability: string;
  inputs: AbiInput[];
  outputs: AbiOutput[];
};

// Function Card Component
function FunctionCard({
  func,
  contractAddress,
  contractAbi,
  chain
}: {
  func: AbiFunction;
  contractAddress: string;
  contractAbi: any[];
  chain: any;
}) {
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

export default function Page() {
  const [deploymentsFile, setDeploymentsFile] = useState<DeploymentsFile>({});
  const [abisFolder, setAbisFolder] = useState('/home/az/genlayer/genlayer-node/third_party/contracts/artifacts');
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [selectedDeployment, setSelectedDeployment] = useState('');
  const [selectedContract, setSelectedContract] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [contractAbi, setContractAbi] = useState<any[] | null>(null);
  const [loadingDeployments, setLoadingDeployments] = useState(true);
  const [loadingAbi, setLoadingAbi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load deployments on mount
  useEffect(() => {
    fetch('/api/deployments')
      .then((res) => res.json())
      .then((data: DeploymentsFile) => {
        if (data.error) {
          setError('Failed to load deployments: ' + data.error);
        } else {
          setDeploymentsFile(data);
        }
        setLoadingDeployments(false);
      })
      .catch((err) => {
        setError('Failed to load deployments: ' + err.message);
        setLoadingDeployments(false);
      });
  }, []);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setDeploymentsFile(data);
        setSelectedNetwork('');
        setSelectedDeployment('');
        setSelectedContract('');
        setContractAddress('');
        setError(null);
      } catch (err) {
        setError('Failed to parse JSON file: ' + (err instanceof Error ? err.message : 'Invalid JSON'));
      }
    };
    reader.readAsText(file);
  };

  // Update contract address when deployment or contract is selected
  useEffect(() => {
    if (selectedNetwork && selectedDeployment && selectedContract) {
      const address = deploymentsFile[selectedNetwork]?.[selectedDeployment]?.[selectedContract];
      if (address && address.startsWith('0x')) {
        setContractAddress(address);
      }
    }
  }, [selectedNetwork, selectedDeployment, selectedContract, deploymentsFile]);

  // Load ABI when contract is selected or abisFolder changes
  useEffect(() => {
    if (selectedContract && abisFolder) {
      setLoadingAbi(true);
      setContractAbi(null);

      fetch(`/api/abi/${selectedContract}?folder=${encodeURIComponent(abisFolder)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            console.warn('ABI not found for contract:', selectedContract);
            setContractAbi(null);
          } else {
            setContractAbi(data.abi);
          }
          setLoadingAbi(false);
        })
        .catch((err) => {
          console.error('Error loading ABI:', err);
          setContractAbi(null);
          setLoadingAbi(false);
        });
    } else {
      setContractAbi(null);
    }
  }, [selectedContract, abisFolder]);

  const networkNames = Object.keys(deploymentsFile);
  const deploymentNames = selectedNetwork
    ? Object.keys(deploymentsFile[selectedNetwork] || {})
    : [];
  const contractNames = selectedNetwork && selectedDeployment
    ? Object.keys(deploymentsFile[selectedNetwork]?.[selectedDeployment] || {}).filter(
        (key) => deploymentsFile[selectedNetwork][selectedDeployment][key]?.startsWith('0x')
      )
    : [];

  // Get read functions from ABI (view and pure functions)
  const readFunctions: AbiFunction[] = contractAbi
    ? contractAbi.filter(
        (item: any) =>
          item.type === 'function' &&
          (item.stateMutability === 'view' || item.stateMutability === 'pure')
      )
    : [];

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>GenLayer Contract Explorer</h1>

      {loadingDeployments ? (
        <div style={{ marginTop: '2rem' }}>Loading deployments...</div>
      ) : (
        <>
          <div style={{ marginTop: '2rem' }}>
            <label htmlFor="fileUpload" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Load Deployments File:
            </label>
            <input
              id="fileUpload"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label htmlFor="abisFolder" style={{ display: 'block', marginBottom: '0.5rem' }}>
              ABIs Folder Path:
            </label>
            <input
              id="abisFolder"
              type="text"
              value={abisFolder}
              onChange={(e) => setAbisFolder(e.target.value)}
              placeholder="/path/to/artifacts"
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label htmlFor="network" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Select Network:
            </label>
            <select
              id="network"
              value={selectedNetwork}
              onChange={(e) => {
                setSelectedNetwork(e.target.value);
                setSelectedDeployment('');
                setSelectedContract('');
                setError(null);
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            >
              <option value="">-- Select a network --</option>
              {networkNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {selectedNetwork && (
            <div style={{ marginTop: '1rem' }}>
              <label htmlFor="deployment" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Select Deployment:
              </label>
              <select
                id="deployment"
                value={selectedDeployment}
                onChange={(e) => {
                  setSelectedDeployment(e.target.value);
                  setSelectedContract('');
                  setError(null);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              >
                <option value="">-- Select a deployment --</option>
                {deploymentNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedNetwork && selectedDeployment && (
            <div style={{ marginTop: '1rem' }}>
              <label htmlFor="contract" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Select Contract:
              </label>
              <select
                id="contract"
                value={selectedContract}
                onChange={(e) => {
                  setSelectedContract(e.target.value);
                  setError(null);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              >
                <option value="">-- Select a contract --</option>
                {contractNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <label htmlFor="address" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Contract Address:
            </label>
            <input
              id="address"
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="0x... or select from deployments above"
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
          </div>

        </>
      )}

      {/* Display error if any */}
      {error && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00' }}>
          {error}
        </div>
      )}

      {/* Loading ABI indicator */}
      {loadingAbi && (
        <div style={{ marginTop: '2rem', textAlign: 'center', color: '#666' }}>
          Loading contract ABI...
        </div>
      )}

      {/* Function List - Swagger-like UI */}
      {contractAbi && contractAddress && readFunctions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Available Functions</h2>
          <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
            {readFunctions.length} read function{readFunctions.length !== 1 ? 's' : ''} available
          </div>
          {readFunctions.map((func) => (
            <FunctionCard
              key={func.name}
              func={func}
              contractAddress={contractAddress}
              contractAbi={contractAbi}
              chain={genlayerTestnet}
            />
          ))}
        </div>
      )}

      {/* No functions message */}
      {contractAbi && contractAddress && readFunctions.length === 0 && (
        <div style={{ marginTop: '2rem', textAlign: 'center', color: '#666' }}>
          No read functions found in this contract's ABI
        </div>
      )}
    </div>
  );
}
