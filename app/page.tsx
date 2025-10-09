'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';

type Deployment = Record<string, string>; // contract name -> address

type Network = Record<string, Deployment>; // deployment name -> deployment

type DeploymentsFile = Record<string, Network>; // network name -> network

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
  const [deploymentsFile, setDeploymentsFile] = useState<DeploymentsFile>({});
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [selectedDeployment, setSelectedDeployment] = useState('');
  const [selectedContract, setSelectedContract] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [owner, setOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDeployments, setLoadingDeployments] = useState(true);
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
        setOwner(null);
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

  const networkNames = Object.keys(deploymentsFile);
  const deploymentNames = selectedNetwork
    ? Object.keys(deploymentsFile[selectedNetwork] || {})
    : [];
  const contractNames = selectedNetwork && selectedDeployment
    ? Object.keys(deploymentsFile[selectedNetwork]?.[selectedDeployment] || {}).filter(
        (key) => deploymentsFile[selectedNetwork][selectedDeployment][key]?.startsWith('0x')
      )
    : [];

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
                setOwner(null);
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
                  setOwner(null);
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
                  setOwner(null);
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
