// 结构化日志模块 — JSON Lines 输出到 stderr
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
let currentLevel = "info";

/**
 * @param {"debug"|"info"|"warn"|"error"|"silent"} level
 */
export function setLogLevel(level) {
  if (LEVELS[level] !== undefined) currentLevel = level;
}

/**
 * @param {"debug"|"info"|"warn"|"error"} level
 * @param {string} module
 * @param {string} event
 * @param {object} [data]
 */
export function log(level, module, event, data = {}) {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    event,
    ...data,
  };
  process.stderr.write(JSON.stringify(entry) + "\n");
}
