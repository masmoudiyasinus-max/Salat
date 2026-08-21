import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  Send,
  User,
  Sparkles,
  MessageSquare,
  History,
  AlertCircle,
  Trash2,
  Plus,
  Paperclip,
  X,
  Edit2,
  Check,
  FileText,
  RefreshCw,
  Square,
  RotateCcw,
  Info,
  Image as ImageIcon,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  Copy,
  Pause,
  Play,
  SpellCheck,
  Clock,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import {
  getChatSessions,
  saveChatSessions,
  getActiveSessionId,
  saveActiveSessionId,
  createNewSession,
  updateSessionMessages,
  updateSessionTitle,
  deleteSession,
  resetChatSessions,
  getSettings,
  compressImageFile,
} from '../services/storage';
import { sendGeminiChatMessage, generateSessionTitle, generateSessionContextualTitle, correctSpellingText } from '../services/geminiApi';
import { extractMuneerAction, executeSettingsActionDirectly } from '../services/muneerActions';
import { APP_EVENTS } from '../services/prayerConstants';
import { getDailySuggestions, ensureDailySuggestions } from '../services/dailySuggestionsService';

/**
 * Parses inline markdown tokens statically: **bold**, *italic*, `code`, [link](url).
 */
function parseInlineMarkdownStatic(text) {
  if (!text) return '';

  const parts = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} style={{ fontWeight: '800', color: '#ffffff' }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={match.index} style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '0.88em',
            color: 'var(--status-on-time)',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      const labelMatch = token.match(/\[(.*?)\]\((.*?)\)/);
      if (labelMatch) {
        parts.push(
          <a
            key={match.index}
            href={labelMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#ffffff', textDecoration: 'underline' }}
          >
            {labelMatch[1]}
          </a>
        );
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Parses inline markdown with word-fade-in class during typewriter streaming.
 */
function parseInlineMarkdown(text, isTyping = false) {
  if (!text) return '';
  if (!isTyping) return parseInlineMarkdownStatic(text);

  const tokens = text.split(/(\s+)/);
  return tokens.map((w, idx) => {
    if (!w) return null;
    if (/^\s+$/.test(w)) return <span key={idx}>{w}</span>;
    return (
      <span key={idx} className="word-fade-in">
        {parseInlineMarkdownStatic(w)}
      </span>
    );
  });
}

/**
 * Formats multi-line markdown text with headers, numbered/bulleted lists, and paragraphs.
 */
function formatMarkdownText(rawText, isTyping = false) {
  if (!rawText) return null;

  // Pre-normalize squished list items like " 1. **" or " 2. **" that have no newlines before them
  const text = String(rawText)
    .replace(/([^\n])\s+(\d+\.\s+\*\*)/g, '$1\n\n$2')
    .replace(/([^\n])\s+(\d+\.\s+[^\d\s])/g, '$1\n$2');

  const lines = text.split('\n');
  const elements = [];

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4
          key={lineIdx}
          style={{
            fontSize: '1.05rem',
            fontWeight: '800',
            margin: '12px 0 6px 0',
            color: 'var(--status-on-time)',
          }}
        >
          {parseInlineMarkdown(trimmed.slice(4), isTyping)}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3
          key={lineIdx}
          style={{ fontSize: '1.15rem', fontWeight: '800', margin: '14px 0 8px 0', color: '#ffffff' }}
        >
          {parseInlineMarkdown(trimmed.slice(3), isTyping)}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2
          key={lineIdx}
          style={{ fontSize: '1.25rem', fontWeight: '900', margin: '16px 0 10px 0', color: '#ffffff' }}
        >
          {parseInlineMarkdown(trimmed.slice(2), isTyping)}
        </h2>
      );
      return;
    }

    // Numbered list: "1. ", "2. ", etc.
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div
          key={lineIdx}
          style={{
            display: 'flex',
            gap: '8px',
            margin: '6px 0',
            alignItems: 'flex-start',
            lineHeight: '1.65',
          }}
        >
          <span style={{ fontWeight: '800', color: 'var(--status-on-time)', minWidth: '22px' }}>
            {numMatch[1]}.
          </span>
          <span style={{ flex: 1 }}>{parseInlineMarkdown(numMatch[2], isTyping)}</span>
        </div>
      );
      return;
    }

    // Bullet list: "- ", "* "
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div
          key={lineIdx}
          style={{
            display: 'flex',
            gap: '8px',
            margin: '4px 0',
            alignItems: 'flex-start',
            lineHeight: '1.65',
          }}
        >
          <span style={{ color: 'var(--status-on-time)', fontWeight: 'bold' }}>•</span>
          <span style={{ flex: 1 }}>{parseInlineMarkdown(trimmed.slice(2), isTyping)}</span>
        </div>
      );
      return;
    }

    // Empty line -> spacing
    if (!trimmed) {
      elements.push(<div key={lineIdx} style={{ height: '6px' }} />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={lineIdx} style={{ margin: '4px 0', lineHeight: '1.7' }}>
        {parseInlineMarkdown(line, isTyping)}
      </p>
    );
  });

  return elements;
}

function insertFileChipToEditor(editorEl, fileObj, attachedFilesMapRef, setHasContent) {
  if (!editorEl) return;
  editorEl.focus();

  const chip = document.createElement('span');
  chip.className = 'inline-file-chip';
  chip.contentEditable = 'false';
  chip.dir = 'rtl';
  chip.setAttribute('data-file-id', fileObj.id);
  chip.setAttribute('data-file-name', fileObj.name || '');
  chip.setAttribute('data-file-size', fileObj.size || '');
  chip.setAttribute('data-file-type', fileObj.type || '');
  chip.setAttribute('data-is-image', fileObj.isImage ? 'true' : 'false');
  chip.style.unicodeBidi = 'isolate';

  if (fileObj.isImage) {
    chip.setAttribute('data-file-content', fileObj.content || '');
    chip.style.cursor = 'pointer';
    chip.title = 'انقر لتكبير ومعاينة الصورة';
    const img = document.createElement('img');
    img.src = fileObj.content;
    img.alt = fileObj.name;
    img.style.cssText =
      'width: 100%; height: 100%; object-fit: cover; display: block; cursor: pointer;';
    chip.appendChild(img);

    chip.onclick = (e) => {
      if (e.target !== removeBtn && !removeBtn.contains(e.target)) {
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent('preview-chat-image', { detail: fileObj })
        );
      }
    };
  } else {
    chip.style.width = 'auto';
    chip.style.padding = '0 8px';
    chip.style.height = '34px';
    chip.innerHTML = `
      <span style="font-size: 0.72rem; color: #fff; display: flex; align-items: center; gap: 4px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <span style="max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileObj.name}</span>
      </span>
    `;
  }

  // Remove button on chip
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  removeBtn.title = 'إزالة';
  removeBtn.style.cssText = `
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.4);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    z-index: 2;
  `;
  removeBtn.onclick = (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    if (attachedFilesMapRef?.current) {
      delete attachedFilesMapRef.current[fileObj.id];
    }
    chip.remove();
    if (setHasContent) {
      setHasContent(
        editorEl.innerText.trim().length > 0 ||
          editorEl.querySelectorAll('.inline-file-chip').length > 0
      );
    }
  };
  chip.appendChild(removeBtn);

  // Insert chip at selection or at end without injecting extra literal spaces
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(chip);
    range.collapse(false);
    range.setStartAfter(chip);
    range.setEndAfter(chip);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    editorEl.appendChild(chip);
    const range = document.createRange();
    range.setStartAfter(chip);
    range.setEndAfter(chip);
    const newSel = window.getSelection();
    newSel.removeAllRanges();
    newSel.addRange(range);
  }

  if (setHasContent) setHasContent(true);
}

function handleEditorPaste(e, editorEl, attachedFilesMapRef, setHasContent) {
  const clipboardData = e.clipboardData;
  if (!clipboardData) return;

  // 1. Direct image file in clipboard (e.g. copied image or screenshot)
  const items = Array.from(clipboardData.items || []);
  const imageItem = items.find((item) => item.type && item.type.startsWith('image/'));

  if (imageItem) {
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) {
      compressImageFile(file, 1000, 1000, 0.70).then((compressedContent) => {
        const content = compressedContent || '';
        const fileObj = {
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          name: file.name || 'image_' + Date.now() + '.png',
          size: (file.size / 1024).toFixed(1) + ' KB',
          type: file.type || 'image/png',
          isImage: true,
          content: typeof content === 'string' ? content : '',
        };
        if (attachedFilesMapRef?.current) {
          attachedFilesMapRef.current[fileObj.id] = fileObj;
        }
        insertFileChipToEditor(editorEl, fileObj, attachedFilesMapRef, setHasContent);
      });
      return;
    }
  }

  // 2. HTML containing copied inline chips or rich elements
  const html = clipboardData.getData('text/html');
  if (
    html &&
    (html.includes('inline-file-chip') ||
      html.includes('data-file-id') ||
      html.includes('<img'))
  ) {
    e.preventDefault();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const itemsToInsert = [];
    let pendingText = '';

    const traverse = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        pendingText += node.nodeValue.replace(/\u200F/g, '');
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.classList && node.classList.contains('inline-file-chip')) {
          if (pendingText) {
            itemsToInsert.push({ type: 'text', value: pendingText });
            pendingText = '';
          }
          const fileId =
            node.getAttribute('data-file-id') ||
            'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          const name = node.getAttribute('data-file-name') || 'file.png';
          const size = node.getAttribute('data-file-size') || '10.0 KB';
          const type = node.getAttribute('data-file-type') || 'image/png';
          const isImage =
            node.getAttribute('data-is-image') === 'true' ||
            node.querySelector('img') !== null;
          const imgEl = node.querySelector('img');
          const content = imgEl
            ? imgEl.src || node.getAttribute('data-file-content') || ''
            : '';

          itemsToInsert.push({
            type: 'file',
            fileObj: { id: fileId, name, size, type, isImage, content },
          });
        } else if (node.tagName === 'IMG') {
          if (pendingText) {
            itemsToInsert.push({ type: 'text', value: pendingText });
            pendingText = '';
          }
          const src = node.getAttribute('src') || '';
          if (src) {
            itemsToInsert.push({
              type: 'file',
              fileObj: {
                id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                name: node.getAttribute('alt') || 'image.png',
                size: '50.0 KB',
                type: 'image/png',
                isImage: true,
                content: src,
              },
            });
          }
        } else if (node.tagName === 'BR') {
          pendingText += '\n';
        } else {
          node.childNodes.forEach(traverse);
        }
      }
    };

    doc.body.childNodes.forEach(traverse);
    if (pendingText) {
      itemsToInsert.push({ type: 'text', value: pendingText });
    }

    // Clean ONLY outer leading and trailing blank linebreaks across the whole payload
    if (itemsToInsert.length > 0 && itemsToInsert[0].type === 'text') {
      itemsToInsert[0].value = itemsToInsert[0].value.replace(/^[\r\n]+/, '');
      if (!itemsToInsert[0].value) itemsToInsert.shift();
    }
    if (itemsToInsert.length > 0 && itemsToInsert[itemsToInsert.length - 1].type === 'text') {
      itemsToInsert[itemsToInsert.length - 1].value = itemsToInsert[itemsToInsert.length - 1].value.replace(/[\r\n]+$/, '');
      if (!itemsToInsert[itemsToInsert.length - 1].value) itemsToInsert.pop();
    }

    // Insert items cleanly in sequence, normalizing any redundant double spaces
    itemsToInsert.forEach((item) => {
      if (item.type === 'text' && item.value) {
        const normalizedText = item.value.replace(/[ \t]{2,}/g, ' ');
        document.execCommand('insertText', false, normalizedText);
      } else if (item.type === 'file' && item.fileObj) {
        if (attachedFilesMapRef?.current) {
          attachedFilesMapRef.current[item.fileObj.id] = item.fileObj;
        }
        insertFileChipToEditor(editorEl, item.fileObj, attachedFilesMapRef, setHasContent);
      }
    });

    if (setHasContent) setHasContent(true);
    return;
  }

  // 3. Plain text pasting
  const text = clipboardData.getData('text/plain');
  if (text) {
    e.preventDefault();
    const cleanText = text
      .replace(/^[\r\n]+/, '')
      .replace(/[\r\n]+$/, '')
      .replace(/[ \t]{2,}/g, ' ');
    document.execCommand('insertText', false, cleanText);
    if (setHasContent) setHasContent(true);
  }
}

