// Categorias de personalização e seus slugs de rota. Fonte única usada pelo hub
// de Personalizações, pelo dispatcher de categoria e pelos CTAs de estado vazio
// (ex.: "cadastrar itens dessa categoria") espalhados pelas telas.
export const CATEGORIAS = [
  'fontes',
  'coresDeFonte',
  'icones',
  'imagensDeFundo',
  'conjuntosDeCores',
  'patterns',
];

export const SLUGS = {
  fontes: 'fontes',
  coresDeFonte: 'cores-de-fonte',
  icones: 'icones',
  imagensDeFundo: 'imagens-de-fundo',
  conjuntosDeCores: 'conjuntos-de-cores',
  patterns: 'patterns',
};

export function categoriaSlug(categoria) {
  return SLUGS[categoria] ?? null;
}
