'use client'

import {
  Switch,
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

  const isDark = theme === 'dark'

  return (
    <HStack justify="space-between" w="full">
      <Text fontSize="sm" fontWeight="semibold">
        Theme
      </Text>
      <HStack gap={2}>
        <Text fontSize="sm">☀️</Text>
        <Switch.Root
          checked={isDark}
          onCheckedChange={(e) => setTheme(e.checked ? 'dark' : 'light')}
          colorPalette="blue"
          size="md"
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
        <Text fontSize="sm">🌙</Text>
      </HStack>
    </HStack>
  )
}
