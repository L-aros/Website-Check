const fs = require('fs');
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const { ChangeHistory } = require('../models');
const { resolveStorageFilePath } = require('../utils/storageFiles');

const storageRoot = path.join(__dirname, '..', 'storage');
const screenshotDir = path.join(storageRoot, 'screenshots');
const archiveDir = path.join(storageRoot, 'archives');

const allowedSnapshotTags = [
  'html', 'head', 'body', 'title', 'base', 'meta', 'link', 'style',
  'main', 'section', 'article', 'header', 'footer', 'nav', 'aside',
  'div', 'span', 'p', 'br', 'hr', 'pre', 'code', 'blockquote',
  'strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup', 'mark',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'figure', 'figcaption', 'picture', 'img', 'source',
  'a', 'details', 'summary', 'time',
];

const snapshotSanitizeOptions = {
  allowedTags: allowedSnapshotTags,
  disallowedTagsMode: 'discard',
  allowProtocolRelative: true,
  allowedSchemes: ['http', 'https', 'data', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowedAttributes: {
    '*': [
      'class',
      'id',
      'style',
      'title',
      'lang',
      'dir',
      'role',
      /^aria-[\w-]+$/,
      /^data-[\w-]+$/,
    ],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    source: ['src', 'srcset', 'type', 'media', 'sizes'],
    link: ['href', 'rel', 'media', 'as', 'crossorigin', 'integrity', 'referrerpolicy'],
    meta: ['charset', 'name', 'content', 'property'],
    base: ['href', 'target'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
    ol: ['start', 'type'],
    li: ['value'],
    time: ['datetime'],
  },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
      },
    }),
  },
};

const sanitizeSnapshotHtml = (html) => sanitizeHtml(String(html || ''), snapshotSanitizeOptions);

const findHistoryRecord = async (monitorId, historyId) => {
  return ChangeHistory.findOne({
    where: {
      id: historyId,
      monitorId,
    },
  });
};

const resolveHistoryScreenshot = (history) => {
  if (!history || !history.screenshotPath) return null;
  return resolveStorageFilePath(screenshotDir, history.screenshotPath);
};

const resolveHistorySnapshot = (history) => {
  if (!history || !history.htmlPath) return null;
  return resolveStorageFilePath(archiveDir, history.htmlPath);
};

const getSanitizedSnapshotPayload = async (history) => {
  const resolved = resolveHistorySnapshot(history);
  if (!resolved) return null;
  const rawHtml = await fs.promises.readFile(resolved.filePath, 'utf8');
  return {
    html: sanitizeSnapshotHtml(rawHtml),
    fileName: resolved.fileName,
  };
};

module.exports = {
  findHistoryRecord,
  getSanitizedSnapshotPayload,
  resolveHistoryScreenshot,
  resolveHistorySnapshot,
};
