import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Text, Button, Input } from '@nimbus-ds/components';
import api from '../services/api.js';
import { registerFont, cssFontFamily } from '../lib/fontRegistry.js';

// Dropdown customizado (não <select> nativo) para escolher uma fonte do
// catálogo curado. Precisa ser custom porque cada opção deve renderizar seu
// próprio nome de família na própria fonte — <option> nativo só suporta
// font-family por item no Firefox, não no Chrome/Edge. Segue o mesmo padrão
// "Box position=relative + painel absoluto + fechar no mousedown fora" do
// ActionsMenu em PersonalizationListPage.jsx.
//
// Nimbus <Box>/<Text> não repassam style={{}} bruto — só suportam CSS via
// props tipadas próprias (tokens). font-family é uma string arbitrária por
// fonte, sem token equivalente, então qualquer elemento que precise
// renderizar texto em uma fonte específica aqui é <div>/<span> nativo com
// style={{ fontFamily }} real, nunca Nimbus Text/Box.
//
// fontFamily é aplicado incondicionalmente (não espera nenhuma confirmação
// de carregamento) — registerFont injeta @font-face nativo com
// font-display:swap, então o navegador mostra o fallback (sans-serif, já
// incluso em cssFontFamily) e troca sozinho pra fonte real quando ela
// carrega, sem precisar de estado JS pra isso.
export default function FontPicker({ value, onChange, disabled }) {
  const { t } = useTranslation();
  const [fonts, setFonts] = useState([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const { data } = await api.get('/api/font-catalog');
        if (cancelled) return;
        const list = data?.fonts || [];
        setFonts(list);
        list.forEach((entry) => registerFont(entry.family, entry.webfontUrl));
      } catch {
        // catálogo indisponível — picker fica com placeholder, sem quebrar a página
      }
    }
    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = fonts.find((f) => f.id === value);
  const filtered = fonts.filter((f) =>
    f.family.toLowerCase().includes(search.toLowerCase())
  );

  function handleSelect(entry) {
    onChange(entry.id);
    setOpen(false);
    setSearch('');
  }

  return (
    <Box ref={ref} position="relative" display="inline-flex">
      <Button
        appearance="neutral"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span style={{ fontFamily: selected ? cssFontFamily(selected.family) : undefined }}>
          {selected ? selected.family : t('personalizationItems.selectFontPlaceholder')}
        </span>
        {' ▾'}
      </Button>

      {open && (
        <Box
          backgroundColor="neutral-background"
          borderColor="neutral-surfaceHighlight"
          borderStyle="solid"
          borderWidth="1"
          borderRadius="2"
          boxShadow="2"
          position="absolute"
          left="0"
          top="110%"
          zIndex="500"
          minWidth="240px"
          padding="2"
        >
          <Box display="flex" flexDirection="column" gap="2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('personalizationItems.searchFontPlaceholder')}
              autoFocus
            />
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <Box padding="2">
                  <Text color="neutral-textLow" fontSize="caption">
                    {t('personalizationItems.noFontsFound')}
                  </Text>
                </Box>
              ) : (
                filtered.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => handleSelect(entry)}
                    style={{
                      fontFamily: cssFontFamily(entry.family),
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: 4,
                      backgroundColor: entry.id === value ? 'rgba(41, 92, 255, 0.1)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (entry.id !== value) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (entry.id !== value) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {entry.family}
                  </div>
                ))
              )}
            </div>
          </Box>
        </Box>
      )}
    </Box>
  );
}
