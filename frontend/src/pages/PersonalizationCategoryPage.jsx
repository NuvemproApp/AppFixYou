import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Card, Text, Title } from '@nimbus-ds/components';
import PersonalizationListPage from './PersonalizationListPage.jsx';

const CATEGORIA_POR_SLUG = {
  fontes: 'fontes',
  'cores-de-fonte': 'coresDeFonte',
  icones: 'icones',
  'imagens-de-fundo': 'imagensDeFundo',
  'conjuntos-de-cores': 'conjuntosDeCores',
  patterns: 'patterns',
};

// Categorias com tela real implementada — as demais caem no placeholder.
const IMPLEMENTED_SLUGS = {
  'cores-de-fonte': { categoria: 'coresDeFonte', colorCount: 1 },
  'conjuntos-de-cores': { categoria: 'conjuntosDeCores', colorCount: 4 },
};

export default function PersonalizationCategoryPage() {
  const { categoria: slug } = useParams();
  const { t } = useTranslation();
  const categoria = CATEGORIA_POR_SLUG[slug];
  const implemented = IMPLEMENTED_SLUGS[slug];

  if (implemented) {
    return <PersonalizationListPage categoria={implemented.categoria} colorCount={implemented.colorCount} />;
  }

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <Title as="h2">
        {categoria ? t(`personalizacoes.categorias.${categoria}.title`) : t('personalizacoes.title')}
      </Title>
      <Card>
        <Card.Body>
          <Text color="neutral-textLow">{t('common.comingSoon')}</Text>
        </Card.Body>
      </Card>
    </Box>
  );
}
