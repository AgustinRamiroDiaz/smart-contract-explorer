"use client"

import { Combobox as ChakraCombobox, Portal } from "@chakra-ui/react"
import * as React from "react"

type ComboboxLabelProps = ChakraCombobox.LabelProps;

export const ComboboxLabel = React.forwardRef<
  HTMLLabelElement,
  ComboboxLabelProps
>(function ComboboxLabel(props, ref) {
  return <ChakraCombobox.Label {...props} ref={ref} />
})

interface ComboboxInputProps extends ChakraCombobox.InputProps {
  rootProps?: ChakraCombobox.ControlProps
  clearable?: boolean
}

export const ComboboxInput = React.forwardRef<
  HTMLInputElement,
  ComboboxInputProps
>(function ComboboxInput(props, ref) {
  const { rootProps, clearable, ...rest } = props
  return (
    <ChakraCombobox.Control {...rootProps}>
      <ChakraCombobox.Input {...rest} ref={ref} />
      {clearable && <ChakraCombobox.ClearTrigger />}
      <ChakraCombobox.Trigger />
    </ChakraCombobox.Control>
  )
})

type ComboboxContentProps = ChakraCombobox.ContentProps;

export const ComboboxContent = React.forwardRef<
  HTMLDivElement,
  ComboboxContentProps
>(function ComboboxContent(props, ref) {
  return (
    <Portal>
      <ChakraCombobox.Positioner>
        <ChakraCombobox.Content {...props} ref={ref} />
      </ChakraCombobox.Positioner>
    </Portal>
  )
})

type ComboboxItemProps = ChakraCombobox.ItemProps;

export const ComboboxItem = React.forwardRef<
  HTMLDivElement,
  ComboboxItemProps
>(function ComboboxItem(props, ref) {
  const { item, children, ...rest } = props
  return (
    <ChakraCombobox.Item key={item.value} item={item} {...rest} ref={ref}>
      <ChakraCombobox.ItemText>{children}</ChakraCombobox.ItemText>
      <ChakraCombobox.ItemIndicator />
    </ChakraCombobox.Item>
  )
})

type ComboboxRootProps = ChakraCombobox.RootProps;

export const ComboboxRoot = React.forwardRef<
  HTMLDivElement,
  ComboboxRootProps
>(function ComboboxRoot(props, ref) {
  return (
    <ChakraCombobox.Root
      {...props}
      ref={ref}
      positioning={{ sameWidth: true, ...props.positioning }}
    />
  )
})

interface ComboboxItemGroupProps extends ChakraCombobox.ItemGroupProps {
  label?: React.ReactNode
}

export const ComboboxItemGroup = React.forwardRef<
  HTMLDivElement,
  ComboboxItemGroupProps
>(function ComboboxItemGroup(props, ref) {
  const { children, label, ...rest } = props
  return (
    <ChakraCombobox.ItemGroup {...rest} ref={ref}>
      {label && (
        <ChakraCombobox.ItemGroupLabel>{label}</ChakraCombobox.ItemGroupLabel>
      )}
      {children}
    </ChakraCombobox.ItemGroup>
  )
})
