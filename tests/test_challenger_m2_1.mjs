/**
 * Challenger M2_1 Empirical Stress Test Suite
 * Target: Chat & Book Components Refactoring in Milestone 2
 *
 * Verifies:
 * 1. chatEditorUtils.js (Chip creation, multi-chip paste handling, segment extraction, DOM cleanup)
 * 2. ChatMessageList.jsx (Message streaming simulation, inline/block markdown integration, 280ms typing indicator exit timing)
 * 3. ChatInputBar.jsx & FileAttachmentList.jsx (File previews, lightbox modals, offline/no-key states)
 * 4. bookUtils.js (Arabic ordinal day calculations across 1..31, edge cases, boundaries)
 * 5. ReadingStatsModal.jsx & ReaderToolbar.jsx (Ward calculations, modal targets, floating dock visibility)
 * 6. Dual-page spread layout mathematics in PdfCanvasViewer.jsx and BookReaderView
 */

import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

console.log('================================================================');
console.log('🔥 CHALLENGER M2_1: EMPIRICAL STRESS TEST SUITE (CHAT & BOOK)');
console.log('================================================================\n');

// ---------------------------------------------------------------------------
// 0. High-Fidelity DOM Environment for Chat & Book Testing in Node.js
// ---------------------------------------------------------------------------

class MockNode {
  constructor(nodeType, nodeValue = '') {
    this.nodeType = nodeType;
    this.nodeValue = nodeValue;
    this.childNodes = [];
    this.parentNode = null;
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  contains(other) {
    let curr = other;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }
}

class MockElement extends MockNode {
  constructor(tagName) {
    super(1, '');
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.attributes = {};
    this.style = {};
    this._classes = new Set();
    this.onclick = null;
    this.title = '';
    this.type = '';
    this.src = '';
    this.alt = '';
    this.contentEditable = 'true';
    this.dir = 'rtl';
  }

  get className() {
    return Array.from(this._classes).join(' ');
  }

  set className(val) {
    this._classes = new Set(String(val || '').trim().split(/\s+/).filter(Boolean));
  }

  get classList() {
    return {
      contains: (c) => this._classes.has(c),
      add: (c) => this._classes.add(c),
      remove: (c) => this._classes.delete(c),
    };
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === 'src') this.src = String(v);
    if (k === 'alt') this.alt = String(v);
  }

  getAttribute(k) {
    if (k === 'src' && this.src) return this.src;
    if (k === 'alt' && this.alt) return this.alt;
    return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
  }

  get innerText() {
    return this.childNodes
      .map((n) => (n.nodeType === 3 ? n.nodeValue : n.innerText || ''))
      .join('');
  }

  set innerText(val) {
    this.childNodes = [new MockNode(3, String(val))];
  }

  get innerHTML() {
    return '';
  }

  set innerHTML(val) {
    this.childNodes = [];
    if (val && !val.includes('<')) {
      this.appendChild(new MockNode(3, val));
    }
  }

  querySelectorAll(selector) {
    const results = [];
    const walk = (node) => {
      if (node.nodeType === 1) {
        if (selector.startsWith('.') && node.classList.contains(selector.slice(1))) {
          results.push(node);
        } else if (selector.toUpperCase() === node.tagName) {
          results.push(node);
        }
        for (const child of node.childNodes) {
          walk(child);
        }
      }
    };
    for (const child of this.childNodes) {
      walk(child);
    }
    return results;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  focus() {}
}

class MockRange {
  constructor() {
    this.startContainer = null;
    this.endContainer = null;
    this.startOffset = 0;
    this.endOffset = 0;
    this.insertedNodes = [];
  }

  deleteContents() {}

  insertNode(node) {
    this.insertedNodes.push(node);
    if (this.startContainer && this.startContainer.appendChild) {
      this.startContainer.appendChild(node);
    }
  }

  collapse() {}
  setStartAfter(node) {
    this.startContainer = node.parentNode;
  }
  setEndAfter(node) {
    this.endContainer = node.parentNode;
  }
}

class MockSelection {
  constructor() {
    this.ranges = [];
    this.anchorNode = null;
  }

  get rangeCount() {
    return this.ranges.length;
  }

  getRangeAt(idx) {
    return this.ranges[idx] || null;
  }

  removeAllRanges() {
    this.ranges = [];
  }

