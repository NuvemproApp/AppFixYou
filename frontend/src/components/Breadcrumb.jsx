import React from 'react';
import { Box, Text, Link } from '@nimbus-ds/components';

// Breadcrumb simples, sem lib pronta (Nimbus DS não tem componente Breadcrumb
// nesta versão) — cada item clicável usa Link+onClick (mesmo padrão de
// navegação já usado no resto do app, nunca href real), o último item
// (página atual) é só texto.
export default function Breadcrumb({ items }) {
  return (
    <Box display="flex" alignItems="center" gap="1" flexWrap="wrap">
      {items.map((item, i) => (
        <Box key={i} display="flex" alignItems="center" gap="1">
          {i > 0 && <Text color="neutral-textLow">/</Text>}
          {item.onClick ? (
            <Link as="button" onClick={item.onClick}>
              {item.label}
            </Link>
          ) : (
            <Text color="neutral-textLow" fontWeight="bold">
              {item.label}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
