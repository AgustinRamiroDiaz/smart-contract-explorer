'use client';

import {
  Box,
  VStack,
  HStack,
  Heading,
  Button,
  Field,
  Input,
  NativeSelectRoot,
  NativeSelectField,
  Text,
  Alert,
  Center,
  Spinner,
} from '@chakra-ui/react';
import { Tooltip } from '@chakra-ui/react';
import { ConnectButton } from '@/app/components/ConnectButton';
import { ThemeToggle } from '@/components/ui/theme-selector';
import { useContract } from '@/app/context/ContractContext';

export default function Sidebar() {
  const {
    deploymentsFile,
    deploymentsFileHandle,
    selectedNetwork,
    setSelectedNetwork,
    selectedDeployment,
    setSelectedDeployment,
    selectedContract,
    setSelectedContract,
    contractAddress,
    setContractAddress,
    error,
    availableAbis,
    loadingAbiList,
    isInitializing,
    handleSelectDeploymentsFile,
    handleSelectAbisFolder,
    handleReconfigure,
    abisFolderHandle,
    rpcUrl,
    setRpcUrl,
    wsUrl,
    setWsUrl,
  } = useContract();

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

  return (
    <Box
      bg={{ base: 'gray.50' }}
      _dark={{ bg: 'gray.900' }}
      borderRightWidth="1px"
      p={6}
      overflowY="auto"
      h="100vh"
    >
      <VStack gap={4} align="stretch">
        {/* Connect Button */}
        <Box>
          <ConnectButton />
        </Box>

        {/* Theme Toggle */}
        <ThemeToggle />

        <HStack justify="space-between" align="center">
          <Heading size="md">Configuration</Heading>
          <Button
            size="xs"
            variant="ghost"
            onClick={handleReconfigure}
            title="Reconfigure settings"
          >
            ⚙️ Setup
          </Button>
        </HStack>

        {/* Initialization Loading */}
        {isInitializing && (
          <Center py={4}>
            <VStack gap={2}>
              <Spinner size="md" />
              <Text fontSize="sm" color="gray.600">
                Initializing...
              </Text>
            </VStack>
          </Center>
        )}

        {!isInitializing && (
          <>
            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">
                <HStack gap={1} display="inline-flex" align="center">
                  <Text>Deployments File:</Text>
                  <Tooltip.Root openDelay={200} closeDelay={100}>
                    <Tooltip.Trigger asChild>
                      <Box
                        as="span"
                        cursor="help"
                        color="gray.500"
                        fontSize="xs"
                        display="inline-flex"
                        alignItems="center"
                      >
                        ℹ️
                      </Box>
                    </Tooltip.Trigger>
                    <Tooltip.Positioner>
                      <Tooltip.Content
                        bg="gray.800"
                        color="white"
                        p={3}
                        borderRadius="md"
                        maxW="320px"
                        boxShadow="lg"
                        zIndex={9999}
                      >
                        <Text fontWeight="semibold" mb={2} fontSize="sm">Expected JSON format:</Text>
                        <Box
                          as="pre"
                          fontSize="xs"
                          whiteSpace="pre-wrap"
                          bg="gray.900"
                          p={2}
                          borderRadius="sm"
                        >
{`{
  "network-name": {
    "deployment-name": {
      "ContractName": "0x..."
    }
  }
}`}
                        </Box>
                      </Tooltip.Content>
                    </Tooltip.Positioner>
                  </Tooltip.Root>
                </HStack>
              </Field.Label>
              <Button
                onClick={handleSelectDeploymentsFile}
                size="sm"
                width="full"
                variant="outline"
              >
                {deploymentsFileHandle ? `📄 ${deploymentsFileHandle.name}` : 'Select Deployments File'}
              </Button>
              {deploymentsFileHandle && Object.keys(deploymentsFile).length > 0 && (
                <Text fontSize="xs" color="green.600" mt={1}>
                  ✓ Loaded ({Object.keys(deploymentsFile).length} network{Object.keys(deploymentsFile).length !== 1 ? 's' : ''})
                </Text>
              )}
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">
                <HStack gap={1} display="inline-flex" align="center">
                  <Text>ABIs Folder:</Text>
                  <Tooltip.Root openDelay={200} closeDelay={100}>
                    <Tooltip.Trigger asChild>
                      <Box
                        as="span"
                        cursor="help"
                        color="gray.500"
                        fontSize="xs"
                        display="inline-flex"
                        alignItems="center"
                      >
                        ℹ️
                      </Box>
                    </Tooltip.Trigger>
                    <Tooltip.Positioner>
                      <Tooltip.Content
                        bg="gray.800"
                        color="white"
                        p={3}
                        borderRadius="md"
                        maxW="320px"
                        boxShadow="lg"
                        zIndex={9999}
                      >
                        <Text fontWeight="semibold" mb={2} fontSize="sm">Expected folder structure:</Text>
                        <Box
                          as="pre"
                          fontSize="xs"
                          whiteSpace="pre-wrap"
                          bg="gray.900"
                          p={2}
                          borderRadius="sm"
                          mb={2}
                        >
{`artifacts/
├── Contract1.sol/
│   └── Contract1.json
├── Contract2.sol/
│   └── Contract2.json
└── ...`}
                        </Box>
                        <Text fontSize="xs">
                          Each .sol directory should contain a JSON file with the contract's ABI.
                        </Text>
                      </Tooltip.Content>
                    </Tooltip.Positioner>
                  </Tooltip.Root>
                </HStack>
              </Field.Label>
              <Button
                onClick={handleSelectAbisFolder}
                size="sm"
                width="full"
                variant="outline"
              >
                {abisFolderHandle ? `📁 ${abisFolderHandle.name}` : 'Select ABIs Folder'}
              </Button>
              {loadingAbiList && (
                <Text fontSize="xs" color="gray.600" mt={1}>
                  Scanning folder...
                </Text>
              )}
              {!loadingAbiList && availableAbis.size > 0 && (
                <Text fontSize="xs" color="green.600" mt={1}>
                  ✓ Found {availableAbis.size} ABI{availableAbis.size !== 1 ? 's' : ''}
                </Text>
              )}
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">Select Network:</Field.Label>
              <NativeSelectRoot size="sm">
                <NativeSelectField
                  value={selectedNetwork}
                  onChange={(e) => {
                    setSelectedNetwork(e.target.value);
                    setSelectedDeployment('');
                    setSelectedContract('');
                  }}
                  bg={{ base: 'white' }}
                  _dark={{ bg: 'gray.800' }}
                >
                  <option value="">-- Select a network --</option>
                  {networkNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>

            {selectedNetwork && (
              <Field.Root>
                <Field.Label fontSize="sm" fontWeight="semibold">Select Deployment:</Field.Label>
                <NativeSelectRoot size="sm">
                  <NativeSelectField
                    value={selectedDeployment}
                    onChange={(e) => {
                      setSelectedDeployment(e.target.value);
                      setSelectedContract('');
                    }}
                    bg={{ base: 'white' }}
                    _dark={{ bg: 'gray.800' }}
                  >
                    <option value="">-- Select a deployment --</option>
                    {deploymentNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </NativeSelectField>
                </NativeSelectRoot>
              </Field.Root>
            )}

            {selectedNetwork && selectedDeployment && (
              <Field.Root>
                <Field.Label fontSize="sm" fontWeight="semibold">
                  Select Contract:
                  {loadingAbiList && (
                    <Text as="span" ml={2} fontSize="xs" color="gray.500" fontWeight="normal">
                      (Loading...)
                    </Text>
                  )}
                </Field.Label>
                <NativeSelectRoot size="sm" disabled={loadingAbiList}>
                  <NativeSelectField
                    value={selectedContract}
                    onChange={(e) => {
                      setSelectedContract(e.target.value);
                    }}
                    bg={{ base: 'white' }}
                    _dark={{ bg: 'gray.800' }}
                  >
                    <option value="">
                      {!abisFolderHandle
                        ? 'Select ABIs folder first'
                        : loadingAbiList
                        ? 'Loading...'
                        : contractNames.length === 0
                        ? 'No contracts with ABIs found'
                        : '-- Select a contract --'}
                    </option>
                    {contractNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </NativeSelectField>
                </NativeSelectRoot>
                {!loadingAbiList && contractNames.length > 0 && (
                  <Text fontSize="xs" color="gray.600" mt={1}>
                    {contractNames.length} contract{contractNames.length !== 1 ? 's' : ''} available
                  </Text>
                )}
              </Field.Root>
            )}

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">Contract Address:</Field.Label>
              <Input
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x..."
                bg={{ base: 'white' }}
                _dark={{ bg: 'gray.800' }}
                fontSize="sm"
                fontFamily="mono"
              />
            </Field.Root>

            <Heading size="sm" mt={2}>RPC Endpoints</Heading>

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">RPC URL:</Field.Label>
              <Input
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                placeholder="https://..."
                bg={{ base: 'white' }}
                _dark={{ bg: 'gray.800' }}
                fontSize="xs"
                fontFamily="mono"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="semibold">WebSocket URL:</Field.Label>
              <Input
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                placeholder="wss://..."
                bg={{ base: 'white' }}
                _dark={{ bg: 'gray.800' }}
                fontSize="xs"
                fontFamily="mono"
              />
            </Field.Root>
          </>
        )}

        {/* Display error if any */}
        {error && (
          <Alert.Root status="error" size="sm">
            <Alert.Indicator />
            <Alert.Title fontSize="xs">{error}</Alert.Title>
          </Alert.Root>
        )}
      </VStack>
    </Box>
  );
}
