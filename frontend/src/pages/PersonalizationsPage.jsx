import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Card, Text, Title } from '@nimbus-ds/components';

export default function PersonalizationsPage() {
  const { t } = useTranslation();

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <Title as="h2">{t('dashboard.personalizations.title')}</Title>
      <Card>
        <Card.Body>
          <Text color="neutral-textLow">{t('common.comingSoon')}</Text>
        </Card.Body>
      </Card>
    </Box>
  );
}
