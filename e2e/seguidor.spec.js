/**
 * CRUD de Seguidores — Release 04 (RF09, RF10, RF17)
 * Seguir (C), listar seguidores e seguindo (R), deixar de seguir e remover seguidor (D).
 * O vínculo libera o feed "Seguindo" (RF10) e as salas só para seguidores (RF17).
 */
const assert = require('assert');
const { By } = require('selenium-webdriver');
const config = require('./support/config');
const { createDriver, closeDriver, byTest, click, find, type, waitForText } = require('./support/driver');
const { registerAndEnter, logout, login, createPost, waitForPost, postIsGone, open } = require('./support/actions');

const unique = (text) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Abre o perfil do autor de uma publicação clicando no nome dele. */
async function openAuthorProfile(driver, postText, authorName) {
  const card = await waitForPost(driver, postText);
  await (await card.findElement(By.css('a.author'))).click();
  await waitForText(driver, 'perfil-nome', authorName);
}

async function waitForCount(driver, test, expected) {
  await driver.wait(
    async () => (await (await find(driver, test)).getText()).trim() === expected,
    config.WAIT,
    `"${test}" deveria mostrar "${expected}"`,
  );
}

async function waitFollowing(driver, following) {
  await driver.wait(
    async () => (await (await find(driver, 'perfil-seguir')).getAttribute('aria-pressed')) === String(following),
    config.WAIT,
    following ? 'O botão não mudou para "Deixar de seguir"' : 'O botão não voltou para "Seguir"',
  );
}

async function namesIn(driver, listTest, nameTest) {
  const list = await find(driver, listTest);
  return Promise.all((await list.findElements(byTest(nameTest))).map((el) => el.getText()));
}

async function openOwnProfile(driver) {
  await click(driver, 'nav-perfil');
  await find(driver, 'perfil-editar');
}

