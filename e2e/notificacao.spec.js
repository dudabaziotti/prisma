/**
 * CRUD de Notificações — Release 04 (RF12)
 * Curtidas, comentários e novos seguidores geram notificações (C); a pessoa vê a lista e o
 * contador no menu (R), marca como lida (U) e exclui uma ou todas (D).
 *
 * Login uma vez por pessoa, cada uma no seu navegador: o autor recebe as notificações e o fã
 * curte, comenta e segue. Antes de cada teste o autor limpa as notificações dele e faz uma
 * publicação nova, para a contagem sempre começar do zero.
 */
const assert = require('assert');
const { By } = require('selenium-webdriver');
const config = require('./support/config');
const { byTest, click, find, waitForText } = require('./support/driver');
const { createPost, waitForPost, inCard, open } = require('./support/actions');
const { useSessions } = require('./support/session');

const unique = (text) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function likePost(driver, postText) {
  const card = await waitForPost(driver, postText);
  await (await inCard(card, 'publicacao-curtir')).click();
  // Espera o servidor confirmar (o botão fica desabilitado até lá), senão a notificação sai antes da curtida.
  await driver.wait(async () => {
    const button = await inCard(card, 'publicacao-curtir');
    return (await button.getAttribute('aria-pressed')) === 'true' && (await button.isEnabled());
  }, config.WAIT);
}

async function commentPost(driver, postText, text) {
  const card = await waitForPost(driver, postText);
  await (await inCard(card, 'publicacao-comentarios')).click();
  const field = await driver.wait(async () => (await card.findElements(byTest('comentario-novo-conteudo')))[0], config.WAIT);
  await field.sendKeys(text);
  await (await card.findElement(byTest('comentario-novo-enviar'))).click();
  await driver.wait(async () => (await card.findElements(byTest('comentario'))).length > 0, config.WAIT);
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
  const s = useSessions(['autor', 'fa']);

  beforeEach(async function () {
    // O autor começa cada teste sem notificações e com uma publicação nova.
    const author = s.autor.driver;
    await openNotifications(author);
    if ((await author.findElements(byTest('notificacoes-limpar'))).length) {
      await click(author, 'notificacoes-limpar');
      await click(author, 'notificacoes-limpar-confirmar');
      await find(author, 'notificacoes-vazio');
    }
    await click(author, 'nav-feed');
    this.postText = unique('Publicação para notificar');
    await createPost(author, this.postText);
  });

  /** O fã passa a seguir o autor (se já seguia, deixa de seguir antes, para gerar um seguidor novo). */
  async function followAuthor(postText) {
    const fan = s.fa.driver;
    await open(fan, '/feed');
    const card = await waitForPost(fan, postText);
    await (await card.findElement(By.css('a.author'))).click();
    await waitForText(fan, 'perfil-nome', s.autor.user.name);
    const button = await find(fan, 'perfil-seguir');
    await fan.wait(async () => (await button.getAttribute('data-loaded')) === 'true', config.WAIT);
    // Espera o servidor confirmar: o botão fica desabilitado enquanto a gravação está em andamento.
    const pressed = async (v) =>
      fan.wait(
        async () => (await button.getAttribute('aria-pressed')) === v && (await button.isEnabled()),
        config.WAIT,
        `O botão de seguir deveria ficar com aria-pressed=${v} e habilitado`,
      );
    if ((await button.getAttribute('aria-pressed')) === 'true') {
      await button.click();
      await pressed('false');
    }
    await button.click();
    await pressed('true');
  }

  it('CT-12.1 curtida gera notificação e o contador aparece no menu na hora', async function () {
    await likePost(s.fa.driver, this.postText);

    // O autor está com o feed aberto: o contador do menu atualiza sozinho
    const author = this.driver;
    await author.wait(async () => (await badgeText(author)) === '1', config.WAIT, 'O contador do menu deveria mostrar 1');
    await openNotifications(author);
    const [n] = await waitForNotifications(author, 1);
    assert.strictEqual(await (await n.findElement(byTest('notificacao-texto'))).getText(), `${s.fa.user.name} curtiu sua publicação`);
    assert.ok((await (await n.findElement(byTest('notificacao-trecho'))).getText()).includes(this.postText));
    assert.strictEqual(await n.getAttribute('data-read'), 'false');
  });

  it('CT-12.2 comentário e novo seguidor também geram notificações', async function () {
    await commentPost(s.fa.driver, this.postText, 'Me ajudou muito!');
    await followAuthor(this.postText);

    await openNotifications(this.driver);
    const list = await waitForNotifications(this.driver, 2);
    const types = await Promise.all(list.map((n) => n.getAttribute('data-type')));
    assert.deepStrictEqual(types.sort(), ['comment', 'follow']);
    const texts = await Promise.all(list.map(async (n) => (await n.findElement(byTest('notificacao-texto'))).getText()));
    assert.ok(texts.includes(`${s.fa.user.name} começou a seguir você`));
    assert.ok(texts.includes(`${s.fa.user.name} comentou na sua publicação`));
  });

  it('CT-12.3 marca uma notificação como lida e o contador some', async function () {
    await likePost(s.fa.driver, this.postText);

    await openNotifications(this.driver);
    const [n] = await waitForNotifications(this.driver, 1);
    await (await n.findElement(byTest('notificacao-marcar-lida'))).click();
    await this.driver.wait(async () => (await n.getAttribute('data-read')) === 'true', config.WAIT, 'A notificação não ficou lida');
    await this.driver.wait(async () => (await badgeText(this.driver)) === '', config.WAIT, 'O contador do menu deveria sumir');
  });

  it('CT-12.4 marca todas como lidas de uma vez', async function () {
    await likePost(s.fa.driver, this.postText);
    await commentPost(s.fa.driver, this.postText, 'Valeu!');

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
    await likePost(s.fa.driver, this.postText);
    await commentPost(s.fa.driver, this.postText, 'Obrigado!');

    await openNotifications(this.driver);
    const list = await waitForNotifications(this.driver, 2);
    await (await list[0].findElement(byTest('notificacao-excluir'))).click();
    await waitForNotifications(this.driver, 1);
  });

  it('CT-12.6 limpa todas as notificações após confirmar', async function () {
    await likePost(s.fa.driver, this.postText);
    await followAuthor(this.postText);

    await openNotifications(this.driver);
    await waitForNotifications(this.driver, 2);
    await click(this.driver, 'notificacoes-limpar');
    await click(this.driver, 'notificacoes-limpar-confirmar');
    await find(this.driver, 'notificacoes-vazio');
  });

  it('CT-12.7 curtir e comentar a própria publicação não gera notificação', async function () {
    await likePost(this.driver, this.postText);
    await commentPost(this.driver, this.postText, 'Comentário meu');
    await openNotifications(this.driver);
    await find(this.driver, 'notificacoes-vazio');
    assert.strictEqual(await badgeText(this.driver), '');
  });
});
