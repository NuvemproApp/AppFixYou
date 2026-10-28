import React from 'react';
import { Box, Title, Text } from '@nimbus-ds/components';
import Breadcrumb from './Breadcrumb.jsx';

// Cabeçalho de página padronizado: breadcrumb + título (h3, hierarquia única no
// app) + descrição opcional (texto de ajuda) + ação opcional alinhada à direita
// (ex.: botão "Cadastrar"). Mantém todas as telas visualmente consistentes.
export default function PageHeader({ breadcrumb, title, description, action }) {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="flex-start"
      flexWrap="wrap"
      gap="2"
    >
      <Box display="flex" flexDirection="column" gap="1">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        <Title as="h3">{title}</Title>
        {description && (
          <Box maxWidth="640px">
            <Text color="neutral-textLow">{description}</Text>
          </Box>
        )}
      </Box>
      {action && <Box flexShrink="0">{action}</Box>}
    </Box>
  );
}
