import React from 'react';
import { Box, Input } from '@nimbus-ds/components';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#14B8A6', '#3B82F6', '#6366F1', '#A855F7',
  '#EC4899', '#6B7280',
];

export default function ColorInput({ value, onChange, disabled }) {
  const isValid = !value || HEX_RE.test(value);

  return (
    <Box display="flex" flexDirection="column" gap="2">
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
        <Box maxWidth="110px">
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

      {!disabled && (
        <Box display="flex" gap="1" flexWrap="wrap">
          {PRESET_COLORS.map((c) => (
            <div
              key={c}
              onClick={() => onChange(c)}
              title={c}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: c,
                cursor: 'pointer',
                border:
                  value?.toLowerCase() === c.toLowerCase()
                    ? '2px solid #3b3b3b'
                    : '1px solid rgba(0,0,0,0.15)',
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
