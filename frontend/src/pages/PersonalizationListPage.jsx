import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Text,
  Title,
  Button,
  Card,
  Modal,
  Table,
  Input,
  Spinner,
  Alert,
  Pagination,
  Tag,
  Radio,
} from '@nimbus-ds/components';
import { DragDotsIcon } from '@nimbus-ds/icons';
import api from '../services/api.js';
import ColorInput from '../components/ColorInput.jsx';
import ImageUploadInput from '../components/ImageUploadInput.jsx';
import FontPicker from '../components/FontPicker.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';
import ActionsMenu from '../components/ActionsMenu.jsx';
import PersonalizationValuePreview from '../components/PersonalizationValuePreview.jsx';
import { registerFont, cssFontFamily } from '../lib/fontRegistry.js';

const PAGE_SIZE = 20;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // mesmo limite do multer no backend

function emptyForm(valueType, colorCount) {
  if (valueType === 'image') {
    return { titulo: '', imagemFile: null, ativo: true, posicao: '' };
  }
  if (valueType === 'font') {
    return { titulo: '', fontCatalogItemId: null, ativo: true, posicao: '' };
  }
  return {
    titulo: '',
    valor: colorCount === 1 ? '#000000' : Array.from({ length: colorCount }, () => '#000000'),
    ativo: true,
    posicao: '',
  };
}

