import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Card, Text, Title } from '@nimbus-ds/components';

const CATEGORIA_POR_SLUG = {
  fontes: 'fontes',
  'cores-de-fonte': 'coresDeFonte',
  icones: 'icones',
  'imagens-de-fundo': 'imagensDeFundo',
  'conjuntos-de-cores': 'conjuntosDeCores',
  patterns: 'patterns',
};

export default function PersonalizationCategoryPage() {
  const { categoria: slug } = useParams();
  const { t } = useTranslation();
  const categoria = CATEGORIA_POR_SLUG[slug];

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
