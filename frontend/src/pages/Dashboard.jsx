import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Title, Text, Icon } from '@nimbus-ds/components';
import { RocketIcon, BoxUnpackedIcon, ColorPaletteIcon } from '@nimbus-ds/icons';
import QuickLinkCard from '../components/QuickLinkCard.jsx';
import StepsGuide from '../components/StepsGuide.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const steps = [
    {
      title: t('dashboard.steps.s1.title'),
      description: t('dashboard.steps.s1.description'),
      actionLabel: t('dashboard.steps.s1.action'),
      onAction: () => navigate('/personalizacoes'),
    },
    {
      title: t('dashboard.steps.s2.title'),
      description: t('dashboard.steps.s2.description'),
      actionLabel: t('dashboard.steps.s2.action'),
      onAction: () => navigate('/produtos'),
    },
    {
      title: t('dashboard.steps.s3.title'),
      description: t('dashboard.steps.s3.description'),
    },
    {
      title: t('dashboard.steps.s4.title'),
      description: t('dashboard.steps.s4.description'),
    },
  ];

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <Card>
        <Card.Body>
          <Box display="flex" flexDirection="column" gap="4">
            <Breadcrumb items={[{ label: t('common.home') }]} />
            <Box display="flex" gap="3" alignItems="center">
              <Box
                flexShrink="0"
                width="48px"
                height="48px"
                borderRadius="2"
                backgroundColor="primary-surface"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Icon source={<RocketIcon />} color="primary-interactive" size="medium" />
              </Box>
              <Box display="flex" flexDirection="column" gap="1">
                <Title as="h2">{t('dashboard.welcomeTitle')}</Title>
                <Text color="neutral-textLow">{t('dashboard.welcomeSubtitle')}</Text>
              </Box>
            </Box>
          </Box>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Box display="flex" flexDirection="column" gap="4">
            <Title as="h3">{t('dashboard.howItWorks')}</Title>
            <StepsGuide steps={steps} />
          </Box>
        </Card.Body>
      </Card>

      <Box
        display="grid"
        gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))"
        gap="4"
      >
        <QuickLinkCard
          icon={<ColorPaletteIcon />}
          title={t('dashboard.personalizations.title')}
          description={t('dashboard.personalizations.description')}
          actionLabel={t('dashboard.personalizations.action')}
          onAction={() => navigate('/personalizacoes')}
        />
        <QuickLinkCard
          icon={<BoxUnpackedIcon />}
          title={t('dashboard.products.title')}
          description={t('dashboard.products.description')}
          actionLabel={t('dashboard.products.action')}
          onAction={() => navigate('/produtos')}
        />
      </Box>
    </Box>
  );
}
