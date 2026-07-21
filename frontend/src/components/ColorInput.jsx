import React from 'react';
import { Box, Input } from '@nimbus-ds/components';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export default function ColorInput({ value, onChange, disabled }) {
  const isValid = !value || HEX_RE.test(value);

  return (
    <Box display="flex" alignItems="center" gap="2">
      <input
        type="color"
        value={HEX_RE.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: 40,
          height: 40,
          borderRadius: 6,
          border: `1px solid ${isValid ? '#d1d5db' : '#dc3545'}`,
          padding: 2,
          cursor: disabled ? 'default' : 'pointer',
          background: 'none',
          flexShrink: 0,
        }}
      />
      <Box style={{ maxWidth: 110 }}>
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#rrggbb"
          maxLength={7}
          disabled={disabled}
          appearance={!isValid ? 'danger' : undefined}
        />
      </Box>
    </Box>
  );
}
