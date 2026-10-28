import React from 'react';

// Miniatura ilustrativa de cada modelo de personalização — um esquema simples
// do que o cliente vê na vitrine (texto/ícone sobre fundo ou pattern). Puramente
// decorativo (aria-hidden); a descrição textual continua no card do ModeloField.
const FRAME = { fill: '#F3F4F6', stroke: '#D1D5DB' };
const INK = '#374151';
const ACCENT = '#6366F1';
const DOT = '#D1D5DB';

function Frame({ children, patterned }) {
  return (
    <svg viewBox="0 0 72 48" width="72" height="48" role="img" aria-hidden="true">
      <rect x="1" y="1" width="70" height="46" rx="5" fill={FRAME.fill} stroke={FRAME.stroke} />
      {patterned && (
        <g fill={DOT}>
          {[14, 30, 46, 58].map((x) =>
            [14, 26, 38].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />)
          )}
        </g>
      )}
      {children}
    </svg>
  );
}

function Star({ cx, cy, r = 6 }) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r / 2.3;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`);
  }
  return <polygon points={pts.join(' ')} fill={ACCENT} />;
}

function Text({ x, y, size = 16, children }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={size}
      fontFamily="Georgia, 'Times New Roman', serif"
      fontStyle="italic"
      fill={INK}
    >
      {children}
    </text>
  );
}

export default function ModeloThumb({ modeloKey }) {
  switch (modeloKey) {
    case 'mesclado':
      return (
        <Frame>
          <Star cx={36} cy={16} />
          <Text x={36} y={38}>Aa</Text>
        </Frame>
      );
    case 'textoSomente':
      return (
        <Frame>
          <Text x={36} y={31} size={20}>Aa</Text>
        </Frame>
      );
    case 'centralizado':
      return (
        <Frame patterned>
          <Text x={36} y={31} size={18}>Aa</Text>
        </Frame>
      );
    case 'textoDuplicado':
      return (
        <Frame patterned>
          <Text x={36} y={20} size={13}>Aa</Text>
          <Text x={36} y={40} size={13}>Aa</Text>
        </Frame>
      );
    default:
      return (
        <svg viewBox="0 0 72 48" width="72" height="48" role="img" aria-hidden="true">
          <rect x="1" y="1" width="70" height="46" rx="5" fill="#FFFFFF" stroke={FRAME.stroke} strokeDasharray="4 3" />
          <line x1="22" y1="24" x2="50" y2="24" stroke={DOT} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}
