import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Title } from '@nimbus-ds/components';
import { BoxUnpackedIcon, EditIcon } from '@nimbus-ds/icons';
import QuickLinkCard from '../components/QuickLinkCard.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card>
      <Card.Body>
        <Box display="flex" flexDirection="column" gap="4">
          <Breadcrumb items={[{ label: t('common.home') }]} />
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
