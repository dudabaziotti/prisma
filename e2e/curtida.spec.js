/**
 * CRUD de Curtida — Release 03 (RF07)
 * Curtir (C), ver quem curtiu (R) e descurtir (D) publicações.
 * Cada usuário curte uma publicação no máximo uma vez.
 */
const assert = require('assert');
const config = require('./support/config');
const { createDriver, closeDriver, byTest, find } = require('./support/driver');
const { registerAndEnter, login, logout, createPost, waitForPost, inCard } = require('./support/actions');

const unique = (text) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Espera o contador de curtidas do card mostrar esse número. */
async function waitForLikes(driver, card, count) {
  const expected = `${count} ${count === 1 ? 'curtida' : 'curtidas'}`;
  await driver.wait(
    async () => (await (await inCard(card, 'publicacao-curtidas-contagem')).getText()).trim() === expected,
    config.WAIT,
    `Contador de curtidas diferente de "${expected}"`,
  );
}

async function waitForLiked(driver, card, liked) {
  await driver.wait(
    async () => (await (await inCard(card, 'publicacao-curtir')).getAttribute('aria-pressed')) === String(liked),
    config.WAIT,
    liked ? 'Publicação não ficou curtida' : 'Publicação continua curtida',
  );
}

async function toggleLike(driver, card, liked) {
  await (await inCard(card, 'publicacao-curtir')).click();
  await waitForLiked(driver, card, liked);
}

describe('CRUD de Curtida', function () {
  beforeEach(async function () {
    this.driver = await createDriver();
    this.user = await registerAndEnter(this.driver);
    this.postText = unique('Publicação para curtir');
    await createPost(this.driver, this.postText);
  });

  afterEach(async function () {
    await closeDriver(this);
  });

  it('CT-07.1 curte uma publicação e o contador vai para 1', async function () {
    const card = await waitForPost(this.driver, this.postText);
    await waitForLikes(this.driver, card, 0);
    await toggleLike(this.driver, card, true);
    await waitForLikes(this.driver, card, 1);
    assert.strictEqual(await (await inCard(card, 'publicacao-curtir')).getText(), 'Curtido');
  });

  it('CT-07.2 descurte a publicação e o contador volta para 0', async function () {
    const card = await waitForPost(this.driver, this.postText);
    await toggleLike(this.driver, card, true);
    await waitForLikes(this.driver, card, 1);
    await toggleLike(this.driver, card, false);
    await waitForLikes(this.driver, card, 0);
    assert.strictEqual(await (await inCard(card, 'publicacao-curtir')).getText(), 'Curtir');
  });

  it('CT-07.3 a curtida continua depois de recarregar a página', async function () {
    let card = await waitForPost(this.driver, this.postText);
    await toggleLike(this.driver, card, true);
    await waitForLikes(this.driver, card, 1);
    await this.driver.navigate().refresh();
    await find(this.driver, 'usuario-logado');
    card = await waitForPost(this.driver, this.postText);
    await waitForLiked(this.driver, card, true);
    await waitForLikes(this.driver, card, 1);
  });

  it('CT-07.4 outro usuário curte e a lista mostra quem curtiu', async function () {
    let card = await waitForPost(this.driver, this.postText);
    await toggleLike(this.driver, card, true);
    await logout(this.driver);

    const visitor = await registerAndEnter(this.driver);
    card = await waitForPost(this.driver, this.postText);
    await waitForLikes(this.driver, card, 1);
    await toggleLike(this.driver, card, true);
    await waitForLikes(this.driver, card, 2);

    await (await inCard(card, 'publicacao-curtidas-contagem')).click();
    const list = await this.driver.wait(
      async () => (await card.findElements(byTest('publicacao-curtidas-lista')))[0],
      config.WAIT,
      'Lista de curtidas não apareceu',
    );
    const names = await Promise.all((await list.findElements(byTest('curtida-nome'))).map((el) => el.getText()));
    assert.deepStrictEqual(names.sort(), [this.user.name, visitor.name].sort());
  });

  it('CT-07.5 cada usuário só conta uma curtida por publicação', async function () {
    await logout(this.driver);
    await login(this.driver, this.user.email, this.user.password);
    await find(this.driver, 'usuario-logado');
    const card = await waitForPost(this.driver, this.postText);
    await toggleLike(this.driver, card, true);
    await toggleLike(this.driver, card, false);
    await toggleLike(this.driver, card, true);
    await waitForLikes(this.driver, card, 1);
  });
});
