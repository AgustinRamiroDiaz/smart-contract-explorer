'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  VStack,
  Text,
  Field,
  Heading,
  HStack,
} from '@chakra-ui/react';
import { DialogRoot, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogBackdrop } from '@chakra-ui/react';
import { Tooltip } from '@chakra-ui/react';

interface SetupModalProps {
  open: boolean;
  onComplete: (fileHandle: FileSystemFileHandle | null, folderHandle: FileSystemDirectoryHandle | null) => void;
  onSkip: () => void;
  hasDeploymentsFile: boolean;
  hasFolderHandle: boolean;
}

export default function SetupModal({
  open,
  onComplete,
  onSkip,
  hasDeploymentsFile,
  hasFolderHandle,
}: SetupModalProps) {
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectFile = async () => {
    try {
      setLoading(true);
      // @ts-ignore - File System Access API
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] }
        }],
        multiple: false
      });

      // Validate it's a valid JSON file
      const file = await handle.getFile();
      const text = await file.text();
      JSON.parse(text); // Will throw if invalid

      setFileHandle(handle);
      setError(null);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Invalid JSON file: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      setLoading(true);
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker();
      setFolderHandle(dirHandle);
      setError(null);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Failed to select folder: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (!fileHandle && !hasDeploymentsFile) {
      setError('Please select a deployments file');
      return;
    }
    if (!folderHandle && !hasFolderHandle) {
      setError('Please select an ABIs folder');
      return;
    }

    onComplete(fileHandle, folderHandle);
  };

  const canComplete = (fileHandle || hasDeploymentsFile) && (folderHandle || hasFolderHandle);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onSkip();
      }
      // Enter to submit when canComplete
      if (e.key === 'Enter' && canComplete && open) {
        handleComplete();
      }
    };

    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onSkip, canComplete]);

  return (
    <DialogRoot open={open} size="lg">
      <DialogBackdrop
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="blackAlpha.600"
        zIndex={1000}
      />
      <DialogContent
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex={1001}
        bg="white"
        maxW="lg"
        w="full"
        mx={4}
      >
        <DialogHeader>
          <DialogTitle>
            <Heading size="lg">Welcome to GenLayer Explorer</Heading>
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <VStack gap={6} align="stretch">
            <Text color="fg.muted">
              To get started, please configure your deployment file and ABIs folder.
              This only needs to be done once - your configuration will be saved.
            </Text>

            {/* Deployments File */}
            <Box>
              <Field.Root>
                <Field.Label fontWeight="semibold">
                  <HStack gap={2} display="inline-flex" align="center">
                    <Text>1. Select Deployments File</Text>
                    <Tooltip.Root openDelay={200} closeDelay={100}>
                      <Tooltip.Trigger asChild>
                        <Box
                          as="span"
                          cursor="help"
                          color="fg.subtle"
                          fontSize="xs"
                          display="inline-flex"
                          alignItems="center"
                        >
                          ℹ️
                        </Box>
                      </Tooltip.Trigger>
                      <Tooltip.Positioner>
                        <Tooltip.Content
                          bg="bg.inverted"
                          color="fg.inverted"
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
                            mb={2}
                          >
{`{
  "network-name": {
    "deployment-name": {
      "ContractName": "0x..."
    }
  }
}`}
                          </Box>
                          <Text fontSize="xs">
                            Example: Hardhat deployments file or custom JSON with contract addresses
                          </Text>
                        </Tooltip.Content>
                      </Tooltip.Positioner>
                    </Tooltip.Root>
                    {hasDeploymentsFile && (
                      <Text as="span" fontSize="sm" color="green.solid">
                        ✓ Already configured
                      </Text>
                    )}
                  </HStack>
                </Field.Label>
                <Button
                  onClick={handleSelectFile}
                  width="full"
                  variant="outline"
                  disabled={loading}
                  loading={loading}
                >
                  {fileHandle
                    ? `📄 ${fileHandle.name}`
                    : hasDeploymentsFile
                    ? 'Change Deployments File'
                    : 'Select Deployments File'}
                </Button>
                {fileHandle && (
                  <Text textStyle="helperText" color="green.solid" mt={1}>
                    ✓ File selected: {fileHandle.name}
                  </Text>
                )}
                {hasDeploymentsFile && !fileHandle && (
                  <Text textStyle="helperText" mt={1}>
                    Using existing deployments file (select a new one to replace)
                  </Text>
                )}
              </Field.Root>
            </Box>

            {/* ABIs Folder */}
            <Box>
              <Field.Root>
                <Field.Label fontWeight="semibold">
                  <HStack gap={2} display="inline-flex" align="center">
                    <Text>2. Select ABIs Folder</Text>
                    <Tooltip.Root openDelay={200} closeDelay={100}>
                      <Tooltip.Trigger asChild>
                        <Box
                          as="span"
                          cursor="help"
                          color="fg.subtle"
                          fontSize="xs"
                          display="inline-flex"
                          alignItems="center"
                        >
                          ℹ️
                        </Box>
                      </Tooltip.Trigger>
                      <Tooltip.Positioner>
                        <Tooltip.Content
                          bg="bg.inverted"
                          color="fg.inverted"
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
                            Compatible with Hardhat artifacts or Foundry out/ directory structure
                          </Text>
                        </Tooltip.Content>
                      </Tooltip.Positioner>
                    </Tooltip.Root>
                    {hasFolderHandle && (
                      <Text as="span" fontSize="sm" color="green.solid">
                        ✓ Already configured
                      </Text>
                    )}
                  </HStack>
                </Field.Label>
                <Button
                  onClick={handleSelectFolder}
                  width="full"
                  variant="outline"
                  disabled={loading}
                  loading={loading}
                >
                  {folderHandle
                    ? `📁 ${folderHandle.name}`
                    : hasFolderHandle
                    ? 'Change ABIs Folder'
                    : 'Select ABIs Folder'}
                </Button>
                {folderHandle && (
                  <Text textStyle="helperText" color="green.solid" mt={1}>
                    ✓ Folder selected: {folderHandle.name}
                  </Text>
                )}
                {hasFolderHandle && !folderHandle && (
                  <Text textStyle="helperText" mt={1}>
                    Using existing folder (select a new one to replace)
                  </Text>
                )}
              </Field.Root>
            </Box>

            {/* Error Message */}
            {error && (
              <Box p={3} bg="red.subtle" borderRadius="md" borderWidth="1px" borderColor="red.muted">
                <Text textStyle="label" color="red.fg">
                  {error}
                </Text>
              </Box>
            )}

            {/* Info */}
            <Box p={3} bg="blue.subtle" borderRadius="md">
              <Text textStyle="label" color="blue.fg">
                💡 Your configuration will be saved in your browser. You can reconfigure
                anytime using the settings button in the sidebar.
              </Text>
            </Box>
          </VStack>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onSkip} mr={2}>
            Skip for Now
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleComplete}
            disabled={!canComplete}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
