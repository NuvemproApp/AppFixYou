import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Icon, Link, Text, Title } from '@nimbus-ds/components';
import { BoxUnpackedIcon, EditIcon } from '@nimbus-ds/icons';

function QuickLinkCard({ icon, title, description, actionLabel, onAction }) {
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
        <Text color="neutral-textLow">{description}</Text>
      </Box>
      <Link as="button" appearance="primary" onClick={onAction}>
        {actionLabel}
      </Link>
    </Box>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card>
      <Card.Body>
        <Box display="flex" flexDirection="column" gap="4">
          <Title as="h2">{t('dashboard.title')}</Title>

          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
            gap="4"
          >
            <QuickLinkCard
              icon={<BoxUnpackedIcon />}
              title={t('dashboard.products.title')}
              description={t('dashboard.products.description')}
              actionLabel={t('dashboard.products.action')}
              onAction={() => navigate('/produtos')}
            />
            <QuickLinkCard
              icon={<EditIcon />}
              title={t('dashboard.personalizations.title')}
              description={t('dashboard.personalizations.description')}
              actionLabel={t('dashboard.personalizations.action')}
              onAction={() => navigate('/personalizacoes')}
            />
          </Box>
        </Box>
      </Card.Body>
    </Card>
  );
}
