"use client"

import { Select as ChakraSelect, Portal } from "@chakra-ui/react"
import * as React from "react"

interface SelectTriggerProps extends ChakraSelect.ControlProps {
  clearable?: boolean
}

export const SelectLabel = ChakraSelect.Label

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  SelectTriggerProps
>(function SelectTrigger(props, ref) {
  const { children, clearable, ...rest } = props
  return (
    <ChakraSelect.Control {...rest}>
      <ChakraSelect.Trigger ref={ref}>{children}</ChakraSelect.Trigger>
      <ChakraSelect.IndicatorGroup>
        {clearable && <ChakraSelect.ClearTrigger />}
        <ChakraSelect.Indicator />
      </ChakraSelect.IndicatorGroup>
    </ChakraSelect.Control>
  )
})

export const SelectContent = React.forwardRef<
  HTMLDivElement,
  ChakraSelect.ContentProps
>(function SelectContent(props, ref) {
  return (
    <Portal>
      <ChakraSelect.Positioner>
        <ChakraSelect.Content {...props} ref={ref} />
      </ChakraSelect.Positioner>
    </Portal>
  )
})

export const SelectItem = React.forwardRef<
  HTMLDivElement,
  ChakraSelect.ItemProps
>(function SelectItem(props, ref) {
  const { item, children, ...rest } = props
  return (
    <ChakraSelect.Item key={item.value} item={item} {...rest} ref={ref}>
      {children}
      <ChakraSelect.ItemIndicator />
    </ChakraSelect.Item>
  )
})

export const SelectValueText = React.forwardRef<
  HTMLSpanElement,
  ChakraSelect.ValueTextProps
>(function SelectValueText(props, ref) {
  return <ChakraSelect.ValueText {...props} ref={ref} />
})

export const SelectRoot = React.forwardRef<
  HTMLDivElement,
  ChakraSelect.RootProps
>(function SelectRoot(props, ref) {
  return (
    <ChakraSelect.Root
      {...props}
      ref={ref}
      positioning={{ sameWidth: true, ...props.positioning }}
    />
  )
})

interface SelectItemGroupProps extends ChakraSelect.ItemGroupProps {
  label?: React.ReactNode
}

export const SelectItemGroup = React.forwardRef<
  HTMLDivElement,
  SelectItemGroupProps
>(function SelectItemGroup(props, ref) {
  const { children, label, ...rest } = props
  return (
    <ChakraSelect.ItemGroup {...rest} ref={ref}>
      {label && <ChakraSelect.ItemGroupLabel>{label}</ChakraSelect.ItemGroupLabel>}
      {children}
    </ChakraSelect.ItemGroup>
  )
})