describe('CRUD de Seguidores', function () {
  beforeEach(async function () {
    this.driver = await createDriver();
    // Autor: publica algo para os outros acharem o perfil dele pelo feed.
    this.author = await registerAndEnter(this.driver);
    this.postText = unique('Publicação do autor');
    await createPost(this.driver, this.postText);
    await logout(this.driver);
  });

  afterEach(async function () {
    await closeDriver(this);
  });

  describe('Seguir e deixar de seguir (RF09)', function () {
    it('CT-09.1 segue outro usuário pelo perfil e o contador de seguidores aumenta', async function () {
      await registerAndEnter(this.driver);
      await openAuthorProfile(this.driver, this.postText, this.author.name);
      await waitForCount(this.driver, 'perfil-seguidores-contagem', '0 seguidores');
      await click(this.driver, 'perfil-seguir');
      await waitFollowing(this.driver, true);
      await waitForCount(this.driver, 'perfil-seguidores-contagem', '1 seguidor');
      assert.strictEqual(await (await find(this.driver, 'perfil-seguir')).getText(), 'Deixar de seguir');
    });

    it('CT-09.2 deixa de seguir e o contador volta para zero', async function () {
      await registerAndEnter(this.driver);
      await openAuthorProfile(this.driver, this.postText, this.author.name);
      await click(this.driver, 'perfil-seguir');
      await waitFollowing(this.driver, true);
      await click(this.driver, 'perfil-seguir');
      await waitFollowing(this.driver, false);
      await waitForCount(this.driver, 'perfil-seguidores-contagem', '0 seguidores');
    });

    it('CT-09.3 lista seguidores e quem o usuário segue', async function () {
      const fan = await registerAndEnter(this.driver);
      await openAuthorProfile(this.driver, this.postText, this.author.name);
      await click(this.driver, 'perfil-seguir');
      await waitFollowing(this.driver, true);

      // Lista "Seguindo" no próprio perfil de quem seguiu
      await openOwnProfile(this.driver);
      await waitForCount(this.driver, 'perfil-seguindo-contagem', '1 seguindo');
      await click(this.driver, 'perfil-seguindo-contagem');
      assert.deepStrictEqual(await namesIn(this.driver, 'perfil-lista-seguindo', 'seguindo-nome'), [this.author.name]);
      await logout(this.driver);

      // Lista "Seguidores" no perfil do autor
      await login(this.driver, this.author.email, this.author.password);
      await find(this.driver, 'usuario-logado');
      await openOwnProfile(this.driver);
      await waitForCount(this.driver, 'perfil-seguidores-contagem', '1 seguidor');
      await click(this.driver, 'perfil-seguidores-contagem');
      assert.deepStrictEqual(await namesIn(this.driver, 'perfil-lista-seguidores', 'seguidor-nome'), [fan.name]);
    });

    it('CT-09.4 o usuário remove um seguidor da própria lista', async function () {
      await registerAndEnter(this.driver);
      await openAuthorProfile(this.driver, this.postText, this.author.name);
      await click(this.driver, 'perfil-seguir');
      await waitFollowing(this.driver, true);
      await logout(this.driver);

      await login(this.driver, this.author.email, this.author.password);
      await find(this.driver, 'usuario-logado');
      await openOwnProfile(this.driver);
      await waitForCount(this.driver, 'perfil-seguidores-contagem', '1 seguidor');
      await click(this.driver, 'perfil-seguidores-contagem');
      await click(this.driver, 'seguidor-remover');
      await waitForCount(this.driver, 'perfil-seguidores-contagem', '0 seguidores');
      await find(this.driver, 'perfil-lista-vazia');
    });

    it('CT-09.5 não aparece o botão "Seguir" no próprio perfil', async function () {
      await login(this.driver, this.author.email, this.author.password);
      await find(this.driver, 'usuario-logado');
      await openOwnProfile(this.driver);
      assert.strictEqual((await this.driver.findElements(byTest('perfil-seguir'))).length, 0);
    });
  });

  describe('Feed personalizado (RF10)', function () {
    it('CT-10.1 a aba "Seguindo" mostra só publicações de quem o usuário segue', async function () {
      await registerAndEnter(this.driver);
      const otherText = unique('Publicação de quem não sigo');
      await createPost(this.driver, otherText);
      await logout(this.driver);

      await registerAndEnter(this.driver);
      await openAuthorProfile(this.driver, this.postText, this.author.name);
      await click(this.driver, 'perfil-seguir');
      await waitFollowing(this.driver, true);

      await click(this.driver, 'nav-feed');
      await waitForPost(this.driver, otherText);
      await click(this.driver, 'feed-aba-seguindo');
      await waitForPost(this.driver, this.postText);
      await postIsGone(this.driver, otherText);
      assert.match(await (await find(this.driver, 'feed-aba-seguindo')).getText(), /Seguindo \(1\)/);

      await click(this.driver, 'feed-aba-todos');
      await waitForPost(this.driver, otherText);
    });
  });

  describe('Sala só para seguidores (RF17)', function () {
    it('CT-17.1 só quem segue o dono entra na sala restrita', async function () {
      const room = unique('Sala fechada');
      await login(this.driver, this.author.email, this.author.password);
      await find(this.driver, 'usuario-logado');
      await open(this.driver, '/salas');
      await type(this.driver, 'sala-nova-nome', room);
      await (await find(this.driver, 'sala-nova-acesso')).findElement(By.css('option[value="followers"]')).click();
      await click(this.driver, 'sala-nova-criar');
      await waitForText(this.driver, 'sala-nome', room);
      await find(this.driver, 'sala-acesso');
      await click(this.driver, 'sala-sair');
      await logout(this.driver);

      // Visitante que não segue o dono é barrado
      await registerAndEnter(this.driver);
      await enterRoom(this.driver, room);
      await find(this.driver, 'sala-restrita');
      assert.strictEqual((await this.driver.findElements(byTest('participante'))).length, 0);

      // Segue o dono pelo link da própria mensagem e tenta de novo
      await click(this.driver, 'sala-ver-dono');
      await waitForText(this.driver, 'perfil-nome', this.author.name);
      await click(this.driver, 'perfil-seguir');
      await waitFollowing(this.driver, true);
      await enterRoom(this.driver, room);
      await this.driver.wait(async () => (await this.driver.findElements(byTest('participante'))).length > 0, config.WAIT, 'Seguidor não entrou na sala');
      assert.strictEqual((await this.driver.findElements(byTest('sala-restrita'))).length, 0);
    });

    it('CT-17.2 o dono muda a sala para "só seguidores" e o selo aparece na lista', async function () {
      const room = unique('Sala aberta');
      await login(this.driver, this.author.email, this.author.password);
      await find(this.driver, 'usuario-logado');
      await open(this.driver, '/salas');
      await type(this.driver, 'sala-nova-nome', room);
      await click(this.driver, 'sala-nova-criar');
      await waitForText(this.driver, 'sala-nome', room);
      assert.strictEqual((await this.driver.findElements(byTest('sala-acesso'))).length, 0);

      await click(this.driver, 'sala-editar');
      await (await find(this.driver, 'sala-edicao-acesso')).findElement(By.css('option[value="followers"]')).click();
      await click(this.driver, 'sala-edicao-salvar');
      await find(this.driver, 'sala-acesso');

      await click(this.driver, 'sala-sair');
      const card = await this.driver.wait(
        async () => (await this.driver.findElements(By.xpath(`//*[@data-test="sala-card"][.//*[@data-test="sala-card-nome" and text()="${room}"]]`)))[0],
        config.WAIT,
      );
      await card.findElement(byTest('sala-card-acesso'));
    });
  });
});

/** Abre a lista de salas e entra na sala com esse nome. */
async function enterRoom(driver, name) {
  await open(driver, '/salas');
  const card = await driver.wait(
    async () => (await driver.findElements(By.xpath(`//*[@data-test="sala-card"][.//*[@data-test="sala-card-nome" and text()="${name}"]]`)))[0],
    config.WAIT,
    `Sala "${name}" não apareceu na lista`,
  );
  await (await card.findElement(byTest('sala-entrar'))).click();
  await waitForText(driver, 'sala-nome', name);
}
