import React, { useRef, useEffect, useState } from 'react';
import { Box, Text, Button } from '@nimbus-ds/components';
import { useTranslation } from 'react-i18next';

export default function ImageUploadInput({ file, onChange, accept = 'image/png' }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Box display="flex" alignItems="center" gap="3">
      <Button appearance="neutral" size="small" onClick={() => inputRef.current?.click()}>
        {t('personalizationItems.chooseFile')}
      </Button>
      <Text color="neutral-textLow" fontSize="caption">
        {file ? file.name : t('personalizationItems.noFileChosen')}
      </Text>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        style={{ display: 'none' }}
      />
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          style={{ width: 40, height: 40, objectFit: 'contain', border: '1px solid #d1d5db', borderRadius: 4 }}
        />
      )}
    </Box>
  );
}
