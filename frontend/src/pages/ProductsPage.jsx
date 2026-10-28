import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Text,
  Button,
  Card,
  Modal,
  Table,
  Input,
  Spinner,
  Alert,
  Pagination,
  Tag,
} from '@nimbus-ds/components';
import { BoxUnpackedIcon, SearchIcon } from '@nimbus-ds/icons';
import api from '../services/api.js';
import PageHeader from '../components/PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ActionsMenu from '../components/ActionsMenu.jsx';
import ModeloField from '../components/ModeloField.jsx';
import { modeloKey } from '../lib/modelos.js';

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
      const productId = editing.id;
      const chosen = modeloForm ? Number(modeloForm) : null;
      closeModal();
      await loadProducts(page, search);
      // Acabou de ativar a personalização? Leva direto para selecionar os itens.
      if (chosen) navigate(`/produtos/${productId}/personalizar`);
    } catch {
      setSaveError(t('products.errorSaveModelo'));
    } finally {
      setSaving(false);
    }
  }

  function modeloLabel(modeloId) {
    const key = modeloKey(modeloId);
    return key ? t(`products.modelos.${key}`) : '';
  }

  function actionsFor(product) {
    if (product.modelo) {
      return [
        {
          label: t('products.actionPersonalize'),
          onClick: () => navigate(`/produtos/${product.id}/personalizar`),
        },
        { label: t('products.actionChangeModel'), onClick: () => openDefinirModelo(product) },
      ];
    }
    return [{ label: t('products.actionSetModel'), onClick: () => openDefinirModelo(product) }];
  }

  return (
    <Card>
      <Card.Body>
        <Box display="flex" flexDirection="column" gap="4">
          <PageHeader
            breadcrumb={[
              { label: t('common.home'), onClick: () => navigate('/') },
              { label: t('products.title') },
            ]}
            title={t('products.title')}
            description={t('products.intro')}
          />

          <Box maxWidth="360px">
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
            search ? (
              <EmptyState
                icon={<SearchIcon />}
                title={t('products.searchEmptyTitle')}
                description={t('products.searchEmpty')}
              />
            ) : (
              <EmptyState
                icon={<BoxUnpackedIcon />}
                title={t('products.emptyTitle')}
                description={t('products.emptyDesc')}
              />
            )
          ) : (
            <Box overflowX="auto">
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.Cell as="th">{t('products.colCode')}</Table.Cell>
                    <Table.Cell as="th">{t('products.colProduct')}</Table.Cell>
                    <Table.Cell as="th">{t('products.colModel')}</Table.Cell>
                    <Table.Cell as="th">{t('common.actions')}</Table.Cell>
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
                        {p.modelo ? (
                          <Tag appearance="success">{modeloLabel(p.modelo)}</Tag>
                        ) : (
                          <Tag appearance="warning">{t('products.modelNone')}</Tag>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <ActionsMenu items={actionsFor(p)} />
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
            <Text color="neutral-textLow">{t('products.modalHelp')}</Text>
            {saveError && (
              <Alert appearance="danger">
                <Text>{saveError}</Text>
              </Alert>
            )}
            <ModeloField value={modeloForm} onChange={setModeloForm} />
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
