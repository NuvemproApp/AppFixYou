import React from 'react';
import { Box } from '@nimbus-ds/components';
import { cssFontFamily } from '../lib/fontRegistry.js';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Nimbus Box não repassa a prop "style" bruta — só suporta CSS via props
// próprias por propriedade (display, position, etc.) com valores de token.
// Cor arbitrária (hex do usuário) e background-image não têm prop de token
// equivalente, então esses swatches usam <div> nativo em vez de <Box>.
export function ColorSwatch({ value }) {
  const colors = Array.isArray(value) ? value : [value];
  return (
    <Box display="flex" gap="1">
      {colors.map((c, i) => (
        <div
          key={i}
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: HEX_RE.test(c) ? c : '#e5e7eb',
            border: '1px solid rgba(0,0,0,0.15)',
          }}
        />
      ))}
    </Box>
  );
}

// Pattern é usado como preenchimento repetido — mostra em mosaico em vez de
// uma imagem única contida, pra dar a real ideia de como ele fica aplicado.
export function PatternSwatch({ src, alt }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: 4,
        backgroundImage: `url(${src})`,
        backgroundRepeat: 'repeat',
        backgroundSize: '12px 12px',
      }}
      title={alt}
    />
  );
}

// Preview do valor de um PersonalizationItem, de acordo com o valueType da
// categoria (cor, cores, imagem/pattern ou fonte) — usado tanto na tela de
// catálogo (PersonalizationListPage) quanto na de seleção por produto
// (ProductPersonalizationsPage), pra manter a mesma aparência nas duas.
export default function PersonalizationValuePreview({ item, valueType, categoria }) {
  if (valueType === 'font') {
    return (
      <span style={{ fontFamily: item.fontFamily ? cssFontFamily(item.fontFamily) : undefined, fontSize: 16 }}>
        {item.fontFamily || item.titulo}
      </span>
    );
  }
  if (valueType === 'image') {
    return categoria === 'patterns' ? (
      <PatternSwatch src={item.valor} alt={item.titulo} />
    ) : (
      <img src={item.valor} alt={item.titulo} style={{ width: 32, height: 32, objectFit: 'contain' }} />
    );
  }
  return <ColorSwatch value={item.valor} />;
}
