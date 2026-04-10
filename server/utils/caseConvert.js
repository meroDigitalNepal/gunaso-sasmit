const toSnake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const toDb   = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [toSnake(k), v]));
const fromDb = (row) => row ? Object.fromEntries(Object.entries(row).map(([k, v]) => [toCamel(k), v])) : null;

module.exports = { toDb, fromDb };
