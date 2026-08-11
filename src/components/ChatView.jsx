import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Trash2,
  Plus,
  Paperclip,
  X,
  Edit2,
  Clock,
  ShieldCheck,
  Check,
  FileText,
  RefreshCw,
} from 'lucide-react';
import {
  getChatSessions,
  getActiveSessionId,
  saveActiveSessionId,
  createNewSession,
  updateSessionMessages,
  deleteSession,
  resetChatSessions,
} from '../services/storage';
import { sendGeminiChatMessage } from '../services/geminiApi';

export default function ChatView({ settings, onNavigateToSettings }) {
  const [sessions, setSessions] = useState(() => getChatSessions());
  const [activeSessionId, setActiveSessionIdState] = useState(() => {
    const id = getActiveSessionId();
    const list = getChatSessions();
    if (id && list.some((s) => s.id === id)) return id;
    return list[0]?.id || '';
  });

  const validSessions = Array.isArray(sessions) && sessions.length > 0 ? sessions : getChatSessions();
  const activeSession = validSessions.find((s) => s.id === activeSessionId) || validSessions[0] || {};
  const messages = Array.isArray(activeSession.messages) ? activeSession.messages : [];

  const [inputText, setInputText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);

  const messagesEndRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const hasGeminiKey = Boolean(
    settings && settings.geminiApiKey && settings.geminiApiKey.trim()
  );

  const scrollToBottom = () => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      // Ignore scroll errors
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Live Timer tick effect
  useEffect(() => {
    if (isLoading) {
      setLiveSeconds(0);
      timerRef.current = setInterval(() => {
        setLiveSeconds((prev) => parseFloat((prev + 0.1).toFixed(1)));
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading]);

  const handleSelectSession = (id) => {
    setActiveSessionIdState(id);
    saveActiveSessionId(id);
  };

  const handleCreateNewSession = () => {
    try {
      const { newSession, sessions: updated } = createNewSession();
      setSessions(updated);
      setActiveSessionIdState(newSession.id);
    } catch (e) {
      console.error('Error creating new session:', e);
    }
  };

  const handleDeleteCurrentSession = () => {
    try {
      if (validSessions.length <= 1) {
        const updatedMessages = [
          {
            id: '1',
            sender: 'assistant',
            text: 'تم إعادة تهيئة المحادثة الرئيسية.',
            timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ];
        const updated = updateSessionMessages(activeSession.id, updatedMessages);
        setSessions([...updated]);
        return;
      }

      const { activeId, sessions: updated } = deleteSession(activeSession.id);
      setSessions(updated);
      setActiveSessionIdState(activeId);
    } catch (e) {
      console.error('Error deleting current session:', e);
    }
  };

  const handleResetAllChats = () => {
    const defaultSessions = resetChatSessions();
    setSessions(defaultSessions);
    setActiveSessionIdState(defaultSessions[0].id);
    setErrorMessage(null);
  };

  const handleFileUpload = (e) => {
    try {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result || '';
          setAttachedFiles((prev) => [
            ...prev,
            {
              id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              name: file.name,
              size: (file.size / 1024).toFixed(1) + ' KB',
              type: file.type || 'ملف',
              content: typeof content === 'string' ? content : 'محتوى ملف ثنائي',
            },
          ]);
        };
        if (file.type && file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });

      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('File upload error:', err);
    }
  };

  const handleRemoveAttachedFile = (fileId) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleSend = async (textToSend) => {
    const query = textToSend || inputText;
    if ((!query.trim() && attachedFiles.length === 0) || isLoading) return;

    if (!hasGeminiKey) {
      setErrorMessage(
        'مفتاح Gemini API غير مضاف. يُرجى الانتقال إلى الإعدادات وإدخال المفتاح أولاً.'
      );
      return;
    }

    setErrorMessage(null);
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: query.trim() || 'تحليل الملفات المرفقة',
      attachedFiles: [...attachedFiles],
      timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const newMessages = [...messages, userMsg];
    const updatedSessions = updateSessionMessages(activeSession.id, newMessages);
    setSessions([...updatedSessions]);

    if (!textToSend) setInputText('');
    const filesForApi = [...attachedFiles];
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      const res = await sendGeminiChatMessage(
        settings.geminiApiKey,
        newMessages,
        query || 'تحليل الملفات المرفقة',
        settings.tavilyApiKey,
        filesForApi
      );

      setIsLoading(false);

      if (res && res.success) {
        const assistantMsg = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: typeof res.text === 'string' ? res.text : String(res.text || ''),
          usedSearch: Boolean(res.usedSearch),
          durationSeconds: res.durationSeconds ? String(res.durationSeconds) : null,
          timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        const finalMessages = [...newMessages, assistantMsg];
        const saved = updateSessionMessages(activeSession.id, finalMessages);
        setSessions([...saved]);
      } else {
        setErrorMessage(res?.error || 'حدث خطأ أثناء معالجة الطلب.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage(`حدث خطأ غير متوقع: ${err.message}`);
    }
  };

  const handleRegenerateResponse = async (assistantMsgId) => {
    if (isLoading || !hasGeminiKey) return;
    const msgIdx = messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIdx < 0) return;

    const historyUpToTarget = messages.slice(0, msgIdx);
    const targetUserMsg = historyUpToTarget[historyUpToTarget.length - 1];

    const queryText = targetUserMsg ? (typeof targetUserMsg.text === 'string' ? targetUserMsg.text : String(targetUserMsg.text || '')) : 'إعادة توليد الإجابة';
    const filesForApi = targetUserMsg?.attachedFiles || [];

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await sendGeminiChatMessage(
        settings.geminiApiKey,
        historyUpToTarget,
        queryText,
        settings.tavilyApiKey,
        filesForApi
      );

      setIsLoading(false);

      if (res && res.success) {
        const regeneratedMsg = {
          id: assistantMsgId,
          sender: 'assistant',
          text: typeof res.text === 'string' ? res.text : String(res.text || ''),
          usedSearch: Boolean(res.usedSearch),
          durationSeconds: res.durationSeconds ? String(res.durationSeconds) : null,
          timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isRegenerated: true,
        };

        const newMsgs = [...messages];
        newMsgs[msgIdx] = regeneratedMsg;

        const saved = updateSessionMessages(activeSession.id, newMsgs);
        setSessions([...saved]);
      } else {
        setErrorMessage(res?.error || 'تعذر إعادة التوليد.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage(`حدث خطأ أثناء إعادة التوليد: ${err.message}`);
    }
  };

  const handleDeleteMessage = (msgId) => {
    const filtered = messages.filter((m) => m && m.id !== msgId);
    const updated = updateSessionMessages(activeSession.id, filtered);
    setSessions([...updated]);
  };

  const handleStartEditMessage = (msg) => {
    if (!msg) return;
    setEditingMessageId(msg.id);
    setEditText(typeof msg.text === 'string' ? msg.text : String(msg.text || ''));
  };

  const handleSaveEditedMessage = (msgId) => {
    if (!editText.trim()) return;
    const updatedMsgs = messages.map((m) =>
      m && m.id === msgId ? { ...m, text: editText.trim(), isEdited: true } : m
    );
    const updatedSessions = updateSessionMessages(activeSession.id, updatedMsgs);
    setSessions([...updatedSessions]);
    setEditingMessageId(null);
    setEditText('');
  };

  const handleQuickTagClick = (prompt) => {
    setInputText(prompt);
    handleSend(prompt);
  };

  return (
    <div className="chat-view">
      {/* System Prompt Banner & Key Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-pill)',
          padding: '8px 20px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}
        >
          <ShieldCheck size={18} style={{ color: 'var(--status-on-time)' }} />
          <span>
            النظام المعتمد (System Prompt):{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              2026-05-28-claude-opus-4.8 (ثابت وغير قابل للتعديل)
            </strong>
          </span>
        </div>

        {!hasGeminiKey && (
          <button
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '4px 12px' }}
            onClick={onNavigateToSettings}
          >
            <AlertCircle size={14} style={{ color: 'var(--status-late)' }} />
            <span>مفتاح Gemini غائب (الانتقال للإعدادات)</span>
          </button>
        )}
      </div>

      <div className="chat-layout">
        {/* Chat Sessions History Sidebar */}
        <div className="chat-sidebar">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                fontWeight: '700',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <MessageSquare size={18} />
              <span>سجل المحادثات</span>
            </div>

            <button
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={handleCreateNewSession}
              title="بدء محادثة جديدة"
              id="new-chat-btn"
            >
              <Plus size={16} />
              <span>جديدة</span>
            </button>
          </div>

          {/* Sessions List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            {validSessions.map((sess) => (
              <div
                key={sess.id}
                onClick={() => handleSelectSession(sess.id)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor:
                    sess.id === activeSession.id
                      ? 'var(--bg-elevated)'
                      : 'transparent',
                  border:
                    sess.id === activeSession.id
                      ? '1px solid var(--border-focus)'
                      : '1px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  color:
                    sess.id === activeSession.id
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {typeof sess.title === 'string' ? sess.title : 'محادثة'}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="btn-secondary btn-danger"
              style={{ width: '100%', fontSize: '0.82rem', padding: '8px 12px' }}
              onClick={handleDeleteCurrentSession}
              id="delete-session-btn"
            >
              <Trash2 size={15} />
              <span>حذف المحادثة الحالية</span>
            </button>

            <button
              className="btn-secondary"
              style={{ width: '100%', fontSize: '0.78rem', padding: '6px 12px' }}
              onClick={handleResetAllChats}
              title="تعديل في حال وجود تعثر"
            >
              <RefreshCw size={14} />
              <span>إعادة تهيئة السجل</span>
            </button>
          </div>
        </div>

        {/* Main Active Chat Area */}
        <div className="chat-main">
          {/* Chat Messages Window */}
          <div className="chat-messages">
            {messages.map((msg) => {
              if (!msg) return null;
              const safeText = typeof msg.text === 'string' ? msg.text : String(msg.text || '');

              return (
                <div key={msg.id} className={`message-bubble ${msg.sender === 'user' ? 'user' : 'assistant'}`}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                      fontSize: '0.75rem',
                      opacity: 0.85,
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {msg.sender === 'user' ? <User size={14} /> : <Bot size={14} />}
                      <span>{msg.sender === 'user' ? 'أنت' : 'Claude / Gemini AI'}</span>
                      <span>• {msg.timestamp || ''}</span>

                      {msg.usedSearch && (
                        <span
                          style={{
                            backgroundColor: 'var(--status-on-time-bg)',
                            color: 'var(--status-on-time)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                          }}
                        >
                          بحث ويب حي عبر Tavily
                        </span>
                      )}

                      {msg.durationSeconds && (
                        <span
                          style={{
                            backgroundColor: 'var(--bg-elevated)',
                            color: 'var(--accent-blue)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          مدة الرد: {msg.durationSeconds} ثانية
                        </span>
                      )}

                      {msg.isEdited && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          (معدلة)
                        </span>
                      )}
                    </div>

                    {/* Actions: Edit, Regenerate & Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {msg.sender === 'user' && (
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleStartEditMessage(msg)}
                          title="تعديل الطلب"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {msg.sender === 'assistant' && (
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleRegenerateResponse(msg.id)}
                          disabled={isLoading}
                          title="إعادة توليد الرد"
                        >
                          <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
                        </button>
                      )}
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="حذف هذه الرسالة"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Attached Files rendering */}
                  {Array.isArray(msg.attachedFiles) && msg.attachedFiles.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      {msg.attachedFiles.map((f, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: '0.75rem',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <FileText size={14} />
                          <span>
                            {f.name} ({f.size})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Editing view vs Normal text */}
                  {editingMessageId === msg.id ? (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        style={{ fontSize: '0.9rem', padding: '6px 12px' }}
                      />
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleSaveEditedMessage(msg.id)}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => setEditingMessageId(null)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div>{safeText}</div>
                  )}
                </div>
              );
            })}

            {/* Live Loading State & Live Timer Counter */}
            {isLoading && (
              <div className="message-bubble assistant">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} className="spin" />
                    <span>جاري التفكير وصياغة الرد...</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      color: 'var(--accent-blue)',
                      fontWeight: '700',
                    }}
                  >
                    <Clock size={14} />
                    <span>
                      {typeof liveSeconds === 'number'
                        ? liveSeconds.toFixed(1)
                        : '0.0'}{' '}
                      ثانية
                    </span>
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div
                style={{
                  backgroundColor: 'var(--status-qada-bg)',
                  color: 'var(--status-qada)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                }}
              >
                {errorMessage}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Attached Files Preview Chips Container */}
          {attachedFiles.length > 0 && (
            <div
              style={{
                padding: '8px 20px',
                backgroundColor: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    fontSize: '0.78rem',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-pill)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <FileText size={14} />
                  <span>
                    {file.name} ({file.size})
                  </span>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleRemoveAttachedFile(file.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div className="chat-input-bar">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              multiple
            />
            <button
              className="btn-secondary"
              style={{ padding: '10px 14px' }}
              onClick={() => fileInputRef.current?.click()}
              title="إضافة ملفات"
              id="attach-file-btn"
            >
              <Paperclip size={18} />
            </button>

            <input
              type="text"
              className="form-input"
              placeholder="اكتب روتينك اليومي، خطتك، أو أي ملف/استفسار هنا..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isLoading}
              id="chat-text-input"
            />
            <button
              className="btn-primary"
              onClick={() => handleSend()}
              disabled={isLoading || (!inputText.trim() && attachedFiles.length === 0)}
              id="chat-send-btn"
            >
              <Send size={18} />
              <span>إرسال</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
