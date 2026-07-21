import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Text,
  Title,
  Button,
  Card,
  Modal,
  Table,
  Select,
  Input,
  Spinner,
  Alert,
  Pagination,
} from '@nimbus-ds/components';
import api from '../services/api.js';

const PAGE_SIZE = 20;

const MODELOS = [
  { id: 1, key: 'mesclado' },
  { id: 2, key: 'textoSomente' },
  { id: 3, key: 'centralizado' },
  { id: 4, key: 'textoDuplicado' },
];

export default function ProductsPage() {
  const { t } = useTranslation();

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // produto selecionado no modal
  const [modeloForm, setModeloForm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Busca é feita na própria API da Nuvemshop (param `q`) — debounce evita
  // uma chamada por tecla digitada.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadProducts = useCallback(async (pageArg, searchArg) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/products', {
        params: { page: pageArg, pageSize: PAGE_SIZE, search: searchArg || undefined },
      });
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setPageCount(data.pageCount || 1);
    } catch {
      setError(t('products.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadProducts(page, search);
  }, [loadProducts, page, search]);

  function openDefinirModelo(product) {
    setEditing(product);
    setModeloForm(product.modelo ? String(product.modelo) : '');
    setSaveError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setSaveError('');
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.put(`/api/products/${editing.id}/modelo`, {
        modelo: modeloForm ? Number(modeloForm) : null,
      });
      closeModal();
      await loadProducts(page, search);
    } catch {
      setSaveError(t('products.errorSaveModelo'));
    } finally {
      setSaving(false);
    }
  }

  function modeloLabel(modeloId) {
    const modelo = MODELOS.find((m) => m.id === modeloId);
    return modelo ? t(`products.modelos.${modelo.key}`) : '';
  }

  return (
    <Card>
      <Card.Body>
        <Box display="flex" flexDirection="column" gap="4">
          <Title as="h2">{t('dashboard.title')}</Title>
          <Title as="h3">{t('products.title')}</Title>

          <Box style={{ maxWidth: 360 }}>
            <Input
              placeholder={t('products.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </Box>

          {error && (
            <Alert appearance="danger">
              <Text>{error}</Text>
            </Alert>
          )}

          {loading ? (
            <Box display="flex" justifyContent="center" padding="8">
              <Spinner size="large" />
            </Box>
          ) : products.length === 0 ? (
            <Box
              padding="8"
              display="flex"
              justifyContent="center"
              borderColor="neutral-surfaceHighlight"
              borderStyle="dashed"
              borderWidth="1"
              borderRadius="2"
            >
              <Text color="neutral-textLow">
                {search ? t('products.searchEmpty') : t('products.empty')}
              </Text>
            </Box>
          ) : (
            <Box style={{ overflowX: 'auto' }}>
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.Cell as="th">{t('products.colCode')}</Table.Cell>
                    <Table.Cell as="th">{t('products.colProduct')}</Table.Cell>
                    <Table.Cell as="th">{t('products.colModel')}</Table.Cell>
                    <Table.Cell as="th">#</Table.Cell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {products.map((p) => (
                    <Table.Row key={p.id}>
                      <Table.Cell>
                        <Text fontWeight="bold">{p.id}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text>{p.name}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text color="neutral-textLow">{modeloLabel(p.modelo)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Button size="small" appearance="neutral" onClick={() => openDefinirModelo(p)}>
                          {t('products.actionSetModel')}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </Box>
          )}

          {!loading && pageCount > 1 && (
            <Box display="flex" justifyContent="center">
              <Pagination activePage={page} pageCount={pageCount} onPageChange={setPage} />
            </Box>
          )}
        </Box>
      </Card.Body>

      <Modal open={modalOpen} onDismiss={closeModal}>
        <Modal.Header title={t('products.modalTitle')} />
        <Modal.Body padding="base">
          <Box display="flex" flexDirection="column" gap="4">
            {saveError && (
              <Alert appearance="danger">
                <Text>{saveError}</Text>
              </Alert>
            )}
            <Box display="flex" flexDirection="column" gap="1">
              <Text as="label" htmlFor="modelo" fontWeight="bold" fontSize="caption">
                {t('products.fieldModel')}
              </Text>
              <Select
                id="modelo"
                name="modelo"
                value={modeloForm}
                onChange={(e) => setModeloForm(e.target.value)}
              >
                <option value="">{t('products.modelos.none')}</option>
                {MODELOS.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {t(`products.modelos.${m.key}`)}
                  </option>
                ))}
              </Select>
            </Box>
          </Box>
        </Modal.Body>
        <Modal.Footer>
          <Box display="flex" gap="2" justifyContent="flex-end">
            <Button appearance="neutral" onClick={closeModal} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button appearance="primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="small" /> : t('common.save')}
            </Button>
          </Box>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}
