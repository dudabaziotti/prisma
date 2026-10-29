const { By } = require('selenium-webdriver');
const config = require('./config');
const { byTest, click, find, type, waitForUrl, waitForText } = require('./driver');

let counter = 0;

/** Gera um usuário único para cada teste não depender dos outros. */
function newUser(prefix = 'Estudante') {
  const id = `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  return { name: `${prefix} ${id}`, email: `teste.${id}@prisma.test`, password: 'senha123' };
}

async function open(driver, path) {
  await driver.get(`${config.BASE_URL}${path}`);
}

async function register(driver, user) {
  await open(driver, '/cadastro');
  await type(driver, 'cadastro-nome', user.name);
  await type(driver, 'cadastro-email', user.email);
  await type(driver, 'cadastro-senha', user.password);
  await type(driver, 'cadastro-confirmar', user.confirm ?? user.password);
  await click(driver, 'cadastro-enviar');
}

/** Cadastra e espera chegar no feed com o perfil carregado. */
async function registerAndEnter(driver, user = newUser()) {
  await register(driver, user);
  await waitForUrl(driver, '/feed');
  await waitForText(driver, 'usuario-logado', user.name);
  return user;
}

async function login(driver, email, password) {
  await open(driver, '/login');
  await type(driver, 'login-email', email);
  await type(driver, 'login-senha', password);
  await click(driver, 'login-entrar');
}

async function logout(driver) {
  await click(driver, 'sair');
  await waitForUrl(driver, '/login');
}

async function createPost(driver, content, subject = '') {
  await type(driver, 'nova-publicacao-conteudo', content);
  if (subject) await type(driver, 'nova-publicacao-disciplina', subject);
  await click(driver, 'nova-publicacao-salvar');
  return waitForPost(driver, content);
}

/** Espera a publicação com esse texto aparecer e devolve o card dela. */
async function waitForPost(driver, content) {
  const xpath = By.xpath(
    `//*[@data-test="publicacao"][.//*[@data-test="publicacao-conteudo" and contains(., ${xpathLiteral(content)})]]`,
  );
  return driver.wait(async () => (await driver.findElements(xpath))[0], config.WAIT, `Publicação "${content}" não apareceu`);
}

async function postIsGone(driver, content) {
  const xpath = By.xpath(
    `//*[@data-test="publicacao-conteudo" and contains(., ${xpathLiteral(content)})]`,
  );
  await driver.wait(async () => (await driver.findElements(xpath)).length === 0, config.WAIT, `Publicação "${content}" ainda aparece`);
}

function xpathLiteral(text) {
  return text.includes('"') ? `'${text}'` : `"${text}"`;
}

/** Procura um elemento data-test dentro de um card específico. */
async function inCard(card, name) {
  return card.findElement(byTest(name));
}

module.exports = { newUser, open, register, registerAndEnter, login, logout, createPost, waitForPost, postIsGone, inCard, find };
