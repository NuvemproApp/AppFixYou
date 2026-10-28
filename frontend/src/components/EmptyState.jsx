import React from 'react';
import { Box, Text, Title, Button, Icon } from '@nimbus-ds/components';

// Estado vazio padrão do app: ícone num círculo, título, descrição e um CTA
// opcional. Usado em todas as listas (produtos, itens de catálogo, abas por
// produto) no lugar do antigo "Box tracejado com um texto cinza".
export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      padding="8"
      gap="4"
    >
      <Box
        width="96px"
        height="96px"
        borderRadius="full"
        backgroundColor="neutral-surface"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {icon ? (
          <Icon source={icon} color="neutral-textLow" size="large" />
        ) : (
          <Text fontSize="highlight" color="neutral-textDisabled">---</Text>
        )}
      </Box>

      {title && <Title as="h4" textAlign="center">{title}</Title>}
      {description && (
        <Box maxWidth="420px">
          <Text textAlign="center" color="neutral-textLow">{description}</Text>
        </Box>
      )}
      {actionLabel && onAction && (
        <Button appearance="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
