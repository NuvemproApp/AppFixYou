const MODELOS = {
  MESCLADO: 1,
  TEXTO_SOMENTE: 2,
  CENTRALIZADO: 3,
  TEXTO_DUPLICADO: 4,
};

const MODELO_IDS = Object.values(MODELOS);

// Categorias de personalização disponíveis por modelo — mesma regra do
// PersonalizacoesProduto do FixYou legado (FixYouController.cs).
const MODELO_CATEGORIAS = {
  [MODELOS.MESCLADO]: ['fontes', 'coresDeFonte', 'icones', 'imagensDeFundo'],
  [MODELOS.TEXTO_SOMENTE]: ['fontes', 'imagensDeFundo', 'conjuntosDeCores'],
  [MODELOS.CENTRALIZADO]: ['fontes', 'coresDeFonte', 'patterns'],
  [MODELOS.TEXTO_DUPLICADO]: ['fontes', 'coresDeFonte', 'patterns'],
};

module.exports = { MODELOS, MODELO_IDS, MODELO_CATEGORIAS };
