import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Text, Tag, Radio } from '@nimbus-ds/components';
import { MODELOS } from '../lib/modelos.js';
import ModeloThumb from './ModeloThumb.jsx';

// Seletor de modelo em cards ilustrados (no lugar de um <select> seco): cada
// opção mostra o nome, uma descrição do que faz na vitrine e os campos que o
// cliente verá. Resolve o maior buraco de UX: antes o lojista escolhia 1 de 4
// nomes genéricos sem saber o que cada um significa.
export default function ModeloField({ value, onChange }) {
  const { t } = useTranslation();
  const options = [{ id: '', key: 'none', categorias: [] }, ...MODELOS];

  return (
    <Box display="flex" flexDirection="column" gap="2">
      {options.map((m) => {
        const idStr = String(m.id);
        const selected = String(value ?? '') === idStr;
        const name = t(`products.modelos.${m.key}`);
        const desc = t(`products.modelosDesc.${m.key}`);
        return (
          <Box
            as="label"
            key={m.key}
            htmlFor={`modelo-${m.key}`}
            display="flex"
            gap="3"
            padding="3"
            borderRadius="2"
            borderStyle="solid"
            borderWidth="1"
            borderColor={selected ? 'primary-interactive' : 'neutral-surfaceHighlight'}
            backgroundColor={selected ? 'primary-surface' : 'neutral-background'}
            cursor="pointer"
          >
            <Box paddingTop="1">
              <Radio
                id={`modelo-${m.key}`}
                name="modelo"
                checked={selected}
                onChange={() => onChange(idStr)}
              />
            </Box>
            <Box flexShrink="0" display="flex" alignItems="center">
              <ModeloThumb modeloKey={m.key} />
            </Box>
            <Box display="flex" flexDirection="column" gap="1">
              <Text fontWeight="bold">{name}</Text>
              <Text fontSize="caption" color="neutral-textLow">{desc}</Text>
              {m.categorias.length > 0 && (
                <Box display="flex" gap="1" flexWrap="wrap" paddingTop="1">
                  {m.categorias.map((c) => (
                    <Tag key={c} appearance="neutral">
                      {t(`personalizacoes.categorias.${c}.title`)}
                    </Tag>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
