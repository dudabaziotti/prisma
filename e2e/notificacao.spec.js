/**
 * CRUD de Notificações — Release 04 (RF12)
 * Curtidas, comentários e novos seguidores geram notificações (C); a pessoa vê a lista e o
 * contador no menu (R), marca como lida (U) e exclui uma ou todas (D).
 */
const assert = require('assert');
const { By } = require('selenium-webdriver');
const config = require('./support/config');
const { createDriver, closeDriver, byTest, click, find, waitForText } = require('./support/driver');
const { registerAndEnter, login, logout, createPost, waitForPost, inCard } = require('./support/actions');

const unique = (text) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function likePost(driver, postText) {
  const card = await waitForPost(driver, postText);
  await (await inCard(card, 'publicacao-curtir')).click();
  await driver.wait(async () => (await (await inCard(card, 'publicacao-curtir')).getAttribute('aria-pressed')) === 'true', config.WAIT);
}

async function commentPost(driver, postText, text) {
  const card = await waitForPost(driver, postText);
  await (await inCard(card, 'publicacao-comentarios')).click();
  const field = await driver.wait(async () => (await card.findElements(byTest('comentario-novo-conteudo')))[0], config.WAIT);
  await field.sendKeys(text);
  await (await card.findElement(byTest('comentario-novo-enviar'))).click();
  await driver.wait(async () => (await card.findElements(byTest('comentario'))).length > 0, config.WAIT);
}

async function followAuthor(driver, postText, authorName) {
  const card = await waitForPost(driver, postText);
  await (await card.findElement(By.css('a.author'))).click();
  await waitForText(driver, 'perfil-nome', authorName);
  await click(driver, 'perfil-seguir');
  await driver.wait(async () => (await (await find(driver, 'perfil-seguir')).getAttribute('aria-pressed')) === 'true', config.WAIT);
}

async function loginAs(driver, user) {
  await login(driver, user.email, user.password);
  await waitForText(driver, 'usuario-logado', user.name);
}

async function openNotifications(driver) {
  await click(driver, 'nav-notificacoes');
  await driver.wait(
    async () => (await driver.findElements(byTest('notificacao'))).length + (await driver.findElements(byTest('notificacoes-vazio'))).length > 0,
    config.WAIT,
    'A página de notificações não carregou',
  );
}

async function waitForNotifications(driver, count) {
  await driver.wait(async () => (await driver.findElements(byTest('notificacao'))).length === count, config.WAIT, `Deveria haver ${count} notificação(ões)`);
  return driver.findElements(byTest('notificacao'));
}

async function badgeText(driver) {
  const badge = await driver.findElements(byTest('nav-notificacoes-contagem'));
  return badge.length ? (await badge[0].getText()).trim() : '';
}

describe('CRUD de Notificações', function () {
  beforeEach(async function () {
    this.driver = await createDriver();
    this.author = await registerAndEnter(this.driver);
    this.postText = unique('Publicação para notificar');
    await createPost(this.driver, this.postText);
    await logout(this.driver);
  });

  afterEach(async function () {
    await closeDriver(this);
  });

  it('CT-12.1 curtida gera notificação e o contador aparece no menu', async function () {
    const fan = await registerAndEnter(this.driver);
    await likePost(this.driver, this.postText);
    await logout(this.driver);

    await loginAs(this.driver, this.author);
    await this.driver.wait(async () => (await badgeText(this.driver)) === '1', config.WAIT, 'O contador do menu deveria mostrar 1');
    await openNotifications(this.driver);
    const [n] = await waitForNotifications(this.driver, 1);
    assert.strictEqual(await (await n.findElement(byTest('notificacao-texto'))).getText(), `${fan.name} curtiu sua publicação`);
    assert.ok((await (await n.findElement(byTest('notificacao-trecho'))).getText()).includes(this.postText));
    assert.strictEqual(await n.getAttribute('data-read'), 'false');
  });

  it('CT-12.2 comentário e novo seguidor também geram notificações', async function () {
    const fan = await registerAndEnter(this.driver);
    await commentPost(this.driver, this.postText, 'Me ajudou muito!');
    await followAuthor(this.driver, this.postText, this.author.name);
    await logout(this.driver);

    await loginAs(this.driver, this.author);
    await openNotifications(this.driver);
    const list = await waitForNotifications(this.driver, 2);
    const types = await Promise.all(list.map((n) => n.getAttribute('data-type')));
    assert.deepStrictEqual(types.sort(), ['comment', 'follow']);
    const texts = await Promise.all(list.map(async (n) => (await n.findElement(byTest('notificacao-texto'))).getText()));
    assert.ok(texts.includes(`${fan.name} começou a seguir você`));
    assert.ok(texts.includes(`${fan.name} comentou na sua publicação`));
  });

  it('CT-12.3 marca uma notificação como lida e o contador some', async function () {
    await registerAndEnter(this.driver);
    await likePost(this.driver, this.postText);
    await logout(this.driver);

    await loginAs(this.driver, this.author);
    await openNotifications(this.driver);
    const [n] = await waitForNotifications(this.driver, 1);
    await (await n.findElement(byTest('notificacao-marcar-lida'))).click();
    await this.driver.wait(async () => (await n.getAttribute('data-read')) === 'true', config.WAIT, 'A notificação não ficou lida');
    await this.driver.wait(async () => (await badgeText(this.driver)) === '', config.WAIT, 'O contador do menu deveria sumir');
  });

  it('CT-12.4 marca todas como lidas de uma vez', async function () {
    await registerAndEnter(this.driver);
    await likePost(this.driver, this.postText);
    await commentPost(this.driver, this.postText, 'Valeu!');
    await logout(this.driver);

    await loginAs(this.driver, this.author);
    await openNotifications(this.driver);
    await waitForNotifications(this.driver, 2);
    await click(this.driver, 'notificacoes-marcar-todas');
    await this.driver.wait(
      async () => (await this.driver.findElements(By.css('[data-test="notificacao"][data-read="false"]'))).length === 0,
      config.WAIT,
      'Ainda há notificações não lidas',
    );
    await waitForText(this.driver, 'notificacoes-resumo', 'Tudo em dia.');
  });

  it('CT-12.5 exclui uma notificação', async function () {
    await registerAndEnter(this.driver);
    await likePost(this.driver, this.postText);
    await commentPost(this.driver, this.postText, 'Obrigado!');
    await logout(this.driver);

    await loginAs(this.driver, this.author);
    await openNotifications(this.driver);
    const list = await waitForNotifications(this.driver, 2);
    await (await list[0].findElement(byTest('notificacao-excluir'))).click();
    await waitForNotifications(this.driver, 1);
  });

  it('CT-12.6 limpa todas as notificações após confirmar', async function () {
    await registerAndEnter(this.driver);
    await likePost(this.driver, this.postText);
    await followAuthor(this.driver, this.postText, this.author.name);
    await logout(this.driver);

    await loginAs(this.driver, this.author);
    await openNotifications(this.driver);
    await waitForNotifications(this.driver, 2);
    await click(this.driver, 'notificacoes-limpar');
    await click(this.driver, 'notificacoes-limpar-confirmar');
    await find(this.driver, 'notificacoes-vazio');
  });

  it('CT-12.7 curtir e comentar a própria publicação não gera notificação', async function () {
    await loginAs(this.driver, this.author);
    await likePost(this.driver, this.postText);
    await commentPost(this.driver, this.postText, 'Comentário meu');
    await openNotifications(this.driver);
    await find(this.driver, 'notificacoes-vazio');
    assert.strictEqual(await badgeText(this.driver), '');
  });
});
