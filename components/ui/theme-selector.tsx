'use client'

import {
  Button,
  ClientOnly,
  Skeleton,
  HStack,
  Text,
} from '@chakra-ui/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <ClientOnly fallback={<Skeleton height="40px" />}>
        <Skeleton height="40px" />
      </ClientOnly>
    )
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <Button
      onClick={toggleTheme}
      size="sm"
      width="full"
      variant="outline"
      bg={{ base: 'white' }}
      _dark={{ bg: 'gray.800' }}
    >
      <HStack gap={2}>
        <Text>{theme === 'light' ? '🌙' : '☀️'}</Text>
        <Text>
          {theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
        </Text>
      </HStack>
    </Button>
  )
}
