import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Text,
  Title,
  Button,
  Card,
  Table,
  Checkbox,
  Tabs,
  Spinner,
  Alert,
} from '@nimbus-ds/components';
import api from '../services/api.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import PersonalizationValuePreview from '../components/PersonalizationValuePreview.jsx';
import { modeloKey } from '../lib/modelos.js';
import { registerFont } from '../lib/fontRegistry.js';

// Tipo de valor de cada categoria — decide como renderizar o preview (mesmo
// mapeamento usado em PersonalizationCategoryPage, mas indexado por
// categoria em vez de slug de rota).
const VALUE_TYPE_POR_CATEGORIA = {
  fontes: 'font',
  coresDeFonte: 'color',
  conjuntosDeCores: 'color',
  icones: 'image',
  imagensDeFundo: 'image',
  patterns: 'image',
};

export default function ProductPersonalizationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { productId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modelo, setModelo] = useState(null);
  const [productName, setProductName] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [activeTab, setActiveTab] = useState(0);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/api/products/${productId}/personalizations`);
      setModelo(data.modelo);
      setProductName(data.productName || '');
      setCategorias(data.categorias || []);
      setItems(data.items || []);
      setSelectedIds(new Set((data.items || []).filter((i) => i.selecionado).map((i) => i.id)));
    } catch {
      setError(t('productPersonalizations.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [productId, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Registra as webfonts dos itens da categoria "fontes" pra o preview já
  // renderizar na fonte real — mesmo padrão do PersonalizationListPage.
  useEffect(() => {
    for (const item of items) {
      if (item.categoria !== 'fontes' || !item.fontFamily || !item.fontWebfontUrl) continue;
      registerFont(item.fontFamily, item.fontWebfontUrl);
    }
  }, [items]);

  const itemsByCategoria = useMemo(() => {
    const map = {};
    for (const categoria of categorias) map[categoria] = [];
    for (const item of items) {
      if (map[item.categoria]) map[item.categoria].push(item);
    }
    return map;
  }, [items, categorias]);

  function toggleItem(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInCategoria(categoria) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of itemsByCategoria[categoria] || []) next.add(item.id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      await api.put(`/api/products/${productId}/personalizations`, {
        personalizationItemIds: Array.from(selectedIds),
      });
      setSaveSuccess(true);
    } catch {
      setSaveError(t('productPersonalizations.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  const modeloLabel = modelo ? t(`products.modelos.${modeloKey(modelo)}`) : '';

  if (loading) {
    return (
      <Card>
        <Card.Body>
          <Box display="flex" justifyContent="center" padding="8">
            <Spinner size="large" />
          </Box>
        </Card.Body>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Card.Body>
          <Box display="flex" flexDirection="column" gap="4">
            <Alert appearance="danger">
              <Text>{error}</Text>
            </Alert>
            <Box>
              <Button appearance="neutral" onClick={() => navigate('/produtos')}>
                {t('products.title')}
              </Button>
            </Box>
          </Box>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Body>
        <Box display="flex" flexDirection="column" gap="4">
          <Box display="flex" flexDirection="column" gap="1">
            <Breadcrumb items={[
              { label: t('common.home'), onClick: () => navigate('/') },
              { label: t('products.title'), onClick: () => navigate('/produtos') },
              { label: t('products.actionPersonalize') },
            ]} />
            <Title as="h3">{t('products.actionPersonalize')}</Title>
            <Text color="neutral-textLow">
              {t('productPersonalizations.subtitle', { produto: productName, modelo: modeloLabel })}
            </Text>
          </Box>

          {saveSuccess && (
            <Alert appearance="success">
              <Text>{t('productPersonalizations.saveSuccess')}</Text>
            </Alert>
          )}
          {saveError && (
            <Alert appearance="danger">
              <Text>{saveError}</Text>
            </Alert>
          )}

          <Tabs selected={activeTab} onTabSelect={setActiveTab}>
            {categorias.map((categoria) => {
              const categoriaItems = itemsByCategoria[categoria] || [];
              const valueType = VALUE_TYPE_POR_CATEGORIA[categoria];
              return (
                <Tabs.Item key={categoria} label={t(`personalizacoes.categorias.${categoria}.title`)}>
                  <Box display="flex" flexDirection="column" gap="4" paddingTop="4">
                    {categoriaItems.length === 0 ? (
                      <Box
                        padding="8"
                        display="flex"
                        justifyContent="center"
                        borderColor="neutral-surfaceHighlight"
                        borderStyle="dashed"
                        borderWidth="1"
                        borderRadius="2"
                      >
                        <Text color="neutral-textLow">{t('personalizationItems.empty')}</Text>
                      </Box>
                    ) : (
                      <Box overflowX="auto">
                        <Table>
                          <Table.Head>
                            <Table.Row>
                              <Table.Cell as="th">#</Table.Cell>
                              <Table.Cell as="th">{t('personalizationItems.colTitulo')}</Table.Cell>
                              <Table.Cell as="th">{t('personalizationItems.colValor')}</Table.Cell>
                            </Table.Row>
                          </Table.Head>
                          <Table.Body>
                            {categoriaItems.map((item) => (
                              <Table.Row key={item.id}>
                                <Table.Cell>
                                  <Checkbox
                                    name={`item-${item.id}`}
                                    checked={selectedIds.has(item.id)}
                                    onChange={() => toggleItem(item.id)}
                                  />
                                </Table.Cell>
                                <Table.Cell>
                                  <Text fontWeight="bold">{item.titulo}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                  <PersonalizationValuePreview item={item} valueType={valueType} categoria={categoria} />
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table>
                      </Box>
                    )}

                    {categoriaItems.length > 0 && (
                      <Box>
                        <Button size="small" appearance="neutral" onClick={() => selectAllInCategoria(categoria)}>
                          {t('productPersonalizations.selectAllButton')}
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Tabs.Item>
              );
            })}
          </Tabs>

          <Box display="flex" justifyContent="center" paddingTop="4">
            <Button appearance="primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="small" /> : t('productPersonalizations.saveButton')}
            </Button>
          </Box>
        </Box>
      </Card.Body>
    </Card>
  );
}
