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

type AbiFunction = {
  name: string;
  type: string;
  stateMutability: string;
  inputs: any[];
  outputs: any[];
};

export default function Page() {
  const [deploymentsFile, setDeploymentsFile] = useState<DeploymentsFile>({});
  const [abisFolder, setAbisFolder] = useState('/home/az/genlayer/genlayer-node/third_party/contracts/artifacts');
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [selectedDeployment, setSelectedDeployment] = useState('');
  const [selectedContract, setSelectedContract] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [contractAbi, setContractAbi] = useState<any[] | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [functionResult, setFunctionResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
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
        setFunctionResult(null);
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

  const selectedFunctionAbi = readFunctions.find((fn) => fn.name === selectedFunction);

  const callFunction = async () => {
    if (!contractAddress) {
      setError('Please enter a contract address');
      return;
    }

    if (!selectedFunction) {
      setError('Please select a function to call');
      return;
    }

    if (!selectedFunctionAbi) {
      setError('Function ABI not found');
      return;
    }

    setLoading(true);
    setError(null);
    setFunctionResult(null);

    try {
      const client = createPublicClient({
        chain: genlayerTestnet,
        transport: http(),
      });

      const data = await client.readContract({
        address: contractAddress as `0x${string}`,
        abi: contractAbi || [],
        functionName: selectedFunction,
        args: [],
      });

      setFunctionResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to call function');
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
                setFunctionResult(null);
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
                  setFunctionResult(null);
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
                  setFunctionResult(null);
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

          {contractAbi && readFunctions.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <label htmlFor="function" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Select Function to Call:
              </label>
              <select
                id="function"
                value={selectedFunction}
                onChange={(e) => {
                  setSelectedFunction(e.target.value);
                  setFunctionResult(null);
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
                <option value="">-- Select a function --</option>
                {readFunctions.map((fn) => (
                  <option key={fn.name} value={fn.name}>
                    {fn.name}({fn.inputs.map((i) => i.type).join(', ')})
                    {fn.outputs.length > 0 && ` → ${fn.outputs.map((o) => o.type).join(', ')}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {loadingAbi && (
            <div style={{ marginTop: '1rem', color: '#666' }}>
              Loading ABI...
            </div>
          )}

          {contractAbi && readFunctions.length === 0 && (
            <div style={{ marginTop: '1rem', color: '#666' }}>
              No read functions found in ABI
            </div>
          )}
        </>
      )}

      {selectedFunction && (
        <button
          onClick={callFunction}
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
          {loading ? 'Calling...' : `Call ${selectedFunction}`}
        </button>
      )}

      {error && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00' }}>
          {error}
        </div>
      )}

      {functionResult !== null && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#efe', border: '1px solid #cfc', borderRadius: '4px' }}>
          <strong>Result:</strong>
          <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {typeof functionResult === 'object'
              ? JSON.stringify(functionResult, (key, value) =>
                  typeof value === 'bigint' ? value.toString() : value
                , 2)
              : String(functionResult)}
          </pre>
        </div>
      )}
    </div>
  );
}
