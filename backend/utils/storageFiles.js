const fs = require('fs');
const path = require('path');

const safeStoredName = (input) => {
  const value = String(input || '').trim();
  if (!value) return '';
  const base = path.basename(value);
  if (base !== value) return '';
  if (base.includes('..') || base.includes('/') || base.includes('\\')) return '';
  return base;
};

const resolveStorageFilePath = (rootDir, fileName) => {
  const safeName = safeStoredName(fileName);
  if (!safeName) return null;
  const filePath = path.join(rootDir, safeName);
  if (!fs.existsSync(filePath)) return null;
  return { fileName: safeName, filePath };
};

const deleteFileIfExists = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
};

module.exports = {
  deleteFileIfExists,
  resolveStorageFilePath,
  safeStoredName,
};
