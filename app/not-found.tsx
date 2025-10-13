'use client';

import { Box, Center, Heading, Text, Button } from '@chakra-ui/react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Center minH="100vh">
      <Box textAlign="center">
        <Heading size="2xl" mb={4}>
          404
        </Heading>
        <Text fontSize="xl" mb={6} color="gray.600">
          Page not found
        </Text>
        <Link href="/">
          <Button colorScheme="blue">Go Home</Button>
        </Link>
      </Box>
    </Center>
  );
}
