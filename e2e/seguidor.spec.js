/**
 * CRUD de Seguidores — Release 04 (RF09, RF10, RF17)
 * Seguir (C), listar seguidores e seguindo (R), deixar de seguir e remover seguidor (D).
 * O vínculo libera o feed "Seguindo" (RF10) e as salas só para seguidores (RF17).
 *
 * Login uma vez por pessoa, cada uma no seu navegador:
 *   autor – quem é seguido; fa – quem segue; outro – alguém que o fã não segue.
 * Como as sessões continuam entre os testes, cada teste primeiro deixa o vínculo
 * fã → autor no estado de que precisa (ensureFollowing).
 */
const assert = require('assert');
const { By } = require('selenium-webdriver');
const config = require('./support/config');
const { byTest, click, find, type, waitForText } = require('./support/driver');
const { createPost, waitForPost, postIsGone, open } = require('./support/actions');
const { useSessions } = require('./support/session');

const unique = (text) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

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

describe('CRUD de Seguidores', function () {
  const s = useSessions(['autor', 'fa', 'outro']);
  let authorPost;
  let authorProfilePath;

  // O autor publica uma vez; o fã encontra o perfil dele pelo nome na publicação.
  before(async function () {
    authorPost = unique('Publicação do autor');
    await createPost(s.autor.driver, authorPost);
  });

  async function openAuthorProfile(driver) {
    if (authorProfilePath) {
      await open(driver, authorProfilePath);
    } else {
      const card = await waitForPost(driver, authorPost);
      await (await card.findElement(By.css('a.author'))).click();
      await waitForText(driver, 'perfil-nome', s.autor.user.name);
      authorProfilePath = new URL(await driver.getCurrentUrl()).pathname;
    }
    await waitForText(driver, 'perfil-nome', s.autor.user.name);
  }

  /** Deixa o fã seguindo (ou não) o autor, para o teste começar do estado certo. */
  async function ensureFollowing(want) {
    const fan = s.fa.driver;
    await openAuthorProfile(fan);
    const button = await find(fan, 'perfil-seguir');
    // Espera a lista de seguidores carregar antes de ler o estado do botão.
    await fan.wait(async () => (await button.getAttribute('data-loaded')) === 'true', config.WAIT, 'Seguidores não carregaram');
    if ((await button.getAttribute('aria-pressed')) !== String(want)) {
      await button.click();
      await waitFollowing(fan, want);
    }
  }

  describe('Seguir e deixar de seguir (RF09)', function () {
    it('CT-09.1 segue outro usuário pelo perfil e o contador de seguidores aumenta', async function () {
      await ensureFollowing(false);
      const fan = s.fa.driver;
      await waitForCount(fan, 'perfil-seguidores-contagem', '0 seguidores');
      await click(fan, 'perfil-seguir');
      await waitFollowing(fan, true);
      await waitForCount(fan, 'perfil-seguidores-contagem', '1 seguidor');
      assert.strictEqual(await (await find(fan, 'perfil-seguir')).getText(), 'Deixar de seguir');
    });

    it('CT-09.2 deixa de seguir e o contador volta para zero', async function () {
      await ensureFollowing(true);
      const fan = s.fa.driver;
      await click(fan, 'perfil-seguir');
      await waitFollowing(fan, false);
      await waitForCount(fan, 'perfil-seguidores-contagem', '0 seguidores');
    });

    it('CT-09.3 lista seguidores e quem o usuário segue', async function () {
      await ensureFollowing(true);

      // Lista "Seguindo" no perfil do fã
      const fan = s.fa.driver;
      await openOwnProfile(fan);
      await waitForCount(fan, 'perfil-seguindo-contagem', '1 seguindo');
      await click(fan, 'perfil-seguindo-contagem');
      assert.deepStrictEqual(await namesIn(fan, 'perfil-lista-seguindo', 'seguindo-nome'), [s.autor.user.name]);

      // Lista "Seguidores" no perfil do autor, no navegador dele
      const author = s.autor.driver;
      await openOwnProfile(author);
      await waitForCount(author, 'perfil-seguidores-contagem', '1 seguidor');
      await click(author, 'perfil-seguidores-contagem');
      assert.deepStrictEqual(await namesIn(author, 'perfil-lista-seguidores', 'seguidor-nome'), [s.fa.user.name]);
    });

    it('CT-09.4 o usuário remove um seguidor da própria lista', async function () {
      await ensureFollowing(true);
      const author = s.autor.driver;
      await openOwnProfile(author);
      await waitForCount(author, 'perfil-seguidores-contagem', '1 seguidor');
      await click(author, 'perfil-seguidores-contagem');
      await click(author, 'seguidor-remover');
      await waitForCount(author, 'perfil-seguidores-contagem', '0 seguidores');
      await find(author, 'perfil-lista-vazia');

      // No navegador do fã, o botão volta para "Seguir"
      await openAuthorProfile(s.fa.driver);
      await waitFollowing(s.fa.driver, false);
    });

    it('CT-09.5 não aparece o botão "Seguir" no próprio perfil', async function () {
      await openOwnProfile(this.driver);
      assert.strictEqual((await this.driver.findElements(byTest('perfil-seguir'))).length, 0);
    });
  });

  describe('Feed personalizado (RF10)', function () {
    it('CT-10.1 a aba "Seguindo" mostra só publicações de quem o usuário segue', async function () {
      const otherText = unique('Publicação de quem não sigo');
      await createPost(s.outro.driver, otherText);
      await ensureFollowing(true);

      const fan = s.fa.driver;
      await click(fan, 'nav-feed');
      await waitForPost(fan, otherText);
      await click(fan, 'feed-aba-seguindo');
      await waitForPost(fan, authorPost);
      await postIsGone(fan, otherText);
      assert.match(await (await find(fan, 'feed-aba-seguindo')).getText(), /Seguindo \(1\)/);

      await click(fan, 'feed-aba-todos');
      await waitForPost(fan, otherText);
    });
  });

  describe('Sala só para seguidores (RF17)', function () {
    it('CT-17.1 só quem segue o dono entra na sala restrita', async function () {
      await ensureFollowing(false);
      const room = unique('Sala fechada');
      const author = s.autor.driver;
      await open(author, '/salas');
      await type(author, 'sala-nova-nome', room);
      await (await find(author, 'sala-nova-acesso')).findElement(By.css('option[value="followers"]')).click();
      await click(author, 'sala-nova-criar');
      await waitForText(author, 'sala-nome', room);
      await find(author, 'sala-acesso');

      // O fã ainda não segue o dono: é barrado
      const fan = s.fa.driver;
      await enterRoom(fan, room);
      await find(fan, 'sala-restrita');
      assert.strictEqual((await fan.findElements(byTest('participante'))).length, 0);

      // Segue o dono pelo link da própria mensagem e tenta de novo
      await click(fan, 'sala-ver-dono');
      await waitForText(fan, 'perfil-nome', s.autor.user.name);
      await click(fan, 'perfil-seguir');
      await waitFollowing(fan, true);
      await enterRoom(fan, room);
      await fan.wait(async () => (await fan.findElements(byTest('participante'))).length > 0, config.WAIT, 'Seguidor não entrou na sala');
      assert.strictEqual((await fan.findElements(byTest('sala-restrita'))).length, 0);
    });

    it('CT-17.2 o dono muda a sala para "só seguidores" e o selo aparece na lista', async function () {
      const room = unique('Sala aberta');
      const author = s.autor.driver;
      await open(author, '/salas');
      await type(author, 'sala-nova-nome', room);
      await click(author, 'sala-nova-criar');
      await waitForText(author, 'sala-nome', room);
      assert.strictEqual((await author.findElements(byTest('sala-acesso'))).length, 0);

      await click(author, 'sala-editar');
      await (await find(author, 'sala-edicao-acesso')).findElement(By.css('option[value="followers"]')).click();
      await click(author, 'sala-edicao-salvar');
      await find(author, 'sala-acesso');

      await click(author, 'sala-sair');
      const card = await author.wait(
        async () => (await author.findElements(By.xpath(`//*[@data-test="sala-card"][.//*[@data-test="sala-card-nome" and text()="${room}"]]`)))[0],
        config.WAIT,
      );
      await card.findElement(byTest('sala-card-acesso'));
    });
  });
});
