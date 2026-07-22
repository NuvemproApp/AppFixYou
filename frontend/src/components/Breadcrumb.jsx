import React from 'react';
import { Box, Text } from '@nimbus-ds/components';

// Breadcrumb — replica o padrão já estabelecido no PromoHero/AlugueMais/
// SuperCampos (o mesmo bloco JSX aparece duplicado em cada página desses 3
// apps; aqui é extraído como componente reutilizável, mas o markup renderizado
// é idêntico): item clicável = Text as="span" color="primary-interactive"
// cursor="pointer", separador = Text " / " em neutral-textDisabled, item
// atual (não clicável) = Text as="span" color="neutral-textLow", sem negrito.
export default function Breadcrumb({ items }) {
  return (
    <Box display="flex" alignItems="center" gap="1">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Text as="span" color="neutral-textDisabled"> / </Text>}
          {item.onClick ? (
            <Text as="span" color="primary-interactive" cursor="pointer" onClick={item.onClick}>
              {item.label}
            </Text>
          ) : (
            <Text as="span" color="neutral-textLow">
              {item.label}
            </Text>
          )}
        </React.Fragment>
      ))}
    </Box>
  );
}
