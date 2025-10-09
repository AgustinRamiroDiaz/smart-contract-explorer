'use client';

import { useState, useEffect } from 'react';
import { defineChain } from 'viem';
import FunctionCard from './components/FunctionCard';

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

          // Auto-select if only one network
          const networks = Object.keys(data);
          if (networks.length === 1) {
            const savedNetwork = localStorage.getItem('selectedNetwork');
            const savedDeployment = localStorage.getItem('selectedDeployment');

            setSelectedNetwork(savedNetwork || networks[0]);
            if (savedDeployment && data[savedNetwork || networks[0]]?.[savedDeployment]) {
              setSelectedDeployment(savedDeployment);
            }
          } else {
            // Restore from localStorage if available
            const savedNetwork = localStorage.getItem('selectedNetwork');
            const savedDeployment = localStorage.getItem('selectedDeployment');

            if (savedNetwork && data[savedNetwork]) {
              setSelectedNetwork(savedNetwork);
              if (savedDeployment && data[savedNetwork]?.[savedDeployment]) {
                setSelectedDeployment(savedDeployment);
              }
            }
          }
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

  // Save network and deployment to localStorage when changed
  useEffect(() => {
    if (selectedNetwork) {
      localStorage.setItem('selectedNetwork', selectedNetwork);
    }
  }, [selectedNetwork]);

  useEffect(() => {
    if (selectedDeployment) {
      localStorage.setItem('selectedDeployment', selectedDeployment);
    }
  }, [selectedDeployment]);

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

  // State to track which contracts have ABIs available
  const [availableAbis, setAvailableAbis] = useState<Set<string>>(new Set());

  // Check which ABIs are available when deployment changes
  useEffect(() => {
    if (!selectedNetwork || !selectedDeployment || !abisFolder) {
      setAvailableAbis(new Set());
      return;
    }

    const deployment = deploymentsFile[selectedNetwork]?.[selectedDeployment];
    if (!deployment) {
      setAvailableAbis(new Set());
      return;
    }

    // Get all contract names
    const contracts = Object.keys(deployment).filter(
      (key) => deployment[key]?.startsWith('0x')
    );

    // Check each contract for ABI availability
    const checkAbis = async () => {
      const available = new Set<string>();
      await Promise.all(
        contracts.map(async (contractName) => {
          try {
            const response = await fetch(
              `/api/abi/${contractName}?folder=${encodeURIComponent(abisFolder)}`
            );
            if (response.ok) {
              available.add(contractName);
            }
          } catch (err) {
            // ABI not available for this contract
          }
        })
      );
      setAvailableAbis(available);
    };

    checkAbis();
  }, [selectedNetwork, selectedDeployment, abisFolder, deploymentsFile]);

  const networkNames = Object.keys(deploymentsFile);
  const deploymentNames = selectedNetwork
    ? Object.keys(deploymentsFile[selectedNetwork] || {})
    : [];
  const contractNames = selectedNetwork && selectedDeployment
    ? Object.keys(deploymentsFile[selectedNetwork]?.[selectedDeployment] || {}).filter(
        (key) => {
          const hasAddress = deploymentsFile[selectedNetwork][selectedDeployment][key]?.startsWith('0x');
          const hasAbi = availableAbis.has(key);
          return hasAddress && hasAbi;
        }
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
