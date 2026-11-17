const fs = require('fs');
const { logging } = require('selenium-webdriver');
const path = require('path');
const { SCREENSHOTS, createDriver, waitForText } = require('./driver');
const { newUser, open, registerAndEnter } = require('./actions');

/**
 * Login uma vez só por arquivo de teste.
 *
 * Abre um navegador para cada pessoa do teste e faz o cadastro e o login dela só no início
 * do arquivo (hook "before"). Todos os testes do arquivo usam essas mesmas sessões, sem sair
 * e entrar de novo. Quando um teste precisa de outra pessoa (por exemplo, alguém que curte a
 * publicação do autor), ele usa o navegador dessa pessoa, que também já está logado.
 *
 * Uso, dentro do describe:
 *   const s = useSessions(['autor', 'visitante']);
 *   ...
 *   await createPost(s.autor.driver, 'texto');
 *   s.visitante.user.name
 *
 * A primeira pessoa também fica em this.driver e this.user dentro dos testes.
 * Antes de cada teste, cada navegador volta para o feed (só recarrega a página, sem novo login).
 * Se um teste falhar, salva um print de cada navegador em e2e/reports/screenshots.
 *
 * Com { login: false } o navegador abre sem login (usado pelos testes do próprio login).
 */
function useSessions(roles, { login = true } = {}) {
  const sessions = {};

  before(async function () {
    for (const role of roles) {
      const label = role.charAt(0).toUpperCase() + role.slice(1);
      const driver = await createDriver();
      const user = newUser(label);
      sessions[role] = { driver, user };
      if (login) await registerAndEnter(driver, user);
    }
  });

  beforeEach(async function () {
    this.driver = sessions[roles[0]].driver;
    this.user = sessions[roles[0]].user;
    if (!login) return;
    for (const { driver, user } of Object.values(sessions)) {
      await open(driver, '/feed');
      await waitForText(driver, 'usuario-logado', user.name);
    }
  });

  afterEach(async function () {
    if (this.currentTest?.state !== 'failed') return;
    const base = this.currentTest.fullTitle().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\-]+/g, '_').slice(0, 110);
    fs.mkdirSync(SCREENSHOTS, { recursive: true });
    for (const [role, { driver }] of Object.entries(sessions)) {
      const image = await driver.takeScreenshot().catch(() => null);
      if (image) fs.writeFileSync(path.join(SCREENSHOTS, `${base}_${role}.png`), image, 'base64');
      const logs = await driver.manage().logs().get(logging.Type.BROWSER).catch(() => []);
      const text = logs.map((l) => `${new Date(l.timestamp).toISOString()} ${l.level.name} ${l.message}`).join('\n');
      fs.writeFileSync(path.join(SCREENSHOTS, `${base}_${role}_console.log`), text || '(console vazio)');
    }
  });

  after(async function () {
    for (const { driver } of Object.values(sessions)) await driver.quit().catch(() => undefined);
  });

  return sessions;
}

module.exports = { useSessions };
