// Registro idempotente de webfonts via @font-face NATIVO (injetado num
// <style> por família), em vez de reimplementar carregamento em JS com
// FontFace()/Promise. Motivo da troca: a versão anterior (fila própria de
// no máx. N cargas concorrentes via FontFace.load(), com fontFamily só
// aplicado depois da Promise resolver) exigia que TODAS as ~50 fontes
// terminassem de baixar antes de qualquer uma aparecer certa — em rede
// real (mais lenta que localhost) isso deixava a tela inteira parecendo
// quebrada por vários segundos, pior do que o problema original que
// tentava resolver. @font-face nativo elimina essa complexidade: o
// navegador troca pra fonte real assim que ela carrega, sozinho, com sua
// própria fila/priorização otimizada — sem precisar de estado JS (Set de
// "carregadas", Promise por família, retry manual) e sem o efeito
// "tudo parece quebrado até a última terminar".
//
// font-display:swap garante que o texto aparece IMEDIATAMENTE no
// fallback (sans-serif) e troca pra fonte customizada quando ela chegar —
// nunca fica em branco/oculto esperando.
const injected = new Set();

export function registerFont(family, webfontUrl) {
  if (!family || !webfontUrl || injected.has(family)) return;
  injected.add(family);

  const style = document.createElement('style');
  style.textContent = `@font-face { font-family: ${cssFontFamilyName(family)}; src: url("${webfontUrl}") format("woff2"); font-display: swap; }`;
  document.head.appendChild(style);
}

function cssFontFamilyName(family) {
  return `"${family.replace(/"/g, '\\"')}"`;
}

// Nomes de família com espaço+hífen isolado ("Nome - Personal Use") ou
// caracteres como "&" quebram o parser CSS quando atribuídos direto a
// style.fontFamily sem aspas — o navegador rejeita o valor inteiro
// silenciosamente (fontFamily some, sem erro no console) porque um hífen
// sozinho ou "&" não são <custom-ident> válidos fora de uma string CSS.
// Sempre envolver em aspas duplas resolve, já que font-family também
// aceita <string> livremente. Inclui um fallback sans-serif explícito no
// stack — combinado com font-display:swap acima, garante que o texto
// nunca fica em branco/errado, só troca de fonte quando pronto.
export function cssFontFamily(family) {
  return `${cssFontFamilyName(family)}, sans-serif`;
}
