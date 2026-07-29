import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Text } from '@nimbus-ds/components';

// Dropdown de ações genérico — painel absoluto que fecha ao clicar fora.
// `items`: [{ label, onClick, danger? }].
export default function ActionsMenu({ items }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <Box ref={ref} position="relative" display="inline-flex">
      <Button size="small" appearance="neutral" onClick={() => setOpen((v) => !v)}>
        {t('common.actions')} ▾
      </Button>
      {open && (
        <Box
          backgroundColor="neutral-background"
          borderColor="neutral-surfaceHighlight"
          borderStyle="solid"
          borderWidth="1"
          borderRadius="2"
          boxShadow="2"
          position="absolute"
          right="0"
          top="110%"
          zIndex="500"
          minWidth="150px"
        >
          <Box display="flex" flexDirection="column" padding="1" gap="1">
            {items.map((item, idx) => (
              <Button
                key={idx}
                appearance="transparent"
                size="small"
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
              >
                <Text color={item.danger ? 'danger-interactive' : undefined}>{item.label}</Text>
              </Button>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