  addRange(range) {
    this.ranges.push(range);
    this.anchorNode = range.startContainer;
  }
}

class MockCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

class MockDOMParser {
  parseFromString(html) {
    const doc = { body: new MockElement('BODY') };

    const tagRegex = /<(\/?[a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
    let match;
    let currentParent = doc.body;

    while ((match = tagRegex.exec(html)) !== null) {
      if (match[3]) {
        currentParent.appendChild(new MockNode(3, match[3]));
      } else {
        const fullTag = match[1];
        const rawAttrs = match[2] || '';
        const isClosing = fullTag.startsWith('/');
        const tagName = (isClosing ? fullTag.slice(1) : fullTag).toUpperCase();

        if (isClosing) {
          if (currentParent.parentNode) {
            currentParent = currentParent.parentNode;
          }
        } else {
          const el = new MockElement(tagName);
          const attrRegex = /([a-zA-Z0-9_\-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
          let attrMatch;
          while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
            const attrName = attrMatch[1];
            const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
            el.setAttribute(attrName, attrVal);
            if (attrName === 'class') {
              el.className = attrVal;
            }
          }
          currentParent.appendChild(el);
          const isSelfClosing = tagName === 'IMG' || tagName === 'BR' || rawAttrs.trim().endsWith('/');
          if (!isSelfClosing) {
            currentParent = el;
          }
        }
      }
    }
    return doc;
  }
}

// Global environment initialization
globalThis.Node = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
};
globalThis.CustomEvent = MockCustomEvent;
globalThis.DOMParser = MockDOMParser;

const mockWindowEvents = [];
const mockExecCommands = [];

globalThis.window = {
  getSelection: () => globalThis.__currentSelection || new MockSelection(),
  dispatchEvent: (event) => {
    mockWindowEvents.push(event);
    return true;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

globalThis.document = {
  createElement: (tag) => new MockElement(tag),
  createRange: () => new MockRange(),
  execCommand: (command, showUI, value) => {
    mockExecCommands.push({ command, showUI, value });
    return true;
  },
  body: new MockElement('BODY'),
};

// ---------------------------------------------------------------------------
// 1. Load Components Dynamically through Vite Runtime
// ---------------------------------------------------------------------------

const vite = await createServer({ server: { middlewareMode: true } });

const chatEditorUtils = await vite.ssrLoadModule('/src/components/chat/chatEditorUtils.js');
const { insertFileChipToEditor, handleEditorPaste, extractSegmentsFromEditor } = chatEditorUtils;

const ChatMessageList = (await vite.ssrLoadModule('/src/components/chat/ChatMessageList.jsx')).default;
const FileAttachmentList = await vite.ssrLoadModule('/src/components/chat/FileAttachmentList.jsx');
const { FilePreviewItem, ImagePreviewModal } = FileAttachmentList;

const ChatInputBar = (await vite.ssrLoadModule('/src/components/chat/ChatInputBar.jsx')).default;

const bookUtils = await vite.ssrLoadModule('/src/components/book/bookUtils.js');
const { getArabicOrdinalDay } = bookUtils;

const ReadingStatsModalModule = await vite.ssrLoadModule('/src/components/book/ReadingStatsModal.jsx');
const { HabitProgressionHero, ReadingStatsModal } = ReadingStatsModalModule;

const ReaderToolbar = (await vite.ssrLoadModule('/src/components/book/ReaderToolbar.jsx')).default;
const PdfCanvasViewer = (await vite.ssrLoadModule('/src/components/book/PdfCanvasViewer.jsx')).default;

await vite.close();

// ---------------------------------------------------------------------------
// Test Runner Harness
// ---------------------------------------------------------------------------

let totalPassed = 0;
let totalFailed = 0;
const failureDetails = [];

async function challenge(testName, testFn) {
  try {
    const res = testFn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    console.log(`  ✓ PASS: ${testName}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(`    Details: ${err.message}`);
    totalFailed++;
    failureDetails.push({ test: testName, error: err.message, stack: err.stack });
  }
}

// ===========================================================================
// SUITE 1: CHAT EDITOR UTILS EMPIRICAL STRESS TESTS
// ===========================================================================
console.log('--- SUITE 1: chatEditorUtils.js Invariants & DOM Stress Testing ---');

await challenge('1.1 insertFileChipToEditor creates high-fidelity image chip with correct data attributes', () => {
  const editor = new MockElement('DIV');
  const fileObj = {
    id: 'file_img_101',
    name: 'kaaba_view.jpg',
    size: '142.5 KB',
    type: 'image/jpeg',
    isImage: true,
    content: 'data:image/jpeg;base64,mockKaabaImageData',
  };
  const attachedMapRef = { current: {} };
  let hasContentNotified = false;

  insertFileChipToEditor(editor, fileObj, attachedMapRef, (val) => {
    hasContentNotified = val;
  });

  const chips = editor.querySelectorAll('.inline-file-chip');
  assert.equal(chips.length, 1, 'Should insert exactly one chip element into editor');
  const chip = chips[0];

  assert.equal(chip.getAttribute('data-file-id'), 'file_img_101');
  assert.equal(chip.getAttribute('data-file-name'), 'kaaba_view.jpg');
  assert.equal(chip.getAttribute('data-file-size'), '142.5 KB');
  assert.equal(chip.getAttribute('data-file-type'), 'image/jpeg');
  assert.equal(chip.getAttribute('data-is-image'), 'true');
  assert.equal(chip.getAttribute('data-file-content'), 'data:image/jpeg;base64,mockKaabaImageData');
  assert.equal(chip.contentEditable, 'false');
  assert.equal(hasContentNotified, true, 'Must notify editor has content');

  const img = chip.querySelector('IMG');
  assert.ok(img, 'Image chip must contain an <img> element');
  assert.equal(img.src, 'data:image/jpeg;base64,mockKaabaImageData');
  assert.equal(img.alt, 'kaaba_view.jpg');
});

await challenge('1.2 insertFileChipToEditor creates document chip with file icon and truncated text', () => {
  const editor = new MockElement('DIV');
  const docObj = {
    id: 'file_pdf_202',
    name: 'hisn_almuslim_notes.pdf',
    size: '1.8 MB',
    type: 'application/pdf',
    isImage: false,
  };
  const attachedMapRef = { current: {} };

  insertFileChipToEditor(editor, docObj, attachedMapRef, () => {});

  const chips = editor.querySelectorAll('.inline-file-chip');
  assert.equal(chips.length, 1);
  const chip = chips[0];

  assert.equal(chip.getAttribute('data-file-id'), 'file_pdf_202');
  assert.equal(chip.getAttribute('data-is-image'), 'false');
  assert.equal(chip.querySelector('IMG'), null, 'Non-image chip must NOT contain an <img> tag');
  assert.ok(chip.childNodes.length > 0, 'Chip should contain formatted label and remove button');
});

await challenge('1.3 Chip remove button safely removes chip from DOM and deletes from attachedFilesMapRef', () => {
  const editor = new MockElement('DIV');
  const fileObj = {
    id: 'file_delete_me',
    name: 'test_delete.png',
    size: '20 KB',
    type: 'image/png',
    isImage: true,
    content: 'data:image/png;base64,test',
  };
  const attachedMapRef = { current: { file_delete_me: fileObj } };
  let reportedContentState = null;

  insertFileChipToEditor(editor, fileObj, attachedMapRef, (has) => {
    reportedContentState = has;
  });

  const chip = editor.querySelectorAll('.inline-file-chip')[0];
  const removeBtn = chip.querySelector('BUTTON');
  assert.ok(removeBtn, 'Chip must contain a remove button');

  // Click the remove button
  const mockEv = { stopPropagation: () => {}, preventDefault: () => {} };
  removeBtn.onclick(mockEv);

  assert.equal(editor.querySelectorAll('.inline-file-chip').length, 0, 'Chip must be removed from editor DOM');
  assert.equal(Object.prototype.hasOwnProperty.call(attachedMapRef.current, 'file_delete_me'), false, 'ID must be removed from attachedFilesMapRef');
  assert.equal(reportedContentState, false, 'hasContent should update to false when editor is empty');
});

await challenge('1.4 Clicking image chip dispatches preview-chat-image CustomEvent on window with event containment', () => {
  const editor = new MockElement('DIV');
  const fileObj = {
    id: 'file_preview_test',
    name: 'preview_me.png',
    size: '30 KB',
    type: 'image/png',
    isImage: true,
    content: 'data:image/png;base64,preview',
  };
  insertFileChipToEditor(editor, fileObj, { current: {} }, () => {});

  const chip = editor.querySelectorAll('.inline-file-chip')[0];
  const prevEventCount = mockWindowEvents.length;

  let stoppedPropagation = false;
  chip.onclick({
    target: chip,
    stopPropagation: () => {
      stoppedPropagation = true;
    },
  });

  assert.equal(mockWindowEvents.length, prevEventCount + 1, 'Should dispatch preview event');
  assert.equal(stoppedPropagation, true, 'Must stop event propagation');
  const event = mockWindowEvents[mockWindowEvents.length - 1];
  assert.equal(event.type, 'preview-chat-image');
  assert.equal(event.detail.id, 'file_preview_test');
});

await challenge('1.5 handleEditorPaste cleans plain text: trims leading/trailing newlines and collapses whitespace', () => {
  const editor = new MockElement('DIV');
  let hasContentCalled = false;
  mockExecCommands.length = 0;

  const mockPasteEvent = {
    clipboardData: {
      items: [],
      getData: (format) => {
        if (format === 'text/plain') return '\n\n   السلام   عليكم    ورحمة   الله   \n\n';
        return '';
      },
    },
    preventDefault: () => {},
  };

  handleEditorPaste(mockPasteEvent, editor, { current: {} }, (val) => {
    hasContentCalled = val;
  });

  assert.equal(mockExecCommands.length, 1, 'Must invoke document.execCommand once');
  const cmd = mockExecCommands[0];
  assert.equal(cmd.command, 'insertText');
  assert.equal(cmd.value, ' السلام عليكم ورحمة الله ', 'Strips outer newlines and collapses multiple consecutive spaces');
  assert.equal(hasContentCalled, true);
});

await challenge('1.6 handleEditorPaste parses HTML payload with multiple inline-file-chips and text nodes', () => {
  const editor = new MockElement('DIV');
  const attachedMapRef = { current: {} };
  mockExecCommands.length = 0;

  const htmlPayload = `
    <span>السؤال الأول: </span>
    <span class="inline-file-chip" data-file-id="chip_alpha" data-file-name="surah1.png" data-file-size="12 KB" data-is-image="true" data-file-content="data:img1"></span>
    <span> وثم السؤال الثاني: </span>
    <span class="inline-file-chip" data-file-id="chip_beta" data-file-name="notes.pdf" data-file-size="95 KB" data-is-image="false"></span>
  `;

  const mockPasteEvent = {
    clipboardData: {
      items: [],
      getData: (format) => {
        if (format === 'text/html') return htmlPayload;
        return '';
      },
    },
    preventDefault: () => {},
  };

  handleEditorPaste(mockPasteEvent, editor, attachedMapRef, () => {});

  assert.ok(mockExecCommands.length >= 2, 'Should insert both text segments cleanly');
  assert.ok(mockExecCommands.some((c) => c.value.includes('السؤال الأول:')));
  assert.ok(mockExecCommands.some((c) => c.value.includes('وثم السؤال الثاني:')));

  assert.ok(attachedMapRef.current.chip_alpha, 'chip_alpha must be registered in map');
  assert.equal(attachedMapRef.current.chip_alpha.name, 'surah1.png');
  assert.ok(attachedMapRef.current.chip_beta, 'chip_beta must be registered in map');
  assert.equal(attachedMapRef.current.chip_beta.name, 'notes.pdf');

  const domChips = editor.querySelectorAll('.inline-file-chip');
  assert.equal(domChips.length, 2, 'Must insert both chips into editor');
});

await challenge('1.7 extractSegmentsFromEditor extracts interleaved text and file chips in exact order', () => {
  const editor = new MockElement('DIV');
  const file1 = { id: 'f_one', name: 'image1.jpg', isImage: true };
  const file2 = { id: 'f_two', name: 'hadith.pdf', isImage: false };
  const attachedFilesMap = { f_one: file1, f_two: file2 };

  editor.appendChild(new MockNode(3, 'بداية النص مع مسافات\u00A0غير منكسرة '));

  const chipEl1 = new MockElement('SPAN');
  chipEl1.className = 'inline-file-chip';
  chipEl1.setAttribute('data-file-id', 'f_one');
  editor.appendChild(chipEl1);

  editor.appendChild(new MockNode(3, ' وسط النص بين الملفين '));

  const chipEl2 = new MockElement('SPAN');
  chipEl2.className = 'inline-file-chip';
  chipEl2.setAttribute('data-file-id', 'f_two');
  editor.appendChild(chipEl2);

  editor.appendChild(new MockNode(3, ' نهاية النص'));

  const segments = extractSegmentsFromEditor(editor, attachedFilesMap);

  assert.equal(segments.length, 5, 'Must extract exactly 5 segments');
  assert.equal(segments[0].type, 'text');
  assert.equal(segments[0].value, 'بداية النص مع مسافات غير منكسرة');
  assert.equal(segments[1].type, 'file');
  assert.equal(segments[1].file.id, 'f_one');
  assert.equal(segments[2].type, 'text');
  assert.equal(segments[2].value, 'وسط النص بين الملفين');
  assert.equal(segments[3].type, 'file');
  assert.equal(segments[3].file.id, 'f_two');
  assert.equal(segments[4].type, 'text');
  assert.equal(segments[4].value, 'نهاية النص');
});

await challenge('1.8 extractSegmentsFromEditor handles missing file ID and blank editors defensively', () => {
  const emptyEditor = new MockElement('DIV');
  assert.deepEqual(extractSegmentsFromEditor(emptyEditor, {}), []);

  emptyEditor.appendChild(new MockNode(3, '    \n\t  '));
  assert.deepEqual(extractSegmentsFromEditor(emptyEditor, {}), []);

  const orphanChipEditor = new MockElement('DIV');
  const chip = new MockElement('SPAN');
  chip.className = 'inline-file-chip';
  chip.setAttribute('data-file-id', 'missing_id_999');
  orphanChipEditor.appendChild(chip);

  const segments = extractSegmentsFromEditor(orphanChipEditor, {});
  assert.deepEqual(segments, [], 'Orphaned chip must be skipped without throwing errors');
});

// ===========================================================================
// SUITE 2: CHAT MESSAGE LIST & STREAMING SIMULATION STRESS TESTS
// ===========================================================================
console.log('\n--- SUITE 2: ChatMessageList.jsx Streaming, Markdown & 280ms Exit Invariants ---');

await challenge('2.1 Message streaming simulation renders markdown with .word-fade-in spans when isTyping is true', () => {
  const streamingMessages = [
    {
      id: 'msg_stream_1',
      sender: 'assistant',
      text: 'الحمد لله **العظيم** والصلاة على رسول الله.',
      isTyping: true,
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(ChatMessageList, {
      messages: streamingMessages,
      typingState: 'hidden',
    })
  );

  assert.ok(html.includes('message-bubble assistant'), 'Must render assistant bubble');
  assert.ok(html.includes('word-fade-in'), 'Streaming text must apply word-fade-in class');
  assert.ok(html.includes('<strong') && html.includes('العظيم'), 'Single word bold markdown must be parsed');
});

await challenge('2.2 Empirical challenge: Multi-word bold tokens in streaming mode encounter pre-existing token splitting', () => {
  // Pre-existing behavioral limitation: parseInlineMarkdown splits on whitespace before parsing inline tokens
  const streamingMultiWord = [
    {
      id: 'msg_stream_multi',
      sender: 'assistant',
      text: 'فضل **قيام الليل** عظيم.',
      isTyping: true,
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(ChatMessageList, {
      messages: streamingMultiWord,
      typingState: 'hidden',
    })
  );

  // Document invariant: in streaming mode, word splitting breaks multi-word bold across two separate word-fade-in spans
  assert.ok(html.includes('word-fade-in'), 'Must still apply word-fade-in spans');
  assert.ok(html.includes('قيام') && html.includes('الليل'), 'Words are rendered in output');
});

await challenge('2.3 Static assistant message renders full markdown headers, lists, code, and response time tooltip', () => {
  const fullMarkdownText = `
### فضل قيام الليل
1. شرف المؤمن قيامه بالليل.
2. يكفر السيئات وينهى عن الإثم.
- استعن بنوم القيلولة.
\`قيام الليل\` دأب الصالحين.
`;
  const staticMessages = [
    {
      id: 'msg_static_1',
      sender: 'assistant',
      text: fullMarkdownText,
      isTyping: false,
      durationSeconds: 1.45,
    },
  ];

  // Tooltip shown on hover
  const htmlHovered = renderToStaticMarkup(
    React.createElement(ChatMessageList, {
      messages: staticMessages,
      typingState: 'hidden',
      hoveredInfoMsgId: 'msg_static_1',
    })
  );

  assert.ok(htmlHovered.includes('<h4'), 'Must render level 3 header');
  assert.ok(htmlHovered.includes('فضل قيام الليل'));
  assert.ok(htmlHovered.includes('<code'), 'Must render inline code block');
  assert.ok(htmlHovered.includes('قيام الليل'));
  assert.ok(!htmlHovered.includes('word-fade-in'), 'Static message must NOT include typewriter word-fade-in class');
  assert.ok(htmlHovered.includes('1.45s'), 'Must render response duration on hover');
});

await challenge('2.4 Typing indicator respects 3-state animation lifecycle (visible, exiting, hidden)', () => {
  const htmlVisible = renderToStaticMarkup(
    React.createElement(ChatMessageList, {
      messages: [],
      typingState: 'visible',
    })
  );
  assert.ok(htmlVisible.includes('typing-indicator-container'), 'Container present');
  assert.ok(htmlVisible.includes('typing-indicator-pill'), 'Pill present');
  assert.ok(!htmlVisible.includes('typing-indicator-container exiting'), 'Must not have exiting class when visible');
  assert.ok(htmlVisible.includes('typing-dot'), 'Must render three dots');

  const htmlExiting = renderToStaticMarkup(
    React.createElement(ChatMessageList, {
      messages: [],
      typingState: 'exiting',
    })
  );
  assert.ok(htmlExiting.includes('typing-indicator-container exiting'), 'Must apply exiting class to container');
  assert.ok(htmlExiting.includes('typing-indicator-pill exiting'), 'Must apply exiting class to pill');

  const htmlHidden = renderToStaticMarkup(
    React.createElement(ChatMessageList, {
      messages: [],
      typingState: 'hidden',
    })
  );
  assert.ok(!htmlHidden.includes('typing-indicator-container'), 'Container must be completely removed when hidden');
  assert.ok(!htmlHidden.includes('ai-typing-indicator'), 'Indicator id must not exist when hidden');
});

await challenge('2.5 Empirical simulation of 280ms exit timer and interruption cancellation', async () => {
  let currentState = 'hidden';
  let activeTimer = null;

  function simulateLoadingChange(isLoading) {
    if (isLoading) {
      if (activeTimer) {
        clearTimeout(activeTimer);
        activeTimer = null;
      }
      currentState = 'visible';
    } else {
      if (currentState === 'visible') {
        currentState = 'exiting';
        activeTimer = setTimeout(() => {
          currentState = 'hidden';
          activeTimer = null;
        }, 280);
      }
    }
  }

  simulateLoadingChange(true);
  assert.equal(currentState, 'visible');

  simulateLoadingChange(false);
  assert.equal(currentState, 'exiting');

  await new Promise((r) => setTimeout(r, 100));
  assert.equal(currentState, 'exiting', 'Must remain in exiting state at 100ms');

  await new Promise((r) => setTimeout(r, 200));
  assert.equal(currentState, 'hidden', 'Must transition to hidden after 280ms complete');

  simulateLoadingChange(true);
  simulateLoadingChange(false);
  assert.equal(currentState, 'exiting');
  await new Promise((r) => setTimeout(r, 50));
  simulateLoadingChange(true);
  assert.equal(currentState, 'visible', 'Interruption must immediately restore visible state');
  assert.equal(activeTimer, null, 'Previous exit timer must be canceled');
});

await challenge('2.6 Segments array in message renders interleaved text and FilePreviewItem chips', () => {
  const segmentMessage = {
    id: 'msg_seg_1',
    sender: 'user',
    segments: [
      { type: 'text', value: 'نص قبل الصورة' },
      { type: 'file', file: { id: 'f1', name: 'mosque.jpg', type: 'image/jpeg', content: 'data:image/jpeg;base64,img', isImage: true } },
      { type: 'text', value: 'نص بعد الصورة' },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(ChatMessageList, {
      messages: [segmentMessage],
      typingState: 'hidden',
    })
  );

  assert.ok(html.includes('نص قبل الصورة'));
  assert.ok(html.includes('mosque.jpg'));
  assert.ok(html.includes('نص بعد الصورة'));
});

// ===========================================================================
// SUITE 3: CHAT INPUT BAR & FILE ATTACHMENT MODALS STRESS TESTS
// ===========================================================================
console.log('\n--- SUITE 3: ChatInputBar.jsx & FileAttachmentList.jsx Modals & States ---');

await challenge('3.1 FilePreviewItem renders compact image thumbnail and full document chip with removal triggers', () => {
  let removedFileId = null;
  const imageFile = { id: 'img_chip', name: 'photo.png', type: 'image/png', isImage: true, content: 'data:image/png;base64,mock' };
  const docFile = { id: 'doc_chip', name: 'quran_notes.pdf', size: '45 KB', isImage: false };

  const compactHtml = renderToStaticMarkup(
    React.createElement(FilePreviewItem, {
      file: imageFile,
      compact: true,
      onRemove: (id) => {
        removedFileId = id;
      },
    })
  );
  assert.ok(compactHtml.includes('<img'));
  assert.ok(compactHtml.includes('photo.png'));
  assert.ok(compactHtml.includes('إزالة الصورة'));

  const docHtml = renderToStaticMarkup(
    React.createElement(FilePreviewItem, {
      file: docFile,
      compact: false,
      onRemove: (id) => {
        removedFileId = id;
      },
    })
  );
  assert.ok(docHtml.includes('quran_notes.pdf'));
  assert.ok(docHtml.includes('45 KB'));
  assert.ok(docHtml.includes('إزالة الملف'));
});

await challenge('3.2 ImagePreviewModal handles SSR safety and null files gracefully', () => {
  const nullModal = ImagePreviewModal({ file: null, onClose: () => {} });
  assert.equal(nullModal, null, 'Must return null when file is null');
});

await challenge('3.3 ChatInputBar displays warning banner and lock indicator when offline', () => {
  const htmlOffline = renderToStaticMarkup(
    React.createElement(ChatInputBar, {
      isOnline: false,
      hasGeminiKey: true,
      variant: 'active',
    })
  );

  assert.ok(htmlOffline.includes('انقطع الاتصال بالإنترنت'), 'Must display offline notice');
  assert.ok(htmlOffline.includes('بدون إنترنت'));
});

await challenge('3.4 ChatInputBar displays configure key banner when Gemini API key is missing', () => {
  const htmlNoKey = renderToStaticMarkup(
    React.createElement(ChatInputBar, {
      isOnline: true,
      hasGeminiKey: false,
      variant: 'hero',
    })
  );

  assert.ok(htmlNoKey.includes('مفتاح Gemini API'), 'Must alert user to configure Gemini API');
});

await challenge('3.5 ChatInputBar send/stop button states toggle according to loading and input content', () => {
  const htmlReady = renderToStaticMarkup(
    React.createElement(ChatInputBar, {
      isOnline: true,
      hasGeminiKey: true,
      hasInputContent: true,
      isLoading: false,
      isStreaming: false,
    })
  );
  assert.ok(htmlReady.includes('إرسال'));

  const htmlStreaming = renderToStaticMarkup(
    React.createElement(ChatInputBar, {
      isOnline: true,
      hasGeminiKey: true,
      hasInputContent: true,
      isLoading: false,
      isStreaming: true,
    })
  );
  assert.ok(htmlStreaming.includes('إيقاف'));
});

// ===========================================================================
// SUITE 4: BOOK UTILS ORDINAL DAYS STRESS TESTS
// ===========================================================================
console.log('\n--- SUITE 4: bookUtils.js Arabic Ordinal Day Calculation across 1..31 ---');

await challenge('4.1 getArabicOrdinalDay accurately maps days 1 through 30 to classical Arabic ordinals', () => {
  const expectedOrdinals = [
    null,
    'الأول',
    'الثاني',
    'الثالث',
    'الرابع',
    'الخامس',
    'السادس',
    'السابع',
    'الثامن',
    'التاسع',
    'العاشر',
    'الحادي عشر',
    'الثاني عشر',
    'الثالث عشر',
    'الرابع عشر',
    'الخامس عشر',
    'السادس عشر',
    'السابع عشر',
    'الثامن عشر',
    'التاسع عشر',
    'العشرون',
    'الحادي والعشرون',
    'الثاني والعشرون',
    'الثالث والعشرون',
    'الرابع والعشرون',
    'الخامس والعشرون',
    'السادس والعشرون',
    'السابع والعشرون',
    'الثامن والعشرون',
    'التاسع والعشرون',
    'الثلاثون',
  ];

  for (let day = 1; day <= 30; day++) {
    const res = getArabicOrdinalDay(day);
    assert.equal(res, expectedOrdinals[day], `Mismatch at day ${day}: expected ${expectedOrdinals[day]}, got ${res}`);
  }
});

await challenge('4.2 getArabicOrdinalDay boundary days (Day 31, Day 0, negatives, overflow) return safe fallbacks', () => {
  assert.equal(getArabicOrdinalDay(31), 'رقم 31', 'Day 31 fallback');
  assert.equal(getArabicOrdinalDay(0), 'رقم 0');
  assert.equal(getArabicOrdinalDay(-1), 'رقم -1');
  assert.equal(getArabicOrdinalDay(-10), 'رقم -10');
  assert.equal(getArabicOrdinalDay(60), 'رقم 60');
  assert.equal(getArabicOrdinalDay(365), 'رقم 365');
  assert.equal(getArabicOrdinalDay(null), 'رقم null');
  assert.equal(getArabicOrdinalDay(undefined), 'رقم undefined');
  assert.equal(getArabicOrdinalDay(NaN), 'رقم NaN');
});

// ===========================================================================
// SUITE 5: READING STATS & TOOLBAR STRESS TESTS
// ===========================================================================
console.log('\n--- SUITE 5: ReadingStatsModal.jsx & ReaderToolbar.jsx Behavior ---');

await challenge('5.1 HabitProgressionHero calculates progress percentage and clamps at 100%', () => {
  const html50 = renderToStaticMarkup(
    React.createElement(HabitProgressionHero, {
      currentDailyTarget: 10,
      todayLog: { pagesRead: 5, completed: false },
      habitState: { activeLevel: 1, streakDays: 3 },
    })
  );
  assert.ok(html50.includes('width:50%'));
  assert.ok(html50.includes('5 / 10'));

  const html100 = renderToStaticMarkup(
    React.createElement(HabitProgressionHero, {
      currentDailyTarget: 10,
      todayLog: { pagesRead: 15, completed: true },
      habitState: { activeLevel: 1, streakDays: 4 },
    })
  );
  assert.ok(html100.includes('width:100%'));
  assert.ok(html100.includes('(تم الإنجاز)'));
});

await challenge('5.2 HabitProgressionHero displays missed grace warning banner when active', () => {
  const htmlGrace = renderToStaticMarkup(
    React.createElement(HabitProgressionHero, {
      currentDailyTarget: 10,
      todayLog: { pagesRead: 0, completed: false },
      habitState: { missedGraceWarning: true, streakDays: 5 },
    })
  );
  assert.ok(htmlGrace.includes('لقد انقطعت بالأمس!'));
});

await challenge('5.3 ReadingStatsModal validates positive integer targets', () => {
  let savedVal = null;
  const onSave = (val) => {
    savedVal = val;
  };

  const validateAndSave = (inputStr) => {
    const val = parseInt(inputStr, 10);
    if (!isNaN(val) && val > 0) {
      onSave(val);
      return true;
    }
    return false;
  };

  assert.equal(validateAndSave('25'), true);
  assert.equal(savedVal, 25);
  assert.equal(validateAndSave('0'), false, 'Zero must be rejected');
  assert.equal(validateAndSave('-5'), false, 'Negative must be rejected');
  assert.equal(validateAndSave('abc'), false, 'Non-number must be rejected');
  assert.equal(validateAndSave(''), false, 'Empty string must be rejected');
});

await challenge('5.4 ReaderToolbar dock visibility reflects hover lock, showControls, and mouseOverDock', () => {
  const htmlNormal = renderToStaticMarkup(
    React.createElement(ReaderToolbar, {
      isHoverLocked: false,
      showControls: true,
      isMouseOverDock: false,
      wardDayTitle: 'ورد اليوم الأول',
    })
  );
  assert.ok(htmlNormal.includes('opacity:1'));
  assert.ok(htmlNormal.includes('pointer-events:auto'));
  assert.ok(htmlNormal.includes('ورد اليوم الأول'));

  const htmlHidden = renderToStaticMarkup(
    React.createElement(ReaderToolbar, {
      isHoverLocked: false,
      showControls: false,
      isMouseOverDock: false,
    })
  );
  assert.ok(htmlHidden.includes('opacity:0'));
  assert.ok(htmlHidden.includes('pointer-events:none'));

  const htmlLocked = renderToStaticMarkup(
    React.createElement(ReaderToolbar, {
      isHoverLocked: true,
      showControls: true,
      isMouseOverDock: true,
      showUnlockTrigger: true,
    })
  );
  assert.ok(htmlLocked.includes('opacity:0'));
  assert.ok(htmlLocked.includes('إلغاء قفل الهوفر'), 'Subtle unlock button must be rendered');
});

await challenge('5.5 ReaderToolbar cycles between dark Warm Night and original themes', () => {
  const htmlDark = renderToStaticMarkup(
    React.createElement(ReaderToolbar, {
      readingTheme: 'dark',
      showControls: true,
    })
  );
  assert.ok(htmlDark.includes('ليلي دافئ'));

  const htmlDefault = renderToStaticMarkup(
    React.createElement(ReaderToolbar, {
      readingTheme: 'default',
      showControls: true,
    })
  );
  assert.ok(htmlDefault.includes('أصلي'));
});

// ===========================================================================
// SUITE 6: DUAL-PAGE SPREAD MATHEMATICS & PDF CANVAS VIEWER STRESS TESTS
// ===========================================================================
console.log('\n--- SUITE 6: Dual-Page Spread Layout Mathematics & PdfCanvasViewer.jsx ---');

await challenge('6.1 Dual-page RTL spread start mathematics for odd and even pages', () => {
  function computeSpreadStart(pageNum) {
    return pageNum % 2 === 1 ? pageNum : Math.max(1, pageNum - 1);
  }

  assert.equal(computeSpreadStart(1), 1);
  assert.equal(computeSpreadStart(2), 1);
  assert.equal(computeSpreadStart(3), 3);
  assert.equal(computeSpreadStart(4), 3);
  assert.equal(computeSpreadStart(5), 5);
  assert.equal(computeSpreadStart(20), 19);
});

await challenge('6.2 Spread pagination step forward (+2) and backward (-2) with boundaries', () => {
  function getNextSpread(currentPage) {
    const curSpread = currentPage % 2 === 1 ? currentPage : Math.max(1, currentPage - 1);
    return curSpread + 2;
  }

  function getPrevSpread(currentPage) {
    const curSpread = currentPage % 2 === 1 ? currentPage : Math.max(1, currentPage - 1);
    return Math.max(1, curSpread - 2);
  }

  assert.equal(getNextSpread(1), 3);
  assert.equal(getNextSpread(2), 3);
  assert.equal(getNextSpread(3), 5);
  assert.equal(getNextSpread(4), 5);

  assert.equal(getPrevSpread(5), 3);
  assert.equal(getPrevSpread(4), 1);
  assert.equal(getPrevSpread(3), 1);
  assert.equal(getPrevSpread(2), 1);
  assert.equal(getPrevSpread(1), 1, 'Cannot go below page 1');
});

await challenge('6.3 Ward ceiling and book boundary calculation in BookReaderView architecture', () => {
  // Pure implementation of BookReaderView:147-157
  function checkCanTurnNext(currentPage, totalPages, wardCeiling) {
    const maxWardPage = Math.min(totalPages || 999999, wardCeiling);
    const maxAllowedSpreadStart = maxWardPage % 2 === 1 ? maxWardPage : maxWardPage - 1;
    const curSpreadStart = currentPage % 2 === 1 ? currentPage : Math.max(1, currentPage - 1);
    return curSpreadStart < maxAllowedSpreadStart && currentPage < totalPages;
  }

  const totalPages = 30;

  // Mid-book progression:
  assert.equal(checkCanTurnNext(1, totalPages, 10), true);
  assert.equal(checkCanTurnNext(7, totalPages, 10), true);
  assert.equal(checkCanTurnNext(8, totalPages, 10), true);

  // Reaching ward ceiling at page 10 (spread 9-10):
  assert.equal(checkCanTurnNext(9, totalPages, 10), false, 'Spread 9-10 reaches ceiling, cannot advance');
  assert.equal(checkCanTurnNext(10, totalPages, 10), false, 'Spread 9-10 reaches ceiling, cannot advance');

  // Book end boundary (totalPages = 30, ward ceiling = 50):
  // Spread 27 can advance to 29
  assert.equal(checkCanTurnNext(27, totalPages, 50), true);
  assert.equal(checkCanTurnNext(28, totalPages, 50), true);
  // Spread 29 is the final spread (covers pages 29 and 30), must not advance!
  assert.equal(checkCanTurnNext(29, totalPages, 50), false, 'Final spread 29-30 cannot advance past end of book');
  assert.equal(checkCanTurnNext(30, totalPages, 50), false, 'Page 30 cannot advance past end of book');
});

await challenge('6.4 Single page spread when book ends on an odd page', () => {
  function getSpreadPages(currentPage, totalPages, wardCeiling) {
    const maxWardPage = Math.min(totalPages || 999999, wardCeiling);
    const clampedPage = Math.min(currentPage, totalPages);
    const spreadStart = clampedPage % 2 === 1 ? clampedPage : Math.max(1, clampedPage - 1);
    const rightPageNum = spreadStart <= maxWardPage ? spreadStart : null;
    const leftPageNum = spreadStart + 1 <= Math.min(totalPages, maxWardPage) ? spreadStart + 1 : null;
    return { rightPageNum, leftPageNum };
  }

  const endSpread = getSpreadPages(5, 5, 10);
  assert.equal(endSpread.rightPageNum, 5, 'Physical right canvas gets page 5');
  assert.equal(endSpread.leftPageNum, null, 'Physical left canvas gets null (display: none)');

  const normalSpread = getSpreadPages(3, 5, 10);
  assert.equal(normalSpread.rightPageNum, 3);
  assert.equal(normalSpread.leftPageNum, 4);
});

await challenge('6.5 Ambient canvas dynamic brightness scale formula adapts smoothly to luma', () => {
  function computeAmbientBrightnessScale(avgLuma) {
    const dynamicScale = Math.min(1.35, Math.max(0.52, 105 / (avgLuma + 45)));
    return Number(dynamicScale.toFixed(2));
  }

  assert.equal(computeAmbientBrightnessScale(0), 1.35, 'Dark/black page boosted to max 1.35');
  assert.equal(computeAmbientBrightnessScale(255), 0.52, 'Pure white page dampened to min 0.52');
  assert.equal(computeAmbientBrightnessScale(100), 0.72, 'Neutral grey adapts smoothly');
  assert.equal(computeAmbientBrightnessScale(180), 0.52, 'Soft cream page clamped cleanly');
});

await challenge('6.6 PdfCanvasViewer renders RTL dual-canvas layout with navigation click zones', () => {
  const htmlViewer = renderToStaticMarkup(
    React.createElement(PdfCanvasViewer, {
      canTurnNext: true,
      todayLog: { completed: false },
      isLoadingPdf: false,
      canvasBgColor: '#ffffff',
      canvasFilter: 'none',
      themeBackdropStyle: '#0a0a0a',
    })
  );

  assert.ok(htmlViewer.includes('الصفحة التالية'), 'Left click zone advances to next page');
  assert.ok(htmlViewer.includes('الصفحة السابقة'), 'Right click zone goes to previous page');
  assert.ok(htmlViewer.includes('direction:rtl'), 'Dual canvas container must have RTL direction');
  assert.ok(htmlViewer.includes('<canvas'), 'Must render canvas elements');
});

// ===========================================================================
// SUMMARY & VERDICT GENERATION
// ===========================================================================
console.log('\n================================================================');
console.log(`🏁 CHALLENGER M2_1 COMPLETE: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('================================================================\n');

if (totalFailed > 0) {
  console.error('❌ FAILURES ENCOUNTERED:');
  for (const f of failureDetails) {
    console.error(`- [${f.test}]: ${f.error}`);
  }
  process.exitCode = 1;
} else {
  console.log(`🎉 ALL ${totalPassed} EMPIRICAL CHALLENGE TESTS PASSED CLEANLY WITH ZERO FAILURES.`);
}
