import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Button, Text, Title, Sidebar, Input, Textarea, Checkbox, Modal, Tag, Accordion } from '@nimbus-ds/components';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import BrandSymbol from './BrandSymbol.jsx';
import api from '../services/api.js';

function getYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Aspect-ratio 16:9 via truque do padding-bottom (Box do Nimbus não suporta
// aspectRatio; mesma decisão documentada no CLAUDE.md para vídeos).
function VideoFrame({ url }) {
  const { t } = useTranslation();
  const youtubeId = getYouTubeId(url);
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0, borderRadius: 8, overflow: 'hidden', background: '#000' }}>
      {youtubeId ? (
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
          title={t('support.videoTitle')}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      ) : (
        <video
          src={url}
          autoPlay
          controls
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#000' }}
        />
      )}
    </div>
  );
}

function VideoModal({ url, onClose }) {
  const { t } = useTranslation();
  return (
    <Modal open onDismiss={onClose}>
      <Modal.Header title={t('support.videoTitle')} />
      <Modal.Body padding="base">
        <VideoFrame url={url} />
      </Modal.Body>
    </Modal>
  );
}

export default function AppNav() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportData, setSupportData] = useState(null);
  const [videoModal, setVideoModal] = useState(null); // url string | null
  const [tickets, setTickets] = useState(null);        // null = não carregado
  const [tSubject, setTSubject] = useState('');
  const [tMessage, setTMessage] = useState('');
  const [tSending, setTSending] = useState(false);
  const [reply, setReply] = useState({});              // { [ticketId]: texto }
  const [replyingId, setReplyingId] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0); // tickets respondidos (badge)
  const [emailNotifications, setEmailNotifications] = useState(true); // opt-out de e-mail
  const [savingPref, setSavingPref] = useState(false);

  // Resumo de tickets ao montar (badge "respondido" no botão de Suporte).
  useEffect(() => {
    api.get('/api/support/tickets/summary')
      .then((res) => setAnsweredCount(res.data?.answered || 0))
      .catch(() => {});
  }, []);

  // Busca FAQ/config ao abrir; refaz quando o idioma muda (FAQs são por idioma).
  useEffect(() => {
    if (!supportOpen) return;
    api.get('/api/support', { params: { lang: i18n.language } })
      .then((res) => setSupportData(res.data))
      .catch(() => setSupportData({ faqs: [], mainVideoUrl: '', whatsapp: '' }));
  }, [supportOpen, i18n.language]);

  // Carrega os tickets da loja ao abrir o suporte.
  useEffect(() => {
    if (!supportOpen) return;
    loadTickets();
  }, [supportOpen]);

  // Carrega a preferência de e-mail ao abrir o suporte.
  useEffect(() => {
    if (!supportOpen) return;
    api.get('/api/support/preferences')
      .then((res) => setEmailNotifications(res.data?.emailNotifications !== false))
      .catch(() => {});
  }, [supportOpen]);

  const toggleEmailPref = async () => {
    if (savingPref) return;
    const next = !emailNotifications;
    setEmailNotifications(next); // otimista
    setSavingPref(true);
    try {
      await api.put('/api/support/preferences', { emailNotifications: next });
    } catch {
      setEmailNotifications(!next); // reverte em erro
    } finally {
      setSavingPref(false);
    }
  };

  const loadTickets = () => {
    api.get('/api/support/tickets')
      .then((res) => setTickets(res.data.tickets || []))
      .catch(() => setTickets([]));
  };

  const submitTicket = async () => {
    const message = tMessage.trim();
    if (!message || tSending) return;
    setTSending(true);
    try {
      await api.post('/api/support/tickets', { subject: tSubject.trim() || undefined, message });
      setTSubject('');
      setTMessage('');
      loadTickets();
    } catch { /* silencioso */ }
    finally { setTSending(false); }
  };

  const submitReply = async (id) => {
    const message = (reply[id] || '').trim();
    if (!message || replyingId) return;
    setReplyingId(id);
    try {
      await api.post(`/api/support/tickets/${id}/messages`, { message });
      setReply((r) => ({ ...r, [id]: '' }));
      loadTickets();
    } catch { /* silencioso */ }
    finally { setReplyingId(null); }
  };

  const isActive = (path) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  const faqs = supportData?.faqs || [];
  const mainVideoUrl = supportData?.mainVideoUrl || '';
  const whatsapp = supportData?.whatsapp || t('support.whatsappNumber', { defaultValue: '' });
  const youtubeId = getYouTubeId(mainVideoUrl);

  return (
    <>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        padding="4"
        paddingLeft="4"
        paddingRight="4"
        borderColor="neutral-surfaceHighlight"
        borderStyle="solid"
        borderWidth="none"
        borderBottomWidth="1"
        backgroundColor="neutral-background"
      >
        {/* Left nav */}
        <Box display="flex" gap="2" alignItems="center">
          <BrandSymbol height={26} />
          <Button
            appearance={isActive('/') ? 'primary' : 'neutral'}
            onClick={() => navigate('/')}
          >
            {t('nav.dashboard')}
          </Button>
          <Button
            appearance={isActive('/produtos') ? 'primary' : 'neutral'}
            onClick={() => navigate('/produtos')}
          >
            {t('nav.products')}
          </Button>
          <Button
            appearance={isActive('/personalizacoes') ? 'primary' : 'neutral'}
            onClick={() => navigate('/personalizacoes')}
          >
            {t('nav.personalizations')}
          </Button>
        </Box>

        {/* Right nav */}
        <Box display="flex" gap="3" alignItems="center">
          <Button
            appearance={isActive('/billing') ? 'primary' : 'neutral'}
            onClick={() => navigate('/billing')}
          >
            {t('nav.billing')}
          </Button>
          <Button
            appearance="neutral"
            onClick={() => { setSupportOpen(true); setAnsweredCount(0); }}
          >
            <Box display="inline-flex" alignItems="center" gap="2">
              <Text>{t('nav.support')}</Text>
              {answeredCount > 0 && (
                <Tag appearance="danger">{answeredCount > 9 ? '9+' : answeredCount}</Tag>
              )}
            </Box>
          </Button>
          <LanguageSwitcher />
        </Box>
      </Box>

      {/* Support Sidebar */}
      <Sidebar
        open={supportOpen}
        onRemove={() => setSupportOpen(false)}
      >
        <Box display="flex" flexDirection="column" gap="6" padding="6">
          <Title as="h2">{t('support.title')}</Title>

          {/* WhatsApp */}
          {whatsapp && (
            <Box display="flex" flexDirection="column" gap="2">
              <Button
                appearance="primary"
                as="a"
                href={`https://wa.me/${String(whatsapp).replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('support.whatsapp')}
              </Button>
            </Box>
          )}

          {/* Vídeo principal — 16:9 inline, acima do FAQ */}
          <Box display="flex" flexDirection="column" gap="2">
            <Title as="h4">{t('support.videoTitle')}</Title>
            {youtubeId ? (
              <VideoFrame url={mainVideoUrl} />
            ) : mainVideoUrl ? (
              <Button
                appearance="neutral"
                as="a"
                href={mainVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('support.videoTitle')}
              </Button>
            ) : (
              <Box
                padding="4"
                borderColor="neutral-surfaceHighlight"
                borderStyle="dashed"
                borderWidth="1"
                borderRadius="2"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text color="neutral-textDisabled">{t('support.videoPlaceholder', { defaultValue: 'Nenhum vídeo configurado' })}</Text>
              </Box>
            )}
          </Box>

          {/* FAQ — Accordion Nimbus */}
          {faqs.length > 0 && (
            <Box display="flex" flexDirection="column" gap="2">
              <Title as="h4">{t('support.faqTitle', { defaultValue: 'Dúvidas frequentes' })}</Title>
              <Accordion>
                {faqs.map((item) => (
                  <Accordion.Item key={item.id} index={String(item.id)}>
                    <Accordion.Header title={item.question} />
                    <Accordion.Body>
                      <Box display="flex" flexDirection="column" gap="2">
                        <Text fontSize="caption" color="neutral-textLow">{item.answer}</Text>
                        {item.videoUrl && (
                          <Box>
                            <Button appearance="neutral" onClick={() => setVideoModal(item.videoUrl)}>
                              {t('support.viewVideo')}
                            </Button>
                          </Box>
                        )}
                      </Box>
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Box>
          )}

          {/* Tickets — fale com a gente */}
          <Box display="flex" flexDirection="column" gap="3">
            <Title as="h4">{t('support.tickets.title')}</Title>

            {/* Novo ticket */}
            <Box display="flex" flexDirection="column" gap="2">
              <Input
                value={tSubject}
                onChange={(e) => setTSubject(e.target.value)}
                placeholder={t('support.tickets.subjectPlaceholder')}
                maxLength={200}
              />
              <Textarea
                lines={3}
                value={tMessage}
                onChange={(e) => setTMessage(e.target.value)}
                placeholder={t('support.tickets.messagePlaceholder')}
                maxLength={5000}
              />
              <Button appearance="primary" disabled={tSending || !tMessage.trim()} onClick={submitTicket}>
                {tSending ? t('support.tickets.sending') : t('support.tickets.send')}
              </Button>
            </Box>

            {/* Minhas conversas */}
            {Array.isArray(tickets) && tickets.length > 0 && (
              <Box display="flex" flexDirection="column" gap="2">
                <Text fontWeight="bold" fontSize="caption">{t('support.tickets.mine')}</Text>
                {tickets.map((tk) => (
                  <Box
                    key={tk.id}
                    borderColor="neutral-surfaceHighlight"
                    borderStyle="solid"
                    borderWidth="1"
                    borderRadius="2"
                    padding="3"
                    display="flex"
                    flexDirection="column"
                    gap="2"
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center" gap="2">
                      <Text fontWeight="bold" fontSize="caption">{tk.subject || '—'}</Text>
                      <Tag appearance={tk.status === 'answered' ? 'success' : 'neutral'}>
                        {t(`support.tickets.status.${tk.status}`)}
                      </Tag>
                    </Box>
                    {(tk.messages || []).map((m) => (
                      <Box
                        key={m.id}
                        backgroundColor={m.author === 'admin' ? 'primary-surface' : 'neutral-surface'}
                        borderRadius="2"
                        padding="2"
                      >
                        <Text fontSize="caption" color="neutral-textLow">
                          {m.author === 'admin' ? t('support.tickets.us') : t('support.tickets.you')}
                        </Text>
                        <Text fontSize="caption" color="neutral-textHigh">{m.body}</Text>
                      </Box>
                    ))}
                    {tk.status !== 'closed' && (
                      <Box display="flex" gap="1" alignItems="flex-start">
                        <Box flexGrow="1">
                          <Input
                            value={reply[tk.id] || ''}
                            onChange={(e) => setReply((r) => ({ ...r, [tk.id]: e.target.value }))}
                            placeholder={t('support.tickets.replyPlaceholder')}
                            maxLength={5000}
                          />
                        </Box>
                        <Button
                          appearance="neutral"
                          disabled={replyingId === tk.id || !(reply[tk.id] || '').trim()}
                          onClick={() => submitReply(tk.id)}
                        >
                          {t('support.tickets.reply')}
                        </Button>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {/* Preferência de e-mail */}
            <Box paddingTop="1">
              <Checkbox
                name="emailNotify"
                label={t('support.tickets.emailNotify')}
                checked={emailNotifications}
                disabled={savingPref}
                onChange={toggleEmailPref}
              />
            </Box>
          </Box>

          {/* Loading state */}
          {supportOpen && !supportData && (
            <Box display="flex" justifyContent="center" padding="4">
              <Text color="neutral-textDisabled">{t('common.loading', { defaultValue: 'Carregando...' })}</Text>
            </Box>
          )}
        </Box>
      </Sidebar>

      {videoModal && (
        <VideoModal url={videoModal} onClose={() => setVideoModal(null)} />
      )}
    </>
  );
}