// Tela genérica de gestão de um catálogo de personalização (Cores de Fonte,
// Conjuntos de Cores, Ícones, etc.) — Título e Valor são imutáveis após a
// criação (mesma regra do legado, replicada no backend): o modal de edição só
// mostra Situação e Posição. `valueType` decide se o valor é cor(es) ou uma
// imagem enviada (URL do R2 após upload).
export default function PersonalizationListPage({ categoria, valueType = 'color', colorCount, imageAccept = 'image/png' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const categoriaLabel = t(`personalizacoes.categorias.${categoria}.title`);
  const categoriaSingular = t(`personalizacoes.categorias.${categoria}.titleSingular`);

  const [items, setItems] = useState([]);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState('create'); // create | edit
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => emptyForm(valueType, colorCount));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [draggedId, setDraggedId] = useState(null);

  // Reordenar por arraste só faz sentido vendo a lista completa e em ordem
  // real — desliga com busca ativa ou mais de 1 página, pra não escrever uma
  // posicao sequencial que não reflita o conjunto todo.
  const canReorder = !search && pageCount <= 1 && items.length > 1;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadItems = useCallback(async (pageArg, searchArg) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/personalizations', {
        params: { categoria, page: pageArg, limit: PAGE_SIZE, search: searchArg || undefined },
      });
      setItems(data.data || []);
      setPageCount(data.meta?.totalPages || 1);
    } catch {
      setError(t('personalizationItems.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [categoria, t]);

  useEffect(() => {
    loadItems(page, search);
  }, [loadItems, page, search]);

  useEffect(() => {
    if (categoria !== 'fontes') return;
    for (const item of items) {
      if (!item.fontFamily || !item.fontWebfontUrl) continue;
      registerFont(item.fontFamily, item.fontWebfontUrl);
    }
  }, [items, categoria]);

  // Pré-carrega o catálogo inteiro assim que a tela de Fontes abre — não
  // espera o usuário clicar em "Cadastrar" pra só então começar a baixar as
  // ~50 webfonts.
  useEffect(() => {
    if (categoria !== 'fontes') return;
    let cancelled = false;
    api.get('/api/font-catalog').then(({ data }) => {
      if (cancelled) return;
      for (const entry of data?.fonts || []) registerFont(entry.family, entry.webfontUrl);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [categoria]);

  async function openCreate() {
    setMode('create');
    setEditingId(null);
    setSaveError('');

    let nextPosicao = '';
    try {
      const { data } = await api.get('/api/personalizations/max-posicao', { params: { categoria } });
      nextPosicao = String((data.maxPosicao || 0) + 1);
    } catch {
      // falha ao buscar a próxima posicao — deixa em branco, mesmo comportamento de antes
    }

    setForm({ ...emptyForm(valueType, colorCount), posicao: nextPosicao });
    setModalOpen(true);
  }

  function openEdit(item) {
    setMode('edit');
    setEditingId(item.id);
    setForm({ ...emptyForm(valueType, colorCount), ativo: item.ativo, posicao: String(item.posicao ?? '') });
    setSaveError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSaveError('');
  }

  async function handleDelete(item) {
    if (!window.confirm(t('personalizationItems.confirmDelete', { titulo: item.titulo }))) return;
    try {
      await api.delete(`/api/personalizations/${item.id}`);
      await loadItems(page, search);
    } catch {
      setError(t('personalizationItems.errorDelete'));
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  async function handleDrop(targetId) {
    const fromId = draggedId;
    setDraggedId(null);
    if (fromId === null || fromId === targetId) return;

    const fromIndex = items.findIndex((i) => i.id === fromId);
    const toIndex = items.findIndex((i) => i.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setItems(reordered);

    try {
      await api.put('/api/personalizations/reorder', { categoria, order: reordered.map((i) => i.id) });
      setItems(reordered.map((i, idx) => ({ ...i, posicao: idx + 1 })));
    } catch {
      setError(t('personalizationItems.errorReorder'));
      await loadItems(page, search);
    }
  }

  function validate() {
    if (mode !== 'create') return null;
    if (!form.titulo.trim()) return t('personalizationItems.requiredTitulo');
    if (valueType === 'font') {
      if (!form.fontCatalogItemId) return t('personalizationItems.requiredFonte');
      return null;
    }
    if (valueType === 'image') {
      if (!form.imagemFile) return t('personalizationItems.requiredImagem');
      if (form.imagemFile.size > MAX_IMAGE_SIZE) return t('personalizationItems.imagemTooLarge');
      return null;
    }
    const colors = colorCount === 1 ? [form.valor] : form.valor;
    if (!colors.every((c) => HEX_RE.test(c))) return t('personalizationItems.invalidCor');
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const posicao = form.posicao === '' ? 0 : Number(form.posicao);
      if (mode === 'create') {
        if (valueType === 'image') {
          const fd = new FormData();
          fd.append('categoria', categoria);
          fd.append('titulo', form.titulo.trim());
          fd.append('posicao', String(posicao));
          fd.append('imagem', form.imagemFile);
          await api.post('/api/personalizations', fd, { headers: { 'Content-Type': undefined } });
        } else if (valueType === 'font') {
          await api.post('/api/personalizations', {
            categoria,
            titulo: form.titulo.trim(),
            fontCatalogItemId: form.fontCatalogItemId,
            posicao,
          });
        } else {
          await api.post('/api/personalizations', {
            categoria,
            titulo: form.titulo.trim(),
            valor: form.valor,
            posicao,
          });
        }
      } else {
        await api.put(`/api/personalizations/${editingId}`, { ativo: form.ativo, posicao });
      }
      closeModal();
      await loadItems(page, search);
    } catch {
      setSaveError(t('personalizationItems.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <Card.Body>
        <Box display="flex" flexDirection="column" gap="4">
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="2">
            <Box display="flex" flexDirection="column" gap="1">
              <Breadcrumb items={[
                { label: t('common.home'), onClick: () => navigate('/') },
                { label: t('personalizacoes.title'), onClick: () => navigate('/personalizacoes') },
                { label: categoriaLabel },
              ]} />
              <Title as="h3">{categoriaLabel}</Title>
            </Box>
            <Button appearance="primary" onClick={openCreate}>
              {t('personalizationItems.createButton', { categoria: categoriaSingular })}
            </Button>
          </Box>

          <Box maxWidth="360px">
            <Input
              placeholder={t('personalizationItems.searchPlaceholder', { categoria: categoriaSingular })}
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
          ) : items.length === 0 ? (
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
                {search ? t('personalizationItems.searchEmpty') : t('personalizationItems.empty')}
              </Text>
            </Box>
          ) : (
            <Box overflowX="auto">
              <Table>
                <Table.Head>
                  <Table.Row>
                    {canReorder && <Table.Cell as="th" />}
                    <Table.Cell as="th">{t('personalizationItems.colPosicao')}</Table.Cell>
                    <Table.Cell as="th">{t('personalizationItems.colTitulo')}</Table.Cell>
                    <Table.Cell as="th">{t('personalizationItems.colValor')}</Table.Cell>
                    <Table.Cell as="th">{t('personalizationItems.colSituacao')}</Table.Cell>
                    <Table.Cell as="th">#</Table.Cell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {items.map((item) => (
                    <Table.Row
                      key={item.id}
                      draggable={canReorder}
                      onDragStart={canReorder ? () => setDraggedId(item.id) : undefined}
                      onDragOver={canReorder ? handleDragOver : undefined}
                      onDrop={canReorder ? () => handleDrop(item.id) : undefined}
                      style={draggedId === item.id ? { opacity: 0.5 } : undefined}
                    >
                      {canReorder && (
                        <Table.Cell>
                          <Box cursor="grab" display="flex" title={t('personalizationItems.dragToReorder')}>
                            <DragDotsIcon />
                          </Box>
                        </Table.Cell>
                      )}
                      <Table.Cell>
                        <Text>{item.posicao}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontWeight="bold">{item.titulo}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <PersonalizationValuePreview item={item} valueType={valueType} categoria={categoria} />
                      </Table.Cell>
                      <Table.Cell>
                        <Tag appearance={item.ativo ? 'success' : 'danger'}>
                          {item.ativo ? t('personalizationItems.ativo') : t('personalizationItems.inativo')}
                        </Tag>
                      </Table.Cell>
                      <Table.Cell>
                        <ActionsMenu
                          items={[
                            { label: t('personalizationItems.editar'), onClick: () => openEdit(item) },
                            { label: t('personalizationItems.excluir'), onClick: () => handleDelete(item), danger: true },
                          ]}
                        />
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
        <Modal.Header
          title={
            mode === 'create'
              ? t('personalizationItems.modalCreateTitle', { categoria: categoriaSingular })
              : t('personalizationItems.modalEditTitle', { categoria: categoriaSingular })
          }
        />
        <Modal.Body padding="base">
          <Box display="flex" flexDirection="column" gap="4">
            {saveError && (
              <Alert appearance="danger">
                <Text>{saveError}</Text>
              </Alert>
            )}

            {mode === 'create' && (
              <>
                <Box display="flex" flexDirection="column" gap="1">
                  <Text as="label" htmlFor="titulo" fontWeight="bold" fontSize="caption">
                    {t('personalizationItems.fieldTitulo')}
                  </Text>
                  <Input
                    id="titulo"
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  />
                </Box>

                {valueType === 'font' ? (
                  <Box display="flex" flexDirection="column" gap="1">
                    <Text fontWeight="bold" fontSize="caption">
                      {t('personalizationItems.fieldFonte')}
                    </Text>
                    <FontPicker
                      value={form.fontCatalogItemId}
                      onChange={(id) => setForm((f) => ({ ...f, fontCatalogItemId: id }))}
                    />
                  </Box>
                ) : valueType === 'image' ? (
                  <Box display="flex" flexDirection="column" gap="2">
                    <Text fontWeight="bold" fontSize="caption">
                      {t('personalizationItems.fieldImagem')}
                    </Text>
                    <ImageUploadInput
                      file={form.imagemFile}
                      onChange={(f) => setForm((prev) => ({ ...prev, imagemFile: f }))}
                      accept={imageAccept}
                      tiled={categoria === 'patterns'}
                    />
                    <Alert appearance="primary" title={t(`personalizacoes.categorias.${categoria}.uploadHint.title`)}>
                      <Box display="flex" flexDirection="column" gap="1">
                        <Text>• {t(`personalizacoes.categorias.${categoria}.uploadHint.format`)}</Text>
                        <Text>• {t(`personalizacoes.categorias.${categoria}.uploadHint.dimensions`)}</Text>
                        <Text>• {t(`personalizacoes.categorias.${categoria}.uploadHint.density`)}</Text>
                      </Box>
                    </Alert>
                  </Box>
                ) : (
                  <Box display="flex" flexDirection="column" gap="1">
                    <Text fontWeight="bold" fontSize="caption">
                      {colorCount === 1 ? t('personalizationItems.fieldCor') : t('personalizationItems.fieldCores')}
                    </Text>
                    {colorCount === 1 ? (
                      <ColorInput value={form.valor} onChange={(v) => setForm((f) => ({ ...f, valor: v }))} />
                    ) : (
                      <Box display="flex" gap="2" flexWrap="wrap">
                        {form.valor.map((c, i) => (
                          <ColorInput
                            key={i}
                            value={c}
                            onChange={(v) =>
                              setForm((f) => {
                                const valor = [...f.valor];
                                valor[i] = v;
                                return { ...f, valor };
                              })
                            }
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </>
            )}

            <Box display="flex" flexDirection="column" gap="1">
              <Text fontWeight="bold" fontSize="caption">
                {t('personalizationItems.fieldSituacao')}
              </Text>
              <Box display="flex" gap="4">
                <Radio
                  name="ativo"
                  label={t('personalizationItems.inativo')}
                  checked={form.ativo === false}
                  onChange={() => setForm((f) => ({ ...f, ativo: false }))}
                />
                <Radio
                  name="ativo"
                  label={t('personalizationItems.ativo')}
                  checked={form.ativo === true}
                  onChange={() => setForm((f) => ({ ...f, ativo: true }))}
                />
              </Box>
            </Box>

            <Box display="flex" flexDirection="column" gap="1">
              <Text as="label" htmlFor="posicao" fontWeight="bold" fontSize="caption">
                {t('personalizationItems.fieldPosicao')}
              </Text>
              <Input
                id="posicao"
                type="number"
                value={form.posicao}
                onChange={(e) => setForm((f) => ({ ...f, posicao: e.target.value }))}
              />
            </Box>
          </Box>
        </Modal.Body>
        <Modal.Footer>
          <Box display="flex" gap="2" justifyContent="flex-end">
            <Button appearance="neutral" onClick={closeModal} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button appearance="primary" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Spinner size="small" />
              ) : mode === 'create' ? (
                t('personalizationItems.cadastrar')
              ) : (
                t('personalizationItems.atualizar')
              )}
            </Button>
          </Box>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}
