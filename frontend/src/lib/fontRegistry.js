// Registro idempotente de webfonts carregadas dinamicamente via FontFace API.
// Usado tanto pelo FontPicker (preview em cada opção) quanto por páginas de
// listagem que precisam renderizar texto na fonte escolhida pelo usuário.
// Nunca deve lançar — falha ao carregar uma fonte apenas faz o navegador
// cair no fallback padrão, sem quebrar a página.

const registeredFamilies = new Set();

export function registerFont(family, webfontUrl) {
  if (registeredFamilies.has(family)) return;
  registeredFamilies.add(family);

  if (!family || !webfontUrl) return;

  try {
    const fontFace = new FontFace(family, `url("${webfontUrl}")`);
    fontFace
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
      })
      .catch(() => {});
  } catch {
    // FontFace indisponível ou argumentos inválidos — ignora silenciosamente,
    // o navegador usa a fonte padrão de fallback.
  }
}
