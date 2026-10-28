const fs = require('fs');
const { SCREENSHOTS } = require('./driver');
const config = require('./config');

/** Limpa os dados dos emuladores do Firebase para cada execução começar do zero. */
async function resetEmulators() {
  const urls = [
    `http://127.0.0.1:8080/emulator/v1/projects/${config.PROJECT_ID}/databases/(default)/documents`,
    `http://127.0.0.1:9099/emulator/v1/projects/${config.PROJECT_ID}/accounts`,
  ];
  for (const url of urls) {
    try {
      await fetch(url, { method: 'DELETE' });
    } catch {
      console.warn(`  ⚠ Não foi possível limpar ${url}. Os emuladores estão rodando?`);
    }
  }
}

exports.mochaHooks = {
  async beforeAll() {
    if (config.RESET_EMULATORS) await resetEmulators();
    fs.mkdirSync(SCREENSHOTS, { recursive: true });
  },
};
