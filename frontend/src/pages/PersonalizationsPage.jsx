import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Box, Card } from '@nimbus-ds/components';
import {
  FontIcon,
  FontColorIcon,
  StarIcon,
  PictureIcon,
  ColorPaletteIcon,
  RepeatIcon,
} from '@nimbus-ds/icons';
import QuickLinkCard from '../components/QuickLinkCard.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { CATEGORIAS, SLUGS } from '../lib/categorias.js';

// Ícone distinto por categoria — antes todos usavam o mesmo EditIcon, o que
// deixava os 6 cards indistinguíveis.
const ICONES = {
  fontes: <FontIcon />,
  coresDeFonte: <FontColorIcon />,
  icones: <StarIcon />,
  imagensDeFundo: <PictureIcon />,
  conjuntosDeCores: <ColorPaletteIcon />,
  patterns: <RepeatIcon />,
};

export default function PersonalizationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card>
      <Card.Body>
        <Box display="flex" flexDirection="column" gap="4">
          <PageHeader
            breadcrumb={[
              { label: t('common.home'), onClick: () => navigate('/') },
              { label: t('personalizacoes.title') },
            ]}
            title={t('personalizacoes.title')}
            description={t('personalizacoes.intro')}
          />

          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))"
            gap="4"
          >
            {CATEGORIAS.map((categoria) => (
              <QuickLinkCard
                key={categoria}
                icon={ICONES[categoria]}
                title={t(`personalizacoes.categorias.${categoria}.title`)}
                description={t(`personalizacoes.categorias.${categoria}.description`)}
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
