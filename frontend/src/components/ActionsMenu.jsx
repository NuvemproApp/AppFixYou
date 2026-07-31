import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Text } from '@nimbus-ds/components';

const MENU_WIDTH = 150;
const ITEM_HEIGHT = 36;

// Dropdown de ações — fecha ao clicar fora. Usa position:fixed com
// coordenadas calculadas via getBoundingClientRect() (em vez de
// position:absolute) de propósito: o container da tabela tem
// overflow-x:auto (rolagem horizontal em telas estreitas), e por regra do
// CSS isso força overflow-y a virar "auto" também — ou seja, o container
// corta qualquer coisa que vaze dele verticalmente, inclusive um menu
// absolute. position:fixed escapa desse corte (é posicionado relativo à
// janela, não ao container), sem precisar tocar no overflow-x da tabela.
// Também abre pra cima automaticamente quando não há espaço embaixo.
// `items`: [{ label, onClick, danger? }].
export default function ActionsMenu({ items }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);

  const reposition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const estimatedHeight = items.length * ITEM_HEIGHT + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    setCoords({
      left,
      top: openUp ? null : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : null,
    });
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    reposition();

    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  return (
    <Box ref={ref} display="inline-flex">
      <Button size="small" appearance="neutral" onClick={() => setOpen((v) => !v)}>
        {t('common.actions')} ▾
      </Button>
      {open && coords && (
        <Box
          backgroundColor="neutral-background"
          borderColor="neutral-surfaceHighlight"
          borderStyle="solid"
          borderWidth="1"
          borderRadius="2"
          boxShadow="2"
          position="fixed"
          top={coords.top != null ? `${coords.top}px` : undefined}
          bottom={coords.bottom != null ? `${coords.bottom}px` : undefined}
          left={`${coords.left}px`}
          zIndex="500"
          minWidth={`${MENU_WIDTH}px`}
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