function extractSegmentsFromEditor(editorEl, attachedFilesMap) {
  if (!editorEl) return [];
  const segments = [];
  let currentText = '';

  const traverse = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      currentText += node.nodeValue.replace(/\u00A0/g, ' ');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList && node.classList.contains('inline-file-chip')) {
        if (currentText.trim()) {
          segments.push({ type: 'text', value: currentText.trim() });
          currentText = '';
        }
        const fileId = node.getAttribute('data-file-id');
        const file = attachedFilesMap[fileId];
        if (file) {
          segments.push({ type: 'file', file });
        }
      } else if (node.nodeName === 'BR') {
        currentText += '\n';
      } else {
        node.childNodes.forEach(traverse);
      }
    }
  };

  editorEl.childNodes.forEach(traverse);
  if (currentText.trim()) {
    segments.push({ type: 'text', value: currentText.trim() });
  }

  return segments;
}

function FilePreviewItem({ file, onRemove, onPreview, compact = false }) {
  const isImage =
    (file.type && file.type.startsWith('image/')) ||
    (typeof file.content === 'string' && file.content.startsWith('data:image/'));

  const handlePreviewClick = (e) => {
    if (isImage) {
      e.stopPropagation();
      if (onPreview) {
        onPreview(file);
      } else {
        window.dispatchEvent(
          new CustomEvent('preview-chat-image', { detail: file })
        );
      }
    }
  };

  if (compact) {
    if (isImage) {
      return (
        <div
          onClick={handlePreviewClick}
          style={{
            position: 'relative',
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            backgroundColor: 'rgba(10, 10, 10, 0.88)',
            flexShrink: 0,
            display: 'inline-flex',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
          title="انقر لتكبير ومعاينة الصورة"
        >
          <img
            src={file.content}
            alt={file.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(file.id);
              }}
              style={{
                position: 'absolute',
                top: '2px',
                left: '2px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.40)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                zIndex: 2,
              }}
              title="إزالة الصورة"
            >
              <X size={10} />
            </button>
          )}
        </div>
      );
    }

    return (
      <div
        style={{
          position: 'relative',
          height: '38px',
          maxWidth: '140px',
          borderRadius: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          padding: '0 8px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        <FileText size={15} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />
        <span
          style={{
            fontSize: '0.72rem',
            color: '#ffffff',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={file.name}
        >
          {file.name}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(file.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 0,
              flexShrink: 0,
            }}
            title="إزالة الملف"
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  }

  if (isImage) {
    return (
      <div
        onClick={handlePreviewClick}
        style={{
          position: 'relative',
          width: '64px',
          height: '64px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.65)',
          backgroundColor: 'rgba(10, 10, 10, 0.88)',
          flexShrink: 0,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        title="انقر لتكبير ومعاينة الصورة"
      >
        <img
          src={file.content}
          alt={file.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(file.id);
            }}
            style={{
              position: 'absolute',
              top: '3px',
              left: '3px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.15s ease',
              zIndex: 2,
            }}
            title="إزالة الصورة"
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        height: '56px',
        maxWidth: '190px',
        borderRadius: '12px',
        backgroundColor: 'rgba(10, 10, 10, 0.88)',
        border: '1px solid rgba(255, 255, 255, 0.20)',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.65)',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--status-on-time)',
          flexShrink: 0,
        }}
      >
        <FileText size={18} />
      </div>
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div
          style={{
            fontSize: '0.78rem',
            color: '#ffffff',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={file.name}
        >
          {file.name}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{file.size}</div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(file.id)}
          style={{
            position: 'absolute',
            top: '-6px',
            left: '-6px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
          title="إزالة الملف"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}



const CHAT_AWAY_RESET_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes (120,000 ms)
const LAST_LEFT_CHAT_STORAGE_KEY = 'prayer_tracker_last_left_chat_time';

export default function ChatView({ settings, onNavigateToSettings, onSettingsSaved, isActive = true, isOnline: propIsOnline }) {
  const lang = settings?.language || 'ar';
  const isEn = lang === 'en';

  const [isOnline, setIsOnline] = useState(() => (propIsOnline !== undefined ? propIsOnline : (typeof navigator !== 'undefined' ? navigator.onLine : true)));

  useEffect(() => {
    if (propIsOnline !== undefined) {
      setIsOnline(propIsOnline);
    }
  }, [propIsOnline]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [sessions, setSessions] = useState(() => getChatSessions());
  const [dailySuggestions, setDailySuggestions] = useState(() => getDailySuggestions(lang));
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [activeSessionId, setActiveSessionIdState] = useState(() => {
    const id = getActiveSessionId();
    const list = getChatSessions();
    if (id && list.some((s) => s.id === id)) return id;
    return list[0]?.id || '';
  });

  // Sync daily suggestions from storage events
  useEffect(() => {
    const handleSuggestionsUpdate = (e) => {
      if (e.detail?.suggestions && Array.isArray(e.detail.suggestions)) {
        setDailySuggestions(e.detail.suggestions);
        setIsGeneratingSuggestions(false);
      }
    };
    window.addEventListener('prayer_tracker_suggestions_updated', handleSuggestionsUpdate);
    return () => window.removeEventListener('prayer_tracker_suggestions_updated', handleSuggestionsUpdate);
  }, []);

  // System trigger: Request fresh suggestions from the model once per day in background
  useEffect(() => {
    const currentApiKey = (settings?.geminiApiKey || getSettings()?.geminiApiKey || '').trim();
    const cached = getDailySuggestions(lang);
    if (cached && cached.length > 0) {
      setDailySuggestions(cached);
      setIsGeneratingSuggestions(false);
    } else if (currentApiKey) {
      setIsGeneratingSuggestions(true);
      ensureDailySuggestions(currentApiKey, lang)
        .then((res) => {
          if (Array.isArray(res) && res.length > 0) {
            setDailySuggestions(res);
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsGeneratingSuggestions(false);
        });
    } else {
      setIsGeneratingSuggestions(false);
    }
  }, [settings?.geminiApiKey, lang]);

  const validSessions = Array.isArray(sessions) && sessions.length > 0 ? sessions : getChatSessions();
  const activeSession = validSessions.find((s) => s.id === activeSessionId) || validSessions[0] || {};
  const messages = Array.isArray(activeSession.messages) ? activeSession.messages : [];
  const isCurrentChatEmpty = !messages.some((m) => m && m.sender === 'user');

  const lastChatActivityTimeRef = useRef(() => {
    try {
      const stored = localStorage.getItem(LAST_LEFT_CHAT_STORAGE_KEY);
      return stored ? parseInt(stored, 10) : Date.now();
    } catch {
      return Date.now();
    }
  });

  const recordChatActivity = useCallback(() => {
    const now = Date.now();
    lastChatActivityTimeRef.current = now;
    try {
      localStorage.setItem(LAST_LEFT_CHAT_STORAGE_KEY, String(now));
    } catch {
      // Ignore
    }
  }, []);

  // Track user presence and inactivity in the AI chat view:
  // If > 2 minutes of inactivity elapse while away or returning to chat, return to the clean initial new-chat screen.
  // If user is actively present in the chat page, their ongoing interactions refresh the timer.
  useEffect(() => {
    if (isActive) {
      const lastActivity = typeof lastChatActivityTimeRef.current === 'function' ? lastChatActivityTimeRef.current() : lastChatActivityTimeRef.current;
      const now = Date.now();

      // Check if > 2 minutes of total inactivity passed since last interaction
      if (lastActivity > 0 && now - lastActivity >= CHAT_AWAY_RESET_TIMEOUT_MS) {
        const currentMsgs = Array.isArray(activeSession?.messages) ? activeSession.messages : [];
        const hasUserMsgs = currentMsgs.some((m) => m && m.sender === 'user');

        if (hasUserMsgs) {
          try {
            const { newSession, sessions: updated } = createNewSession();
            setSessions(updated);
            setActiveSessionIdState(newSession.id);
          } catch (err) {
            console.error('Error auto-creating new chat session after 2m inactivity:', err);
          }
        }
      }

      // Refresh activity timestamp now that user is active
      recordChatActivity();
    } else {
      // Record current timestamp when leaving the chat page
      recordChatActivity();
    }
  }, [isActive, activeSession?.messages, recordChatActivity]);

  // Keep activity timestamp updated while user is interacting inside the chat page
  useEffect(() => {
    if (!isActive) return;

    let lastThrottle = 0;
    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastThrottle >= 3000) {
        // Throttle updates to once every 3 seconds
        lastThrottle = now;
        recordChatActivity();
      }
    };

    window.addEventListener('mousemove', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('scroll', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
    };
  }, [isActive, recordChatActivity]);

  // Also handle browser tab visibility switching
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isActive) return;

      if (document.visibilityState === 'hidden') {
        recordChatActivity();
      } else if (document.visibilityState === 'visible') {
        const lastActivity = typeof lastChatActivityTimeRef.current === 'function' ? lastChatActivityTimeRef.current() : lastChatActivityTimeRef.current;
        const now = Date.now();

        if (lastActivity > 0 && now - lastActivity >= CHAT_AWAY_RESET_TIMEOUT_MS) {
          const currentMsgs = Array.isArray(activeSession?.messages) ? activeSession.messages : [];
          const hasUserMsgs = currentMsgs.some((m) => m && m.sender === 'user');

          if (hasUserMsgs) {
            try {
              const { newSession, sessions: updated } = createNewSession();
              setSessions(updated);
              setActiveSessionIdState(newSession.id);
            } catch (err) {
              console.error('Error auto-creating new chat session after visibility timeout:', err);
            }
          }
        }

        recordChatActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, activeSession?.messages, recordChatActivity]);

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [hasInputContent, setHasInputContent] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);

  const heroEditorRef = useRef(null);
  const activeEditorRef = useRef(null);
  const attachedFilesMapRef = useRef({});
  const [, setContextTick] = useState(0);

  useEffect(() => {
    const handleContextUpdate = () => {
      setContextTick((prev) => prev + 1);
    };
    window.addEventListener(APP_EVENTS.RECORDS_UPDATED, handleContextUpdate);
    window.addEventListener(APP_EVENTS.NAFL_RECORDS_UPDATED, handleContextUpdate);
    window.addEventListener(APP_EVENTS.SETTINGS_UPDATED, handleContextUpdate);
    window.addEventListener(APP_EVENTS.PRAYER_TIMES_UPDATED, handleContextUpdate);

    return () => {
      window.removeEventListener(APP_EVENTS.RECORDS_UPDATED, handleContextUpdate);
      window.removeEventListener(APP_EVENTS.NAFL_RECORDS_UPDATED, handleContextUpdate);
      window.removeEventListener(APP_EVENTS.SETTINGS_UPDATED, handleContextUpdate);
      window.removeEventListener(APP_EVENTS.PRAYER_TIMES_UPDATED, handleContextUpdate);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail) {
        setPreviewImageModal(e.detail);
      }
    };
    window.addEventListener(APP_EVENTS.PREVIEW_CHAT_IMAGE, handler);
    return () => window.removeEventListener(APP_EVENTS.PREVIEW_CHAT_IMAGE, handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && previewImageModal) {
        setPreviewImageModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImageModal]);

  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [typingState, setTypingState] = useState('hidden'); // 'hidden', 'visible', 'exiting'
  const [correctingMsgId, setCorrectingMsgId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [hoveredInfoMsgId, setHoveredInfoMsgId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typewriterIntervalRef = useRef(null);
  const pauseResumeCallbackRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Smooth GPU Entrance & Exit Animation Lifecycle for Typing Indicator
  useEffect(() => {
    let timer;
    if (isLoading) {
      setTypingState('visible');
    } else {
      setTypingState((prev) => {
        if (prev === 'visible') {
          timer = setTimeout(() => {
            setTypingState('hidden');
          }, 280);
          return 'exiting';
        }
        return 'hidden';
      });
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading]);

  const hasGeminiKey = Boolean(
    settings && settings.geminiApiKey && settings.geminiApiKey.trim()
  );

  const scrollToBottom = () => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      // Ignore scroll errors
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading, isStreaming]);

  // Clean up typewriter and abort controller on unmount
  useEffect(() => {
    return () => {
      if (typewriterIntervalRef.current) {
        clearTimeout(typewriterIntervalRef.current);
        clearInterval(typewriterIntervalRef.current);
      }
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Toggle Pause / Resume generation
  const handleTogglePauseResume = () => {
    if (!isStreaming) return;

    if (!isPaused) {
      // Pause
      if (typewriterIntervalRef.current) {
        clearTimeout(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      setIsPaused(true);
    } else {
      // Resume
      setIsPaused(false);
      if (pauseResumeCallbackRef.current) {
        typewriterIntervalRef.current = setTimeout(pauseResumeCallbackRef.current, 60);
      }
    }
  };

  // Stop Generation and Typing immediately
  const handleStopGeneration = () => {
    // 1. Abort network fetch if underway
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // 2. Clear typewriter timeout/interval if typing
    if (typewriterIntervalRef.current) {
      clearTimeout(typewriterIntervalRef.current);
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
    pauseResumeCallbackRef.current = null;
    setIsPaused(false);

    // 3. Finalize messages so whatever has been typed remains visible without typing cursor
    let latestFinalMsgs = [];
    setSessions((prevSessions) => {
      return prevSessions.map((s) => {
        if (s.id === activeSession.id) {
          const finalized = (s.messages || []).map((m) =>
            m.isTyping ? { ...m, isTyping: false } : m
          );
          updateSessionMessages(s.id, finalized);
          latestFinalMsgs = finalized;
          return { ...s, messages: finalized };
        }
        return s;
      });
    });

    setIsLoading(false);
    setIsStreaming(false);

    // Auto-trigger any queued pending message!
    const pendingIdx = latestFinalMsgs.findIndex((m) => m && m.sender === 'user' && m.status === 'pending');
    if (pendingIdx >= 0) {
      const pendingMsg = latestFinalMsgs[pendingIdx];
      const priorHistory = latestFinalMsgs.slice(0, pendingIdx);
      setTimeout(() => {
        handleProcessPendingMessage(pendingMsg, priorHistory);
      }, 320);
    }
  };

  // Typewriter streaming word-by-word effect for clean conversational text ONLY
  const streamAssistantResponse = (rawFullText, baseMessages, msgMetadata) => {
    if (typewriterIntervalRef.current) {
      clearTimeout(typewriterIntervalRef.current);
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
    setIsPaused(false);
    pauseResumeCallbackRef.current = null;

    // 1. Immediately extract the hidden action and clean conversational text in the background!
    const { cleanText, action } = extractMuneerAction(rawFullText);
    const textToStream = cleanText || rawFullText;

    // 2. Automatically apply settings immediately without any permission prompt!
    if (action) {
      executeSettingsActionDirectly(action, onSettingsSaved);
    }

    setIsStreaming(true);
    const msgId = msgMetadata.id || (Date.now() + 1).toString();

    // Match words and tokens while strictly preserving spaces, newlines, and markdown formatting
    const tokens = textToStream.match(/\S+\s*|\s+/g) || [textToStream];
    const totalTokens = tokens.length;
    let currentTokenIndex = 0;
    let wordCounter = 0; // count actual words

    // Initial empty assistant message with isTyping flag and parsed action
    const initialAssistantMsg = {
      ...msgMetadata,
      id: msgId,
      sender: 'assistant',
      text: '',
      action: action || null,
      actionStatus: 'applied',
      isTyping: true,
    };

    const existsIndex = baseMessages.findIndex((m) => m.id === msgId);
    let currentList = existsIndex >= 0
      ? baseMessages.map((m) => (m.id === msgId ? initialAssistantMsg : m))
      : [...baseMessages, initialAssistantMsg];

    setSessions((prevSessions) =>
      prevSessions.map((s) => (s.id === activeSession.id ? { ...s, messages: currentList } : s))
    );

    const typeNext = () => {
      if (currentTokenIndex >= totalTokens) {
        if (typewriterIntervalRef.current) {
          clearTimeout(typewriterIntervalRef.current);
          typewriterIntervalRef.current = null;
        }
        pauseResumeCallbackRef.current = null;
        setIsStreaming(false);
        setIsPaused(false);

        const completedMsg = {
          ...msgMetadata,
          id: msgId,
          sender: 'assistant',
          text: textToStream,
          action: action || null,
          isTyping: false,
        };

        const finalMsgs = currentList.map((m) => (m.id === msgId ? completedMsg : m));
        const saved = updateSessionMessages(activeSession.id, finalMsgs);
        setSessions([...saved]);
        setTimeout(scrollToBottom, 40);

        // Auto-trigger next pending message in queue if any!
        const nextPendingIdx = finalMsgs.findIndex((m) => m && m.sender === 'user' && m.status === 'pending');
        if (nextPendingIdx >= 0) {
          const nextPendingMsg = finalMsgs[nextPendingIdx];
          const priorHistory = finalMsgs.slice(0, nextPendingIdx);
          setTimeout(() => {
            handleProcessPendingMessage(nextPendingMsg, priorHistory);
          }, 350);
        }
        return;
      }

      currentTokenIndex += 1;
      const currentToken = tokens[currentTokenIndex - 1] || '';
      const isWord = /\S/.test(currentToken);
      if (isWord) {
        wordCounter += 1;
      }

      const partialText = tokens.slice(0, currentTokenIndex).join('');
      currentList = currentList.map((m) =>
        m.id === msgId ? { ...m, text: partialText, action: action || null, isTyping: true } : m
      );

      setSessions((prevSessions) =>
        prevSessions.map((s) => (s.id === activeSession.id ? { ...s, messages: currentList } : s))
      );
      scrollToBottom();

      // Natural responsive streaming cadence (20ms - 45ms per token/word)
      const minDelay = 20;
      const maxDelay = 45;
      let nextDelayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

      // Subtle punctuation pauses for natural phrasing
      if (currentTokenIndex < totalTokens) {
        if (/[.؟?!…]/.test(currentToken)) {
          nextDelayMs += 100;
        } else if (/[،,؛;:]/.test(currentToken)) {
          nextDelayMs += 50;
        }
      }

      typewriterIntervalRef.current = setTimeout(typeNext, nextDelayMs);
    };

    // Store typeNext callback so we can resume anytime seamlessly
    pauseResumeCallbackRef.current = typeNext;

    // Start typing immediately after a brief initial pause
    typewriterIntervalRef.current = setTimeout(typeNext, 80);
  };

  const handleSelectSession = (id) => {
    const currentList = getChatSessions();
    const cleaned = currentList.filter((s) => {
      const hasMsgs = Array.isArray(s.messages) && s.messages.length > 0;
      return hasMsgs || s.id === id;
    });
    const finalSessions = cleaned.length > 0 ? cleaned : [currentList[0]];
    saveChatSessions(finalSessions);
    setSessions(finalSessions);
    setActiveSessionIdState(id);
    saveActiveSessionId(id);
  };

  const handleCreateNewSession = () => {
    if (isCurrentChatEmpty) return;
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
        const updated = updateSessionMessages(activeSession.id, []);
        setSessions([...updated]);
        return;
      }

      const updated = deleteSession(activeSession.id);
      setSessions(updated);
      if (updated.length > 0) {
        setActiveSessionIdState(updated[0].id);
        saveActiveSessionId(updated[0].id);
      }
    } catch (e) {
      console.error('Error deleting session:', e);
    }
  };

  const handleDeleteSessionById = (e, sessionId) => {
    if (e) e.stopPropagation();
    try {
      if (validSessions.length <= 1) {
        const updated = updateSessionMessages(sessionId, []);
        setSessions([...updated]);
        return;
      }

      const updated = deleteSession(sessionId);
      setSessions(updated);
      if (activeSession.id === sessionId && updated.length > 0) {
        setActiveSessionIdState(updated[0].id);
        saveActiveSessionId(updated[0].id);
      }
    } catch (err) {
      console.error('Error deleting session by id:', err);
    }
  };

  const handleResetAllChats = () => {
    if (
      window.confirm(
        'هل أنت متأكد من رغبتك في مسح كافة سجلات المحادثات الذكية والبدء من جديد؟'
      )
    ) {
      try {
        const resetData = resetChatSessions();
        setSessions(resetData);
        if (resetData.length > 0) {
          setActiveSessionIdState(resetData[0].id);
          saveActiveSessionId(resetData[0].id);
        }
      } catch (e) {
        console.error('Error resetting chat sessions:', e);
      }
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      const isHero = !messages.some((m) => m.sender === 'user');
      const targetEditor = isHero ? heroEditorRef.current : activeEditorRef.current;

      files.forEach((file) => {
        if (file.type && file.type.startsWith('image/')) {
          compressImageFile(file, 1000, 1000, 0.70).then((compressedContent) => {
            const fileObj = {
              id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              name: file.name,
              size: (file.size / 1024).toFixed(1) + ' KB',
              type: file.type || 'image/png',
              isImage: true,
              content: typeof compressedContent === 'string' ? compressedContent : '',
            };

            attachedFilesMapRef.current[fileObj.id] = fileObj;
            if (targetEditor) {
              insertFileChipToEditor(targetEditor, fileObj, attachedFilesMapRef, setHasInputContent);
            }
          });
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result;
            const fileObj = {
              id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              name: file.name,
              size: (file.size / 1024).toFixed(1) + ' KB',
              type: file.type || 'ملف',
              isImage: false,
              content: typeof content === 'string' ? content : '',
            };

            attachedFilesMapRef.current[fileObj.id] = fileObj;
            if (targetEditor) {
              insertFileChipToEditor(targetEditor, fileObj, attachedFilesMapRef, setHasInputContent);
            }
          };
          reader.readAsText(file);
        }
      });

      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('File upload error:', err);
    }
  };

  const handleSend = async (textToSend, customPriorMessages = null) => {
    const baseMessages = Array.isArray(customPriorMessages) ? customPriorMessages : messages;
    const isHero = !baseMessages.some((m) => m && m.sender === 'user');
    const targetEditor = isHero ? heroEditorRef.current : activeEditorRef.current;
    let extractedSegments = [];
    let query = '';
    let extractedFiles = [];

    if (textToSend) {
      query = textToSend;
      extractedSegments = [{ type: 'text', value: textToSend }];
    } else if (targetEditor) {
      extractedSegments = extractSegmentsFromEditor(targetEditor, attachedFilesMapRef.current);
      query = extractedSegments
        .filter((s) => s.type === 'text')
        .map((s) => s.value)
        .join(' ');
      extractedFiles = extractedSegments
        .filter((s) => s.type === 'file')
        .map((s) => s.file);
    }

    if (!query.trim() && extractedFiles.length === 0) return;

    if (!isOnline) {
      setErrorMessage(
        isEn
          ? 'AI Chat is locked in offline mode. Please connect to the internet to chat with Sheikh Muneer.'
          : 'محادثة الذكاء الاصطناعي مقفلة في وضع عدم الاتصال. يُرجى الاتصال بالإنترنت لبدء الحوار مع الشيخ منير.'
      );
      return;
    }

    if (!hasGeminiKey) {
      setErrorMessage(
        isEn
          ? 'Gemini API Key is required. Please go to Settings to add your key.'
          : 'مفتاح Gemini API غير مضاف. يُرجى الانتقال إلى الإعدادات وإدخال المفتاح أولاً.'
      );
      return;
    }

    // 1. If AI is currently loading or streaming another response, queue as a Pending Message!
    if (isLoading || isStreaming) {
      const pendingUserMsg = {
        id: Date.now().toString(),
        sender: 'user',
        text: query.trim() || 'تحليل المحتوى المرفق',
        segments: extractedSegments,
        attachedFiles: extractedFiles,
        status: 'pending',
        timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      const newMessages = [...baseMessages, pendingUserMsg];
      const updatedSessions = updateSessionMessages(activeSession.id, newMessages);
      setSessions([...updatedSessions]);

      // Clear editor
      if (targetEditor) {
        targetEditor.innerHTML = '';
        setHasInputContent(false);
      }
      attachedFilesMapRef.current = {};
      return;
    }

    setErrorMessage(null);
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: query.trim() || 'تحليل المحتوى المرفق',
      segments: extractedSegments,
      attachedFiles: extractedFiles,
      timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const newMessages = [...baseMessages, userMsg];
    const updatedSessions = updateSessionMessages(activeSession.id, newMessages);
    setSessions([...updatedSessions]);

    // Clear editor
    if (targetEditor) {
      targetEditor.innerHTML = '';
      setHasInputContent(false);
    }
    attachedFilesMapRef.current = {};
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await sendGeminiChatMessage(
        settings.geminiApiKey,
        newMessages,
        query || 'تحليل المحتوى المرفق',
        settings.tavilyApiKey,
        extractedFiles,
        controller.signal,
        extractedSegments
      );

      abortControllerRef.current = null;
      setIsLoading(false);

      if (res && res.success) {
        // Wait for three dots to smoothly finish exit fade (280ms) before streaming text
        await new Promise((r) => setTimeout(r, 280));

        const rawText = typeof res.text === 'string' ? res.text : String(res.text || '');
        const msgMetadata = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          usedSearch: Boolean(res.usedSearch),
          durationSeconds: res.durationSeconds ? String(res.durationSeconds) : null,
          timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        streamAssistantResponse(rawText, newMessages, msgMetadata);

        // Two-Stage Smart Titling Architecture:
        // 1. Initial Title at 1st assistant response
        // 2. Primary Permanent Title after 5 assistant responses based on deep conversational context
        handleCheckAndGenerateSessionTitle(newMessages, rawText);
      } else {
        setErrorMessage(res?.error || 'حدث خطأ أثناء معالجة الطلب.');
      }
    } catch (err) {
      abortControllerRef.current = null;
      setIsLoading(false);
      if (err.name !== 'AbortError') {
        setErrorMessage(`حدث خطأ غير متوقع: ${err.message}`);
      }
    }
  };

  const handleCheckAndGenerateSessionTitle = (sessionMsgs, incomingAssistantText) => {
    if (!settings?.geminiApiKey || !activeSession?.id) return;

    const currentSession = validSessions.find((s) => s.id === activeSession.id) || activeSession;
    if (currentSession.titleFinalized) return;

    // Count assistant replies in the current session
    const assistantRepliesCount = sessionMsgs.filter((m) => m && m.sender === 'assistant' && !m.isTyping).length + 1;

    // Stage 1: Initial title at 1st assistant response
    if (assistantRepliesCount === 1) {
      const isDefaultTitle =
        !currentSession?.title ||
        currentSession.title.startsWith('محادثة جديدة') ||
        currentSession.title.startsWith('محادثة رئيسية');

      if (isDefaultTitle) {
        const firstUser = sessionMsgs.find((m) => m && m.sender === 'user');
        const userText = firstUser?.text || 'محادثة';
        generateSessionTitle(settings.geminiApiKey, userText, incomingAssistantText).then((initialTitle) => {
          if (initialTitle) {
            const updated = updateSessionTitle(activeSession.id, initialTitle, false);
            setSessions(Array.isArray(updated) ? [...updated] : getChatSessions());
          }
        });
      }
    }
    // Stage 2: Primary permanent title after 5 assistant responses based on full multi-turn context
    else if (assistantRepliesCount === 5) {
      generateSessionContextualTitle(settings.geminiApiKey, sessionMsgs).then((primaryTitle) => {
        if (primaryTitle) {
          const updated = updateSessionTitle(activeSession.id, primaryTitle, true);
          setSessions(Array.isArray(updated) ? [...updated] : getChatSessions());
        }
      });
    }
  };

  const handleCancelPendingMessage = (pendingMsgId) => {
    setSessions((prevSessions) => {
      return prevSessions.map((s) => {
        if (s.id === activeSession.id) {
          const filtered = (s.messages || []).filter((m) => m.id !== pendingMsgId);
          updateSessionMessages(s.id, filtered);
          return { ...s, messages: filtered };
        }
        return s;
      });
    });
  };

  const handleProcessPendingMessage = async (pendingMsg, priorHistory) => {
    if (!pendingMsg || !hasGeminiKey) return;

    // Convert pending message into active normal user message
    const activeUserMsg = { ...pendingMsg, status: undefined };
    const currentSessionMsgs = [...priorHistory, activeUserMsg];

    setSessions((prevSessions) =>
      prevSessions.map((s) => {
        if (s.id === activeSession.id) {
          updateSessionMessages(s.id, currentSessionMsgs);
          return { ...s, messages: currentSessionMsgs };
        }
        return s;
      })
    );

    setErrorMessage(null);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await sendGeminiChatMessage(
        settings.geminiApiKey,
        currentSessionMsgs,
        activeUserMsg.text,
        settings.tavilyApiKey,
        activeUserMsg.attachedFiles || [],
        controller.signal,
        activeUserMsg.segments || []
      );

      abortControllerRef.current = null;
      setIsLoading(false);

      if (res && res.success) {
        await new Promise((r) => setTimeout(r, 280));
        const rawText = typeof res.text === 'string' ? res.text : String(res.text || '');
        const msgMetadata = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          usedSearch: Boolean(res.usedSearch),
          durationSeconds: res.durationSeconds ? String(res.durationSeconds) : null,
          timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        streamAssistantResponse(rawText, currentSessionMsgs, msgMetadata);
        handleCheckAndGenerateSessionTitle(currentSessionMsgs, rawText);
      } else {
        setErrorMessage(res?.error || 'حدث خطأ أثناء معالجة الطلب.');
      }
    } catch (err) {
      abortControllerRef.current = null;
      setIsLoading(false);
      if (err.name !== 'AbortError') {
        setErrorMessage(`حدث خطأ غير متوقع: ${err.message}`);
      }
    }
  };

  const handleRegenerateResponse = async (assistantMsgId) => {
    if (isLoading || isStreaming || !hasGeminiKey) return;
    const msgIdx = messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIdx < 0) return;

    const historyUpToTarget = messages.slice(0, msgIdx);
    const targetUserMsg = historyUpToTarget[historyUpToTarget.length - 1];

    const queryText = targetUserMsg ? (typeof targetUserMsg.text === 'string' ? targetUserMsg.text : String(targetUserMsg.text || '')) : 'إعادة توليد الإجابة';
    const filesForApi = targetUserMsg?.attachedFiles || [];
    const segmentsForApi = targetUserMsg?.segments || [];

    // Immediately truncate and remove any subsequent messages from active session
    const updatedSessions = updateSessionMessages(activeSession.id, historyUpToTarget);
    setSessions([...updatedSessions]);

    setErrorMessage(null);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await sendGeminiChatMessage(
        settings.geminiApiKey,
        historyUpToTarget,
        queryText,
        settings.tavilyApiKey,
        filesForApi,
        controller.signal,
        segmentsForApi
      );

      abortControllerRef.current = null;
      setIsLoading(false);

      if (res && res.success) {
        // Wait for three dots to smoothly finish exit fade (280ms) before streaming text
        await new Promise((r) => setTimeout(r, 280));

        const rawText = typeof res.text === 'string' ? res.text : String(res.text || '');
        const msgMetadata = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          usedSearch: Boolean(res.usedSearch),
          durationSeconds: res.durationSeconds ? String(res.durationSeconds) : null,
          timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isRegenerated: true,
        };

        streamAssistantResponse(rawText, historyUpToTarget, msgMetadata);
      } else {
        setErrorMessage(res?.error || 'تعذر إعادة التوليد.');
      }
    } catch (err) {
      abortControllerRef.current = null;
      setIsLoading(false);
      if (err.name !== 'AbortError') {
        setErrorMessage(`حدث خطأ أثناء إعادة التوليد: ${err.message}`);
      }
    }
  };

  const handleResendUserMessage = (msg) => {
    if (!msg || isLoading || isStreaming) return;
    const msgIdx = messages.findIndex((m) => m.id === msg.id);
    if (msgIdx < 0) return;

    const priorMessages = messages.slice(0, msgIdx);
    const textToSend = typeof msg.text === 'string' ? msg.text : String(msg.text || '');
    if (!textToSend.trim() && (!msg.attachedFiles || msg.attachedFiles.length === 0)) return;

    if (Array.isArray(msg.attachedFiles) && msg.attachedFiles.length > 0) {
      setAttachedFiles([...msg.attachedFiles]);
    }
    handleSend(textToSend, priorMessages);
  };

  const handleDeleteMessage = (msgId) => {
    const filtered = messages.filter((m) => m && m.id !== msgId);
    const updated = updateSessionMessages(activeSession.id, filtered);
    setSessions([...updated]);
  };

  const handleCorrectSpelling = async (msg) => {
    if (!msg || correctingMsgId) return;
    const currentApiKey = (settings?.geminiApiKey || getSettings()?.geminiApiKey || '').trim();
    if (!currentApiKey) {
      alert('يرجى إضافة مفتاح Gemini API في الإعدادات أولاً لتفعيل التدقيق الإملائي بالذكاء الاصطناعي.');
      return;
    }
    let originalText = typeof msg.text === 'string' ? msg.text : String(msg.text || '');
    if (!originalText.trim() && Array.isArray(msg.segments)) {
      originalText = msg.segments
        .filter((s) => s.type === 'text')
        .map((s) => s.value)
        .join(' ');
    }
    if (!originalText.trim()) return;

    setCorrectingMsgId(msg.id);
    try {
      const corrected = await correctSpellingText(currentApiKey, originalText);
      if (corrected && corrected.trim() && corrected.trim() !== originalText.trim()) {
        const finalText = corrected.trim();
        let updatedSegments = null;
        if (Array.isArray(msg.segments) && msg.segments.length > 0) {
          const files = msg.segments.filter((s) => s.type === 'file');
          updatedSegments = [{ type: 'text', value: finalText }, ...files];
        }

        const updatedMsgs = messages.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                text: finalText,
                segments: updatedSegments || m.segments,
                isEdited: true,
              }
            : m
        );

        const saved = updateSessionMessages(activeSession.id, updatedMsgs);
        setSessions([...saved]);
      }
    } catch (err) {
      console.warn('Spell correction failed:', err);
    } finally {
      setCorrectingMsgId(null);
    }
  };

  const handleStartEditMessage = (msg) => {
    if (!msg) return;
    setEditingMessageId(msg.id);
    setEditText(typeof msg.text === 'string' ? msg.text : String(msg.text || ''));
  };

  const handleSaveEditedMessage = (msgId) => {
    if (!editText.trim() || isLoading || isStreaming) return;
    const targetIdx = messages.findIndex((m) => m && m.id === msgId);
    if (targetIdx < 0) return;

    // Slice all messages prior to this edited message (deleting everything after this point)
    const priorMessages = messages.slice(0, targetIdx);
    const textToSend = editText.trim();

    setEditingMessageId(null);
    setEditText('');

    // Send the edited message starting from priorMessages
    handleSend(textToSend, priorMessages);
  };

  const handleToggleFeedback = (msgId, type) => {
    setFeedbackMap((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === type ? null : type,
    }));
  };

  const handleCopyMessage = async (msgId, text) => {
    try {
      const { cleanText } = extractMuneerAction(text);
      await navigator.clipboard.writeText(cleanText || text);
      setCopiedMsgId(msgId);
      setTimeout(() => {
        setCopiedMsgId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('complete');

  useEffect(() => {
    if (isHistoryModalOpen) {
      const fresh = getChatSessions();
      setSessions(fresh);
    }
  }, [isHistoryModalOpen]);

  const handleQuickTagClick = (prompt) => {
    setInputText(prompt);
    handleSend(prompt);
  };

  return (
    <div className="chat-view">
      <div className="chat-layout">
        {/* Hidden File Upload Input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          multiple
        />

        {/* Main Active Chat Area (Full-Width Card) */}
        <div
          className={`chat-main ${messages.some((m) => m.sender === 'user') ? 'active-mode' : 'hero-mode'}`}
          style={{ position: 'relative' }}
        >
          {!messages.some((m) => m.sender === 'user') ? (
            /* Gemini-Style Centered Hero Landing View for Empty/New Chats */
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 36px',
                gap: '24px',
                width: '100%',
              }}
            >
              {/* Centered Salam SVG Headline */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  maxWidth: '560px',
                  margin: '0 auto 10px auto',
                }}
              >
                <img
                  src="/salam.svg"
                  alt="السلام"
                  style={{
                    width: '100%',
                    maxWidth: '520px',
                    height: 'auto',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 24px rgba(0, 0, 0, 0.75))',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* Centered Floating Capsule Input Bar (matching reference design) */}
              {!isOnline ? (
                <div
                  className="chat-input-capsule"
                  style={{
                    width: 'min(100%, 740px)',
                    minHeight: '54px',
                    backgroundColor: 'rgba(18, 14, 2, 0.92)',
                    border: '1px solid rgba(234, 179, 8, 0.4)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '8px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'clamp(0.78rem, 1.4vw, 0.86rem)', color: '#fde047', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                    <AlertTriangle size={18} style={{ color: '#fde047', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isEn
                        ? 'Warning: Internet disconnected — AI Chat is locked (History available)'
                        : 'تحذير: انقطع الاتصال بالإنترنت — المحادثة مقفلة (تصفح السجل متاح)'}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      color: '#fde047',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(234, 179, 8, 0.15)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      whiteSpace: 'nowrap',
                      fontWeight: '700',
                    }}
                  >
                    <Lock size={13} />
                    <span>{isEn ? 'Offline' : 'بدون إنترنت'}</span>
                  </div>
                </div>
              ) : !hasGeminiKey ? (
                <div
                  className="chat-input-capsule"
                  style={{
                    width: 'min(100%, 740px)',
                    minHeight: '54px',
                    backgroundColor: 'rgba(10, 10, 10, 0.88)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '8px 16px 8px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--status-late)', fontWeight: '600' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{isEn ? 'Gemini API Key is required to enable chat with Sheikh Muneer' : 'يلزم إضافة مفتاح Gemini API لتفعيل الدردشة مع الشيخ منير'}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.80rem', padding: '6px 14px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' }}
                    onClick={onNavigateToSettings}
                  >
                    <span>{isEn ? 'Go to Settings' : 'الانتقال للإعدادات'}</span>
                  </button>
                </div>
              ) : (
                <div
                  className="chat-input-capsule"
                  style={{
                    width: 'min(100%, 740px)',
                    minHeight: '54px',
                    backgroundColor: 'rgba(10, 10, 10, 0.88)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '6px 8px 6px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* 1. Model Icon when empty, or Send Button when active */}
                  {hasInputContent ? (
                    <button
                      type="button"
                      className="btn-primary input-capsule-action"
                      onClick={() => handleSend()}
                      style={{
                        height: '40px',
                        padding: '0 20px',
                        borderRadius: 'var(--radius-pill)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.88rem',
                        fontWeight: '700',
                        flexShrink: 0,
                      }}
                      id="hero-send-btn"
                    >
                      <Send size={15} />
                      <span>{isEn ? 'Send' : 'إرسال'}</span>
                    </button>
                  ) : (
                    <div
                      className="input-capsule-action"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.07)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        flexShrink: 0,
                      }}
                      title={isEn ? 'Sheikh Muneer AI' : 'الشيخ منير الذكي'}
                    >
                      <Sparkles size={18} />
                    </div>
                  )}

                  {/* 2. Inline Rich Input Editor (Text & Images mix inline) */}
                  <div
                    ref={heroEditorRef}
                    contentEditable={true}
                    dir={isEn ? 'ltr' : 'rtl'}
                    className="rich-chat-input"
                    data-placeholder={isEn ? 'Ask Sheikh Muneer...' : 'إسأل الشيخ منير…'}
                    onInput={(e) => {
                      const hasAny =
                        e.currentTarget.innerText.trim().length > 0 ||
                        e.currentTarget.querySelectorAll('.inline-file-chip').length > 0;
                      setHasInputContent(hasAny);
                    }}
                    onPaste={(e) =>
                      handleEditorPaste(
                        e,
                        heroEditorRef.current,
                        attachedFilesMapRef,
                        setHasInputContent
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    id="hero-chat-input"
                  />

                  {/* 3. Model Indicator Badge */}
                  <div
                    className="input-capsule-model"
                    style={{
                      height: '32px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '0 12px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.10)',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <span>Muneer AI</span>
                  </div>

                  {/* 4. Attach File (+) Button */}
                  <button
                    type="button"
                    className="input-capsule-attach"
                    style={{
                      width: '38px',
                      height: '38px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.10)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      borderRadius: '50%',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    title={isEn ? 'Attach files or images' : 'إرفاق ملفات أو مستندات'}
                    id="hero-attach-file-btn"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              )}

              {/* Disclaimer Note */}
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  marginTop: '-18px',
                  opacity: 0.85,
                  userSelect: 'none',
                }}
              >
                {isEn ? 'Sheikh Muneer may make mistakes. Please verify religious rulings.' : 'قد يرتكب الشيخ منير أخطاءً، لذا يُرجى التحقق من ردوده.'}
              </div>

              {/* Generating Suggestions Loading Indicator (3 Animated Dots) */}
              {isGeneratingSuggestions && (!Array.isArray(dailySuggestions) || dailySuggestions.length === 0) && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '8px 22px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem',
                    animation: 'fadeIn 0.25s ease-out',
                  }}
                >
                  <span style={{ opacity: 0.85 }}>{isEn ? 'Crafting daily suggestions' : 'جاري صياغة أسئلة واقتراحات اليوم'}</span>
                  <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}

              {/* Quick Dynamic Suggestion Prompt Cards (Generated dynamically by AI) */}
              {Array.isArray(dailySuggestions) && dailySuggestions.length > 0 && !isGeneratingSuggestions && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', maxWidth: '740px', alignItems: 'center' }}>
                  {dailySuggestions.map((promptText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleQuickTagClick(promptText)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.82rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{promptText}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Last Centered Elements: New Chat & Chat History Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  marginTop: '8px',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsHistoryModalOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 16px',
                    fontSize: '0.82rem',
                    borderRadius: 'var(--radius-pill)',
                  }}
                  id="open-history-modal-btn"
                  title={isEn ? 'View and manage chat history' : 'عرض وإدارة سجل المحادثات السابقة'}
                >
                  <History size={14} />
                  <span>{isEn ? 'Chat History' : 'سجل المحادثات'}</span>
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCreateNewSession}
                  disabled={isCurrentChatEmpty}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '7px 16px',
                    fontSize: '0.82rem',
                    borderRadius: 'var(--radius-pill)',
                    opacity: isCurrentChatEmpty ? 0.45 : 1,
                    cursor: isCurrentChatEmpty ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  id="new-chat-btn"
                  title={isCurrentChatEmpty ? (isEn ? 'Current chat is already empty' : 'المحادثة الحالية فارغة بالفعل') : (isEn ? 'Start a new conversation' : 'بدء محادثة جديدة')}
                >
                  <Plus size={14} />
                  <span>{isEn ? 'New Chat' : 'محادثة جديدة'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Active Chat Top Header Bar (Frameless & Clean) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  padding: '12px 20px',
                  borderBottom: 'none',
                  backgroundColor: 'transparent',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsHistoryModalOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      fontSize: '0.80rem',
                      borderRadius: 'var(--radius-pill)',
                    }}
                    id="active-open-history-btn"
                    title={isEn ? 'View chat history' : 'عرض سجل المحادثات'}
                  >
                    <History size={13} />
                    <span>{isEn ? 'Chat History' : 'سجل المحادثات'}</span>
                  </button>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleCreateNewSession}
                    disabled={isCurrentChatEmpty}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 12px',
                      fontSize: '0.80rem',
                      borderRadius: 'var(--radius-pill)',
                      opacity: isCurrentChatEmpty ? 0.45 : 1,
                      cursor: isCurrentChatEmpty ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    id="active-new-chat-btn"
                    title={isCurrentChatEmpty ? (isEn ? 'Current chat is already empty' : 'المحادثة الحالية فارغة بالفعل') : (isEn ? 'Start a new conversation' : 'بدء محادثة جديدة')}
                  >
                    <Plus size={13} />
                    <span>{isEn ? 'New Chat' : 'محادثة جديدة'}</span>
                  </button>
                </div>
              </div>

              {/* Chat Messages Window */}
              <div className="chat-messages">
            {messages.map((msg) => {
              if (!msg) return null;
              const safeText = typeof msg.text === 'string' ? msg.text : String(msg.text || '');

              return (
                <div key={msg.id} className={`message-bubble ${msg.sender === 'user' ? 'user' : 'assistant'} ${msg.status === 'pending' ? 'is-pending' : ''}`}>
                  {/* User Indicator (Icon + Name) + Pending Status Badge */}
                  {msg.sender === 'user' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        opacity: 0.9,
                        color: 'var(--text-muted, #a3a3a3)',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} />
                        <span>{(settings && settings.userName) || (isEn ? 'You' : 'أنت')}</span>
                      </div>

                      {msg.status === 'pending' && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.12)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            borderRadius: 'var(--radius-pill)',
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            fontWeight: '600',
                            color: '#ffffff',
                          }}
                        >
                          <Clock size={11} className="spin-slow" />
                          <span>{isEn ? 'Pending in Queue' : 'رسالة معلقة (في الانتظار)'}</span>
                          <button
                            type="button"
                            onClick={() => handleCancelPendingMessage(msg.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title={isEn ? 'Cancel pending message' : 'إلغاء الرسالة المعلقة'}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Content: Editing vs Segments vs Normal Text */}
                  {editingMessageId === msg.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                      {/* Warning notice indicating truncation after this point */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#ffffff',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          lineHeight: '1.4',
                        }}
                      >
                        <AlertCircle size={15} style={{ flexShrink: 0 }} />
                        <span>{isEn ? 'All messages and responses after this point will be removed, starting fresh with your edited prompt.' : 'سيتم مسح جميع الرسائل والردود بعد هذه النقطة والبدء من جديد بالسؤال المعدل.'}</span>
                      </div>

                      {/* Text input and action buttons */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="search"
                          className="form-input"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveEditedMessage(msg.id);
                            } else if (e.key === 'Escape') {
                              setEditingMessageId(null);
                            }
                          }}
                          style={{ fontSize: '0.9rem', padding: '8px 14px', flex: 1 }}
                          autoFocus
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck="false"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-form-type="other"
                          name="chat_message_edit_field"
                        />
                        <button
                          className="btn-primary"
                          style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                          onClick={() => handleSaveEditedMessage(msg.id)}
                          disabled={!editText.trim() || isLoading || isStreaming}
                          title={isEn ? 'Save and Resend' : 'حفظ وإعادة الإرسال'}
                        >
                          <Send size={13} />
                          <span>{isEn ? 'Send' : 'إرسال'}</span>
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => setEditingMessageId(null)}
                          title={isEn ? 'Cancel Edit' : 'إلغاء التعديل'}
                        >
                          <X size={14} />
                          <span>{isEn ? 'Cancel' : 'إلغاء'}</span>
                        </button>
                      </div>
                    </div>
                  ) : Array.isArray(msg.segments) && msg.segments.length > 0 ? (
                    <div
                      style={{
                        lineHeight: '1.7',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      {msg.segments.map((seg, sIdx) => {
                        if (seg.type === 'text') {
                          return <span key={sIdx}>{parseInlineMarkdown(seg.value)}</span>;
                        }
                        if (seg.type === 'file') {
                          return <FilePreviewItem key={sIdx} file={seg.file} compact={true} />;
                        }
                        return null;
                      })}
                    </div>
                  ) : (
                    (() => {
                      const extracted = msg.action ? { cleanText: safeText, action: msg.action } : extractMuneerAction(safeText);
                      const displayCleanText = extracted.cleanText || safeText;

                      return (
                        <div style={{ lineHeight: '1.7', position: 'relative' }}>
                          {formatMarkdownText(displayCleanText, msg.isTyping)}
                        </div>
                      );
                    })()
                  )}

                  {/* User Message Bottom Action Toolbar */}
                  {msg.sender === 'user' && editingMessageId !== msg.id && (
                    <div className={`message-action-toolbar ${hoveredInfoMsgId === msg.id ? 'is-active' : ''}`}>
                      <div
                        className="message-action-toolbar-inner"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: 'var(--text-muted, #a3a3a3)',
                          fontSize: '0.75rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* 1. Edit */}
                        <button
                          type="button"
                          className="assistant-action-btn"
                          onClick={() => handleStartEditMessage(msg)}
                          title={isEn ? 'Edit Prompt' : 'تعديل الطلب'}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                          }}
                        >
                          <Edit2 size={15} />
                        </button>

                        {/* 2. Spellcheck / Fix Typos */}
                        <button
                          type="button"
                          className="assistant-action-btn"
                          onClick={() => handleCorrectSpelling(msg)}
                          disabled={correctingMsgId === msg.id}
                          title={
                            correctingMsgId === msg.id
                              ? (isEn ? 'Correcting spelling...' : 'جاري تدقيق وتصحيح الأخطاء الإملائية...')
                              : (isEn ? 'AI Spelling Correction' : 'تصحيح الأخطاء الإملائية بالذكاء الاصطناعي دون تغيير الكلمات')
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            color: correctingMsgId === msg.id ? '#ffffff' : 'inherit',
                            cursor: correctingMsgId === msg.id ? 'wait' : 'pointer',
                            padding: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                            opacity: correctingMsgId === msg.id ? 0.7 : 1,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <SpellCheck
                            size={15}
                            style={{
                              animation: correctingMsgId === msg.id ? 'spin 1s linear infinite' : 'none',
                            }}
                          />
                        </button>

                        {/* 3. Resend */}
                        <button
                          type="button"
                          className="assistant-action-btn"
                          onClick={() => handleResendUserMessage(msg)}
                          disabled={isLoading || isStreaming}
                          title={isEn ? 'Resend Prompt' : 'إعادة إرسال هذا الطلب'}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            cursor: isLoading || isStreaming ? 'not-allowed' : 'pointer',
                            padding: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                          }}
                        >
                          <RotateCcw size={15} />
                        </button>

                        {/* 3. Copy */}
                        <button
                          type="button"
                          className="assistant-action-btn"
                          onClick={() => handleCopyMessage(msg.id, safeText)}
                          title={isEn ? 'Copy Text' : 'نسخ النص'}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: copiedMsgId === msg.id ? 'var(--status-on-time, #ffffff)' : 'inherit',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                          }}
                        >
                          {copiedMsgId === msg.id ? <Check size={15} /> : <Copy size={15} />}
                        </button>

                        {/* 4. Delete */}
                        <button
                          type="button"
                          className="assistant-action-btn"
                          onClick={() => handleDeleteMessage(msg.id)}
                          title={isEn ? 'Delete Message' : 'حذف هذه الرسالة'}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                          }}
                        >
                          <Trash2 size={15} />
                        </button>

                        {/* 5. Info with floating Detail Card on Hover */}
                        <div
                          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                          onMouseEnter={() => setHoveredInfoMsgId(msg.id)}
                          onMouseLeave={() => setHoveredInfoMsgId(null)}
                        >
                          <button
                            type="button"
                            className="assistant-action-btn"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: hoveredInfoMsgId === msg.id ? '#ffffff' : 'inherit',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                            }}
                          >
                            <Info size={15} />
                          </button>

                          {/* Floating Detail Popup Frame */}
                          {hoveredInfoMsgId === msg.id && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: '100%',
                                right: isEn ? 'auto' : '-10px',
                                left: isEn ? '-10px' : 'auto',
                                marginBottom: '8px',
                                backgroundColor: 'rgba(10, 10, 10, 0.88)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '8px',
                                padding: '8px 14px',
                                boxShadow: '0 10px 28px rgba(0, 0, 0, 0.7)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                width: 'max-content',
                                minWidth: '140px',
                                whiteSpace: 'nowrap',
                                zIndex: 60,
                                pointerEvents: 'none',
                                animation: 'previewFadeIn 0.15s ease-out',
                                textAlign: isEn ? 'left' : 'right',
                                direction: isEn ? 'ltr' : 'rtl',
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary, #d4d4d4)',
                                fontWeight: '400',
                              }}
                            >
                              {msg.timestamp && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', whiteSpace: 'nowrap' }}>
                                  <span style={{ whiteSpace: 'nowrap' }}>{isEn ? 'Time' : 'الوقت'}</span>
                                  <span style={{ whiteSpace: 'nowrap' }}>{msg.timestamp}</span>
                                </div>
                              )}

                              {msg.isEdited && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', whiteSpace: 'nowrap' }}>
                                  <span style={{ whiteSpace: 'nowrap' }}>{isEn ? 'Status' : 'الحالة'}</span>
                                  <span style={{ whiteSpace: 'nowrap', color: 'var(--status-on-time, #ffffff)' }}>{isEn ? 'Edited' : 'معدلة'}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Assistant Message Bottom Action & Meta Bar */}
                  {msg.sender === 'assistant' && !msg.isTyping && (
                    <div className={`message-action-toolbar ${hoveredInfoMsgId === msg.id || feedbackMap[msg.id] ? 'is-active' : ''}`}>
                      <div
                        className="message-action-toolbar-inner"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          color: 'var(--text-muted, #a3a3a3)',
                          fontSize: '0.75rem',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* Action Buttons: Like, Dislike, Regenerate, Copy, Delete, Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* 1. Thumbs Up */}
                          <button
                            type="button"
                            className="assistant-action-btn"
                            onClick={() => handleToggleFeedback(msg.id, 'up')}
                            title={isEn ? 'Good response' : 'إعجاب بالإجابة'}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: feedbackMap[msg.id] === 'up' ? 'var(--status-on-time, #ffffff)' : 'inherit',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                            }}
                          >
                            <ThumbsUp size={15} fill={feedbackMap[msg.id] === 'up' ? 'currentColor' : 'none'} />
                          </button>

                          {/* 2. Thumbs Down */}
                          <button
                            type="button"
                            className="assistant-action-btn"
                            onClick={() => handleToggleFeedback(msg.id, 'down')}
                            title={isEn ? 'Bad response' : 'عدم إعجاب'}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: feedbackMap[msg.id] === 'down' ? '#ef4444' : 'inherit',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                            }}
                          >
                            <ThumbsDown size={15} fill={feedbackMap[msg.id] === 'down' ? 'currentColor' : 'none'} />
                          </button>

                          {/* 3. Regenerate */}
                          <button
                            type="button"
                            className="assistant-action-btn"
                            onClick={() => handleRegenerateResponse(msg.id)}
                            disabled={isLoading || isStreaming}
                            title={isEn ? 'Regenerate response' : 'إعادة توليد الرد'}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'inherit',
                              cursor: isLoading || isStreaming ? 'not-allowed' : 'pointer',
                              padding: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                            }}
                          >
                            <RotateCw size={15} className={isLoading ? 'spin' : ''} />
                          </button>

                          {/* 4. Copy */}
                          <button
                            type="button"
                            className="assistant-action-btn"
                            onClick={() => handleCopyMessage(msg.id, safeText)}
                            title={isEn ? 'Copy response' : 'نسخ الرد'}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiedMsgId === msg.id ? 'var(--status-on-time, #ffffff)' : 'inherit',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                            }}
                          >
                            {copiedMsgId === msg.id ? <Check size={15} /> : <Copy size={15} />}
                          </button>

                          {/* 5. Delete */}
                          <button
                            type="button"
                            className="assistant-action-btn"
                            onClick={() => handleDeleteMessage(msg.id)}
                            title={isEn ? 'Delete response' : 'حذف هذا الرد'}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'inherit',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                            }}
                          >
                            <Trash2 size={15} />
                          </button>

                          {/* 6. Info with custom Floating Detail Card on Hover */}
                          {msg.durationSeconds && (
                            <div
                              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                              onMouseEnter={() => setHoveredInfoMsgId(msg.id)}
                              onMouseLeave={() => setHoveredInfoMsgId(null)}
                            >
                              <button
                                type="button"
                                className="assistant-action-btn"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: hoveredInfoMsgId === msg.id ? '#ffffff' : 'inherit',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '6px',
                                }}
                              >
                                <Info size={15} />
                              </button>

                              {/* Floating Detail Popup Frame */}
                              {hoveredInfoMsgId === msg.id && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    right: isEn ? 'auto' : '-10px',
                                    left: isEn ? '-10px' : 'auto',
                                    marginBottom: '8px',
                                    backgroundColor: 'rgba(10, 10, 10, 0.88)',
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    padding: '8px 14px',
                                    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.7)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    width: 'max-content',
                                    minWidth: '160px',
                                    whiteSpace: 'nowrap',
                                    zIndex: 60,
                                    pointerEvents: 'none',
                                    animation: 'previewFadeIn 0.15s ease-out',
                                    textAlign: isEn ? 'left' : 'right',
                                    direction: isEn ? 'ltr' : 'rtl',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-secondary, #d4d4d4)',
                                    fontWeight: '400',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', whiteSpace: 'nowrap' }}>
                                    <span style={{ whiteSpace: 'nowrap' }}>{isEn ? 'Response Time' : 'سرعة الاستجابة'}</span>
                                    <span style={{ direction: 'ltr', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                      {msg.durationSeconds}s
                                    </span>
                                  </div>

                                  {msg.usedSearch && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', whiteSpace: 'nowrap' }}>
                                      <span style={{ whiteSpace: 'nowrap' }}>{isEn ? 'Source' : 'المصدر'}</span>
                                      <span style={{ whiteSpace: 'nowrap' }}>{isEn ? 'Live Web Search' : 'بحث ويب حي'}</span>
                                    </div>
                                  )}

                                  {msg.timestamp && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', whiteSpace: 'nowrap' }}>
                                      <span style={{ whiteSpace: 'nowrap' }}>{isEn ? 'Time' : 'الوقت'}</span>
                                      <span style={{ whiteSpace: 'nowrap' }}>{msg.timestamp}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Meta: Live Search Badge if active */}
                        {msg.usedSearch && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.85 }}>
                            <span
                              style={{
                                backgroundColor: 'var(--status-on-time-bg, rgba(255, 255, 255, 0.12))',
                                color: 'var(--status-on-time, #ffffff)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill, 9999px)',
                                fontSize: '0.7rem',
                                fontWeight: '600',
                              }}
                            >
                              بحث ويب حي
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Attached Files rendering for legacy messages */}
                  {!Array.isArray(msg.segments) && Array.isArray(msg.attachedFiles) && msg.attachedFiles.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '10px',
                        marginTop: '10px',
                      }}
                    >
                      {msg.attachedFiles.map((f, idx) => (
                        <FilePreviewItem key={idx} file={f} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Live Loading State (Three Animated Dots with Pure Smoothness) */}
            {typingState !== 'hidden' && (
              <div className={`typing-indicator-container ${typingState === 'exiting' ? 'exiting' : ''}`}>
                <div
                  className={`typing-indicator-pill ${typingState === 'exiting' ? 'exiting' : ''}`}
                  id="ai-typing-indicator"
                  aria-label={isEn ? 'Thinking...' : 'جاري التفكير...'}
                >
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            {errorMessage && (
              <div
                style={{
                  backgroundColor: 'var(--status-qada-bg)',
                  color: 'var(--status-qada)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <span>{errorMessage}</span>
                {messages.filter((m) => m && m.sender === 'user').length > 0 && (
                  <button
                    className="btn-secondary"
                    style={{
                      fontSize: '0.78rem',
                      padding: '4px 10px',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onClick={() => {
                      const userMsgs = messages.filter((m) => m && m.sender === 'user');
                      const lastUserMsg = userMsgs[userMsgs.length - 1];
                      if (lastUserMsg) handleResendUserMessage(lastUserMsg);
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>{isEn ? 'Retry' : 'إعادة المحاولة'}</span>
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Floating Streamlined Bottom Input Area (Clean & Transparent) */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              padding: '16px 20px 16px 20px',
              background: 'transparent',
              borderTop: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              pointerEvents: 'none',
            }}
          >
            {/* Input Capsule */}
            {!isOnline ? (
              <div
                className="chat-input-capsule"
                style={{
                  pointerEvents: 'auto',
                  width: '100%',
                  maxWidth: '860px',
                  minHeight: '52px',
                  backgroundColor: 'rgba(18, 14, 2, 0.92)',
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '8px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'clamp(0.78rem, 1.4vw, 0.86rem)', color: '#fde047', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                  <AlertTriangle size={18} style={{ color: '#fde047', flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isEn
                      ? 'Warning: Internet disconnected — AI Chat is locked (History available)'
                      : 'تحذير: انقطع الاتصال بالإنترنت — المحادثة مقفلة (تصفح السجل متاح)'}
                  </span>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    color: '#fde047',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    whiteSpace: 'nowrap',
                    fontWeight: '700',
                  }}
                >
                  <Lock size={13} />
                  <span>{isEn ? 'Offline' : 'بدون إنترنت'}</span>
                </div>
              </div>
            ) : !hasGeminiKey ? (
              <div
                className="chat-input-capsule"
                style={{
                  pointerEvents: 'auto',
                  width: '100%',
                  maxWidth: '860px',
                  minHeight: '52px',
                  backgroundColor: 'rgba(10, 10, 10, 0.88)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '8px 16px 8px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--status-late)', fontWeight: '600' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{isEn ? 'Gemini API Key is required to enable chat with Sheikh Muneer' : 'يلزم إضافة مفتاح Gemini API لتفعيل الدردشة مع الشيخ منير'}</span>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.80rem', padding: '6px 14px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' }}
                  onClick={onNavigateToSettings}
                >
                  <span>{isEn ? 'Go to Settings' : 'الانتقال للإعدادات'}</span>
                </button>
              </div>
            ) : (
              <div
                className="chat-input-capsule"
                style={{
                  pointerEvents: 'auto',
                  width: '100%',
                  maxWidth: '860px',
                  minHeight: '52px',
                  backgroundColor: 'rgba(10, 10, 10, 0.88)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '6px 8px 6px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  multiple
                />

                {/* 1. Send / Pause / Resume / Stop Buttons / Model Icon */}
                {isLoading || isStreaming ? (
                  <div className="input-capsule-action" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {/* Queue Pending Message Button if user typed text */}
                    {hasInputContent && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleSend()}
                        style={{
                          height: '38px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '0 14px',
                          borderRadius: 'var(--radius-pill)',
                          fontWeight: '700',
                          fontSize: '0.82rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                          color: '#ffffff',
                          cursor: 'pointer',
                        }}
                        title={isEn ? 'Queue pending message' : 'إرسال رسالة معلقة (في الطابور)'}
                        id="chat-queue-btn"
                      >
                        <Clock size={13} />
                        <span>{isEn ? 'Queue' : 'تعليق'}</span>
                      </button>
                    )}

                    {/* 1. Stop Button (Icon-only) */}
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={handleStopGeneration}
                      style={{
                        width: '38px',
                        height: '38px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        backgroundColor: 'rgba(239, 68, 68, 0.16)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      id="chat-stop-btn"
                      title={isEn ? 'Stop response' : 'إنهاء وإيقاف الرد'}
                      aria-label={isEn ? 'Stop response' : 'إنهاء وإيقاف الرد'}
                    >
                      <Square size={13} style={{ fill: 'currentColor' }} />
                    </button>

                    {/* 2. Pause / Resume Button (Icon-only, active when streaming) */}
                    {isStreaming && (
                      <button
                        type="button"
                        onClick={handleTogglePauseResume}
                        style={{
                          width: '38px',
                          height: '38px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          backgroundColor: isPaused ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.16)',
                          color: '#ffffff',
                          border: isPaused ? '1px solid rgba(255, 255, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.35)',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: isPaused ? '0 4px 12px rgba(0, 0, 0, 0.25)' : 'none',
                        }}
                        id="chat-pause-resume-btn"
                        title={isPaused ? (isEn ? 'Resume response' : 'استئناف كتابة الرد') : (isEn ? 'Pause response' : 'إيقاف الرد مؤقتاً')}
                        aria-label={isPaused ? (isEn ? 'Resume response' : 'استئناف كتابة الرد') : (isEn ? 'Pause response' : 'إيقاف الرد مؤقتاً')}
                      >
                        {isPaused ? <Play size={14} style={{ fill: 'currentColor' }} /> : <Pause size={14} style={{ fill: 'currentColor' }} />}
                      </button>
                    )}
                  </div>
                ) : hasInputContent ? (
                  <button
                    className="btn-primary input-capsule-action"
                    onClick={() => handleSend()}
                    style={{
                      height: '38px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '0 18px',
                      borderRadius: 'var(--radius-pill)',
                      fontWeight: '700',
                      fontSize: '0.86rem',
                      flexShrink: 0,
                    }}
                    id="chat-send-btn"
                  >
                    <Send size={15} />
                    <span>{isEn ? 'Send' : 'إرسال'}</span>
                  </button>
                ) : (
                  <div
                    className="input-capsule-action"
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.07)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0,
                    }}
                    title={isEn ? 'Sheikh Muneer AI' : 'الشيخ منير الذكي'}
                  >
                    <Sparkles size={17} />
                  </div>
                )}

                {/* 2. Inline Rich Input Editor (Text & Images mix inline) */}
                <div
                  ref={activeEditorRef}
                  contentEditable={true}
                  dir={isEn ? 'ltr' : 'rtl'}
                  className="rich-chat-input"
                  data-placeholder={isEn ? 'Ask Sheikh Muneer...' : 'إسأل الشيخ منير…'}
                  onInput={(e) => {
                    const hasAny =
                      e.currentTarget.innerText.trim().length > 0 ||
                      e.currentTarget.querySelectorAll('.inline-file-chip').length > 0;
                    setHasInputContent(hasAny);
                  }}
                  onPaste={(e) =>
                    handleEditorPaste(
                      e,
                      activeEditorRef.current,
                      attachedFilesMapRef,
                      setHasInputContent
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  id="chat-text-input"
                />

                {/* 3. Model Indicator Badge */}
                <div
                  className="input-capsule-model"
                  style={{
                    height: '30px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '0 10px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.10)',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <span>Muneer AI</span>
                </div>

                {/* 4. Attach File Button */}
                <button
                  type="button"
                  className="input-capsule-attach"
                  style={{
                    width: '36px',
                    height: '36px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.10)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    borderRadius: '50%',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title={isEn ? 'Attach files or images' : 'إضافة ملفات'}
                  id="attach-file-btn"
                >
                  <Paperclip size={16} />
                </button>
              </div>
            )}

            {/* Disclaimer Note below active input bar */}
            <div
              style={{
                pointerEvents: 'auto',
                fontSize: '0.70rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                opacity: 0.85,
                userSelect: 'none',
              }}
            >
              {isEn ? 'Sheikh Muneer may make mistakes. Please verify religious rulings.' : 'قد يرتكب الشيخ منير أخطاءً، لذا يُرجى التحقق من ردوده.'}
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {/* Secondary Floating Modal Window for Chat History & Sessions */}
      {typeof document !== 'undefined' && isHistoryModalOpen && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.80)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div
            className="bento-card"
            style={{
              backgroundColor: 'rgba(10, 10, 10, 0.88)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: 'var(--radius-lg)',
              width: 'min(94%, 540px)',
              maxHeight: '84vh',
              padding: '24px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.80)',
              color: 'var(--text-primary)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <History size={18} style={{ color: '#ffffff' }} />
                </div>
                <span style={{ fontWeight: '800', fontSize: '1.15rem', color: '#ffffff' }}>
                  {isEn ? 'Chat History' : 'سجل المحادثات'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.80rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    handleCreateNewSession();
                    setIsHistoryModalOpen(false);
                  }}
                  id="modal-new-chat-btn"
                >
                  <Plus size={14} />
                  <span>{isEn ? 'New Chat' : 'محادثة جديدة'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="nav-btn"
                  style={{ width: '34px', height: '34px' }}
                  title={isEn ? 'Close' : 'إغلاق'}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Category Filter Tabs */}
            {(() => {
              const nonNullSessions = validSessions.filter((s) => s && Array.isArray(s.messages));
              const completeSessionsCount = nonNullSessions.filter((s) => {
                const u = s.messages.filter((m) => m && m.sender === 'user').length;
                const a = s.messages.filter((m) => m && m.sender === 'assistant' && !m.isTyping).length;
                return u > 0 && a > 0;
              }).length;
              const pendingSessionsCount = nonNullSessions.filter((s) => {
                const u = s.messages.filter((m) => m && m.sender === 'user').length;
                const a = s.messages.filter((m) => m && m.sender === 'assistant' && !m.isTyping).length;
                return u > 0 && a === 0;
              }).length;

              const displayedSessions = nonNullSessions.filter((s) => {
                const u = s.messages.filter((m) => m && m.sender === 'user').length;
                const a = s.messages.filter((m) => m && m.sender === 'assistant' && !m.isTyping).length;
                if (historyFilter === 'pending') return u > 0 && a === 0;
                return u > 0 && a > 0;
              });

              return (
                <>
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      padding: '4px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('complete')}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.80rem',
                        fontWeight: '700',
                        backgroundColor: historyFilter === 'complete' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                        color: historyFilter === 'complete' ? '#ffffff' : 'var(--text-secondary)',
                        border: historyFilter === 'complete' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      {isEn ? `Complete (${completeSessionsCount})` : `مكتملة (${completeSessionsCount})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('pending')}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.80rem',
                        fontWeight: '700',
                        backgroundColor: historyFilter === 'pending' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                        color: historyFilter === 'pending' ? '#ffffff' : 'var(--text-secondary)',
                        border: historyFilter === 'pending' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      {isEn ? `Awaiting AI (${pendingSessionsCount})` : `بدون ردود (${pendingSessionsCount})`}
                    </button>
                  </div>

                  {/* Modal Sessions List */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '4px 2px',
                      maxHeight: '44vh',
                    }}
                  >
                    {displayedSessions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                        {isEn ? 'No conversations found in this category.' : 'لا توجد محادثات في هذا التصنيف.'}
                      </div>
                    ) : (
                      displayedSessions.map((sess) => {
                        const isActive = sess.id === activeSession.id;
                        const userCount = (sess.messages || []).filter((m) => m && m.sender === 'user').length;
                        const aiCount = (sess.messages || []).filter((m) => m && m.sender === 'assistant' && !m.isTyping).length;
                        const isComplete = userCount > 0 && aiCount > 0;
                        const isPending = userCount > 0 && aiCount === 0;
                        const msgCount = Array.isArray(sess.messages) ? sess.messages.length : 0;

                        return (
                          <div
                            key={sess.id}
                            onClick={() => {
                              handleSelectSession(sess.id);
                              setIsHistoryModalOpen(false);
                            }}
                            className="sub-glass-card"
                            style={{
                              padding: '11px 14px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: isActive ? 'rgba(255, 255, 255, 0.14)' : 'rgba(18, 18, 18, 0.65)',
                              border: isActive ? '1.5px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.10)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              transition: 'all 0.18s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                              <MessageSquare
                                size={16}
                                style={{
                                  flexShrink: 0,
                                  color: isComplete ? 'var(--status-on-time)' : isPending ? '#ffffff' : 'var(--text-secondary)',
                                  opacity: isActive ? 1 : 0.8,
                                }}
                              />
                              <span
                                style={{
                                  fontSize: '0.90rem',
                                  fontWeight: isActive ? '800' : '600',
                                  color: '#ffffff',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {typeof sess.title === 'string' ? sess.title : (isEn ? 'Conversation' : 'محادثة')}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: '600',
                                  color: 'var(--text-secondary)',
                                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-pill)',
                                }}
                              >
                                {msgCount} {isEn ? 'msgs' : 'رسائل'}
                              </span>
                              {isActive && <Check size={14} style={{ color: 'var(--status-on-time)' }} />}
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSessionById(e, sess.id)}
                                className="nav-btn"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  color: 'var(--status-missed)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                }}
                                title={isEn ? 'Delete conversation' : 'حذف المحادثة'}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              );
            })()}

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{
                  flex: 1,
                  fontSize: '0.84rem',
                  padding: '10px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--status-missed)',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
                onClick={() => {
                  handleDeleteCurrentSession();
                  setIsHistoryModalOpen(false);
                }}
                id="modal-delete-session-btn"
              >
                <Trash2 size={15} />
                <span>{isEn ? 'Delete Current Chat' : 'حذف المحادثة الحالية'}</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{
                  flex: 1,
                  fontSize: '0.84rem',
                  padding: '10px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: 'var(--radius-md)',
                }}
                onClick={() => {
                  handleResetAllChats();
                  setIsHistoryModalOpen(false);
                }}
                title={isEn ? 'Reset chat history' : 'إعادة تهيئة سجل المحادثات'}
              >
                <RefreshCw size={14} />
                <span>{isEn ? 'Reset History' : 'إعادة تهيئة السجل'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* High-Resolution Image Lightbox Modal with Smooth Animations */}
      {typeof document !== 'undefined' && previewImageModal && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.90)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            animation: 'previewFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
          onClick={() => setPreviewImageModal(null)}
        >
          {/* Floating Top Control Bar (Pure Fade-In Animation) */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '24px',
              left: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 2,
              direction: isEn ? 'ltr' : 'rtl',
              animation: 'previewFadeIn 0.22s ease-out forwards',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: '600',
                backgroundColor: 'rgba(10, 10, 10, 0.88)',
                padding: '6px 16px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              }}
            >
              <ImageIcon size={16} style={{ color: '#ffffff' }} />
              <span
                style={{
                  maxWidth: '300px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {previewImageModal.name || (isEn ? 'Image Preview' : 'معاينة الصورة')}
              </span>
              {previewImageModal.size && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  • {previewImageModal.size}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPreviewImageModal(null)}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.14)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={isEn ? 'Close Preview (Esc)' : 'إغلاق المعاينة (Esc)'}
            >
              <X size={20} />
            </button>
          </div>

          {/* Center High-Res Image (Pure Scale-Up Zoom Animation) */}
          <div
            style={{
              maxWidth: '92vw',
              maxHeight: '84vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              animation: 'previewZoomIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImageModal.content}
              alt={previewImageModal.name || (isEn ? 'Full image' : 'صورة كبيرة')}
              style={{
                maxWidth: '100%',
                maxHeight: '84vh',
                borderRadius: '12px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.90)',
                border: '1px solid rgba(255, 255, 255, 0.20)',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
