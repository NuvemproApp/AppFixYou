// Modelos de personalização de produto do FixYou — mesmos ids usados no
// backend (backend/src/lib/fixyouModelos.js). Mantido separado por camada
// (front/back não compartilham módulos), mas os ids, nomes e categorias têm
// que bater. `categorias` = quais campos o modelo mostra ao cliente na vitrine
// (fonte da verdade: MODELO_CATEGORIAS no backend).
export const MODELOS = [
  { id: 1, key: 'mesclado', categorias: ['fontes', 'coresDeFonte', 'icones', 'imagensDeFundo'] },
  { id: 2, key: 'textoSomente', categorias: ['fontes', 'imagensDeFundo', 'conjuntosDeCores'] },
  { id: 3, key: 'centralizado', categorias: ['fontes', 'coresDeFonte', 'patterns'] },
  { id: 4, key: 'textoDuplicado', categorias: ['fontes', 'coresDeFonte', 'patterns'] },
];

export function modeloKey(modeloId) {
  return MODELOS.find((m) => m.id === modeloId)?.key ?? null;
}

// Categorias (campos) que o modelo exige/mostra. Usado para explicar ao lojista
// o que cada modelo faz e quais itens ele precisa cadastrar.
export function modeloCategorias(modeloId) {
  return MODELOS.find((m) => m.id === modeloId)?.categorias ?? [];
}
