import React from 'react';
import { Box, Icon, Link, Text, Title } from '@nimbus-ds/components';

export default function QuickLinkCard({ icon, title, description, actionLabel, onAction }) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      gap="4"
      padding="6"
      borderRadius="2"
      backgroundColor="neutral-surface"
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        width="56px"
        height="56px"
        borderRadius="2"
        backgroundColor="primary-surface"
      >
        <Icon source={icon} color="primary-interactive" size="large" />
      </Box>
      <Box display="flex" flexDirection="column" gap="1">
        <Title as="h4">{title}</Title>
        {description && <Text color="neutral-textLow">{description}</Text>}
      </Box>
      <Link as="button" appearance="primary" onClick={onAction}>
        {actionLabel}
      </Link>
    </Box>
  );
}
