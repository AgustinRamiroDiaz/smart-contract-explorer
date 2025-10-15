import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const customConfig = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        // App-specific semantic tokens that work in light/dark mode
        card: {
          bg: { value: { _light: "white", _dark: "gray.800" } },
          border: { value: { _light: "gray.200", _dark: "gray.700" } },
        },
        code: {
          bg: { value: { _light: "gray.50", _dark: "gray.900" } },
          text: { value: { _light: "gray.900", _dark: "gray.100" } },
        },
        header: {
          bg: { value: { _light: "gray.50", _dark: "gray.800" } },
          hover: { value: { _light: "gray.100", _dark: "gray.700" } },
        },
      },
    },
    textStyles: {
      // Consistent text styles for common patterns
      mono: {
        value: {
          fontFamily: "mono",
          fontSize: "sm",
        },
      },
      monoCode: {
        value: {
          fontFamily: "mono",
          fontSize: "xs",
          lineHeight: "1.6",
        },
      },
      label: {
        value: {
          fontSize: "sm",
          fontWeight: "semibold",
        },
      },
      helperText: {
        value: {
          fontSize: "xs",
          color: "fg.muted",
        },
      },
      cardHeading: {
        value: {
          fontSize: "md",
          fontWeight: "semibold",
          color: "fg.muted",
        },
      },
    },
    layerStyles: {
      // Reusable container styles
      card: {
        value: {
          borderWidth: "1px",
          borderColor: "card.border",
          borderRadius: "lg",
          bg: "card.bg",
          overflow: "hidden",
        },
      },
      cardSection: {
        value: {
          p: 4,
          bg: "card.bg",
        },
      },
      codeBlock: {
        value: {
          display: "block",
          p: 2,
          bg: "code.bg",
          color: "code.text",
          borderRadius: "md",
          fontSize: "sm",
          fontFamily: "mono",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        },
      },
      codeInline: {
        value: {
          p: 2,
          bg: "code.bg",
          color: "code.text",
          borderRadius: "sm",
          fontSize: "xs",
          fontFamily: "mono",
        },
      },
      collapsibleHeader: {
        value: {
          p: 4,
          bg: "header.bg",
          cursor: "pointer",
          userSelect: "none",
          transition: "all 0.2s",
          _hover: {
            bg: "header.hover",
          },
          _focus: {
            outline: "2px solid",
            outlineColor: "blue.solid",
            outlineOffset: "-2px",
          },
        },
      },
      inputContainer: {
        value: {
          bg: "bg",
          borderWidth: "1px",
          borderColor: "border.muted",
          borderRadius: "md",
          _focusWithin: {
            borderColor: "blue.solid",
            boxShadow: "0 0 0 1px var(--chakra-colors-blue-solid)",
          },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, customConfig)
