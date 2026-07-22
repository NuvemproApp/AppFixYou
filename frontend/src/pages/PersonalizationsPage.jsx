import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Title } from '@nimbus-ds/components';
import { EditIcon } from '@nimbus-ds/icons';
import QuickLinkCard from '../components/QuickLinkCard.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';

const CATEGORIAS = ['fontes', 'coresDeFonte', 'icones', 'imagensDeFundo', 'conjuntosDeCores', 'patterns'];

const SLUGS = {
  fontes: 'fontes',
  coresDeFonte: 'cores-de-fonte',
  icones: 'icones',
  imagensDeFundo: 'imagens-de-fundo',
  conjuntosDeCores: 'conjuntos-de-cores',
  patterns: 'patterns',
};

export default function PersonalizationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card>
      <Card.Body>
        <Box display="flex" flexDirection="column" gap="4">
          <Breadcrumb items={[
            { label: t('common.home'), onClick: () => navigate('/') },
            { label: t('personalizacoes.title') },
          ]} />
          <Title as="h3">{t('personalizacoes.title')}</Title>

          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
            gap="4"
          >
            {CATEGORIAS.map((categoria) => (
              <QuickLinkCard
                key={categoria}
                icon={<EditIcon />}
                title={t(`personalizacoes.categorias.${categoria}.title`)}
                actionLabel={t(`personalizacoes.categorias.${categoria}.action`)}
                onAction={() => navigate(`/personalizacoes/${SLUGS[categoria]}`)}
              />
            ))}
          </Box>
        </Box>
      </Card.Body>
    </Card>
  );
}
