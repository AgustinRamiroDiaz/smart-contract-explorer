'use client';

import { Input } from '@chakra-ui/react';
import { forwardRef } from 'react';

interface AddressInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Input component specifically designed for Ethereum addresses.
 * Wide enough to display full 42-character addresses (0x + 40 hex chars).
 */
const AddressInput = forwardRef<HTMLInputElement, AddressInputProps>(
  ({ value, onChange, onBlur, onKeyDown, placeholder = '0x...', disabled }, ref) => {
    return (
      <Input
        ref={ref}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        textStyle="mono"
        minWidth="480px"
        width="100%"
      />
    );
  }
);

AddressInput.displayName = 'AddressInput';

export default AddressInput;
