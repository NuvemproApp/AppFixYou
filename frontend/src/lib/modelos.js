// Modelos de personalização de produto do FixYou — mesmos ids usados no
// backend (backend/src/lib/fixyouModelos.js). Mantido separado por camada
// (front/back não compartilham módulos), mas os ids e nomes têm que bater.
export const MODELOS = [
  { id: 1, key: 'mesclado' },
  { id: 2, key: 'textoSomente' },
  { id: 3, key: 'centralizado' },
  { id: 4, key: 'textoDuplicado' },
];

export function modeloKey(modeloId) {
  return MODELOS.find((m) => m.id === modeloId)?.key ?? null;
}
