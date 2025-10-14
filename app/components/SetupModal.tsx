'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  VStack,
  Text,
  Input,
  Field,
  Heading,
} from '@chakra-ui/react';
import { DialogRoot, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogBackdrop } from '@chakra-ui/react';

interface SetupModalProps {
  open: boolean;
  onComplete: (deploymentsData: any, folderHandle: FileSystemDirectoryHandle) => void;
  onSkip: () => void;
  hasDeployments: boolean;
  hasFolderHandle: boolean;
}

export default function SetupModal({
  open,
  onComplete,
  onSkip,
  hasDeployments,
  hasFolderHandle,
}: SetupModalProps) {
  const [deployments, setDeployments] = useState<any>(null);
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setDeployments(data);
        setError(null);
      } catch (err) {
        setError('Invalid JSON file: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    };
    reader.readAsText(file);
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
    if (!deployments && !hasDeployments) {
      setError('Please upload a deployments file');
      return;
    }
    if (!folderHandle && !hasFolderHandle) {
      setError('Please select an ABIs folder');
      return;
    }

    onComplete(deployments, folderHandle!);
  };

  const canComplete = (deployments || hasDeployments) && (folderHandle || hasFolderHandle);

  return (
    <DialogRoot open={open} size="lg">
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Heading size="lg">Welcome to GenLayer Explorer</Heading>
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <VStack gap={6} align="stretch">
            <Text color="gray.600">
              To get started, please configure your deployment file and ABIs folder.
              This only needs to be done once - your configuration will be saved.
            </Text>

            {/* Deployments File */}
            <Box>
              <Field.Root>
                <Field.Label fontWeight="semibold">
                  1. Upload Deployments File
                  {hasDeployments && (
                    <Text as="span" ml={2} fontSize="sm" color="green.600">
                      ✓ Already configured
                    </Text>
                  )}
                </Field.Label>
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  pt={1}
                  fontSize="sm"
                  disabled={loading}
                />
                {deployments && (
                  <Text fontSize="xs" color="green.600" mt={1}>
                    ✓ File loaded successfully
                  </Text>
                )}
                {hasDeployments && !deployments && (
                  <Text fontSize="xs" color="gray.600" mt={1}>
                    Using existing deployments file (upload a new one to replace)
                  </Text>
                )}
              </Field.Root>
            </Box>

            {/* ABIs Folder */}
            <Box>
              <Field.Root>
                <Field.Label fontWeight="semibold">
                  2. Select ABIs Folder
                  {hasFolderHandle && (
                    <Text as="span" ml={2} fontSize="sm" color="green.600">
                      ✓ Already configured
                    </Text>
                  )}
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
                  <Text fontSize="xs" color="green.600" mt={1}>
                    ✓ Folder selected: {folderHandle.name}
                  </Text>
                )}
                {hasFolderHandle && !folderHandle && (
                  <Text fontSize="xs" color="gray.600" mt={1}>
                    Using existing folder (select a new one to replace)
                  </Text>
                )}
              </Field.Root>
            </Box>

            {/* Error Message */}
            {error && (
              <Box p={3} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
                <Text fontSize="sm" color="red.700">
                  {error}
                </Text>
              </Box>
            )}

            {/* Info */}
            <Box p={3} bg="blue.50" borderRadius="md">
              <Text fontSize="sm" color="blue.900">
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
