'use client'

import {
  Switch,
  ClientOnly,
  Skeleton,
  HStack,
  Text,
} from '@chakra-ui/react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot)

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
