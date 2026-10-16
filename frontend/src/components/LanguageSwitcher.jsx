import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@nimbus-ds/components';

const LANGUAGES = [
  { value: 'pt-BR', label: 'Portugu\u00eas' },
  { value: 'es', label: 'Espa\u00f1ol' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <Select
      name="language"
      id="language-switcher"
      value={i18n.language}
      onChange={(e) => {
        try { localStorage.setItem('app_lang_explicit', '1'); } catch { /* noop */ }
        i18n.changeLanguage(e.target.value);
      }}
    >
      {LANGUAGES.map((lang) => (
        <Select.Option key={lang.value} value={lang.value} label={lang.label}>
          {lang.label}
        </Select.Option>
      ))}
    </Select>
  );
}
