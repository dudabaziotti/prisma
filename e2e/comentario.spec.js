/**
 * CRUD de Comentário — Release 02 (RF08)
 * Comentar (C), listar (R), responder, editar (U) e excluir (D) comentários.
 * Só o autor edita o próprio comentário; o autor do comentário ou da publicação pode excluí-lo.
 */
const assert = require('assert');
const { By } = require('selenium-webdriver');
const config = require('./support/config');
const { createDriver, closeDriver, byTest, click, find, type } = require('./support/driver');
const { registerAndEnter, login, logout, createPost, waitForPost, inCard } = require('./support/actions');

const unique = (text) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Abre os comentários de uma publicação e devolve o card. */
async function openComments(driver, postText) {
  const card = await waitForPost(driver, postText);
  await (await inCard(card, 'publicacao-comentarios')).click();
  await driver.wait(async () => (await card.findElements(byTest('comentarios'))).length > 0, config.WAIT);
  return card;
}

async function addComment(driver, card, text) {
  const field = await card.findElement(byTest('comentario-novo-conteudo'));
  await field.sendKeys(text);
  await (await card.findElement(byTest('comentario-novo-enviar'))).click();
  return waitForComment(driver, card, text);
}

/** Espera o comentário com esse texto aparecer no card e devolve o elemento dele. */
async function waitForComment(driver, card, text) {
  const xpath = By.xpath(`.//*[@data-test="comentario"][.//*[@data-test="comentario-conteudo" and contains(., "${text}")]]`);
  return driver.wait(async () => (await card.findElements(xpath))[0], config.WAIT, `Comentário "${text}" não apareceu`);
}

async function commentIsGone(driver, card, text) {
  const xpath = By.xpath(`.//*[@data-test="comentario-conteudo" and contains(., "${text}")]`);
  await driver.wait(async () => (await card.findElements(xpath)).length === 0, config.WAIT, `Comentário "${text}" ainda aparece`);
}

describe('CRUD de Comentário', function () {
  beforeEach(async function () {
    this.driver = await createDriver();
    this.user = await registerAndEnter(this.driver);
    this.postText = unique('Publicação para comentar');
    await createPost(this.driver, this.postText);
  });

  afterEach(async function () {
    await closeDriver(this);
  });

  describe('Criação e listagem (RF08)', function () {
    it('CT-08.1 comenta uma publicação e o comentário aparece com o autor', async function () {
      const card = await openComments(this.driver, this.postText);
      const text = unique('Ótimo resumo');
      const comment = await addComment(this.driver, card, text);
      assert.strictEqual(await (await comment.findElement(byTest('comentario-autor'))).getText(), this.user.name);
    });

    it('CT-08.2 não permite enviar um comentário vazio', async function () {
      const card = await openComments(this.driver, this.postText);
      const button = await card.findElement(byTest('comentario-novo-enviar'));
      assert.strictEqual(await button.isEnabled(), false);
      await (await card.findElement(byTest('comentario-novo-conteudo'))).sendKeys('   ');
      assert.strictEqual(await button.isEnabled(), false);
    });

    it('CT-08.3 responde a um comentário existente', async function () {
      const card = await openComments(this.driver, this.postText);
      const parent = await addComment(this.driver, card, unique('Pergunta'));
      await (await parent.findElement(byTest('comentario-responder'))).click();
      const answer = unique('Resposta');
      await type(this.driver, 'resposta-conteudo', answer);
      await click(this.driver, 'resposta-enviar');
      const reply = await waitForComment(this.driver, card, answer);
      assert.strictEqual(await reply.getAttribute('data-reply'), 'true');
    });
  });

  describe('Edição e exclusão (RF08)', function () {
    it('CT-08.4 o autor edita o próprio comentário', async function () {
      const card = await openComments(this.driver, this.postText);
      const original = unique('Comentário original');
      const edited = unique('Comentário corrigido');
      const comment = await addComment(this.driver, card, original);
      await (await comment.findElement(byTest('comentario-editar'))).click();
      await type(this.driver, 'comentario-edicao-conteudo', edited);
      await click(this.driver, 'comentario-edicao-salvar');
      const updated = await waitForComment(this.driver, card, edited);
      await updated.findElement(byTest('comentario-editado'));
      await commentIsGone(this.driver, card, original);
    });

    it('CT-08.5 o autor exclui o próprio comentário após confirmar', async function () {
      const card = await openComments(this.driver, this.postText);
      const text = unique('Comentário para excluir');
      const comment = await addComment(this.driver, card, text);
      await (await comment.findElement(byTest('comentario-excluir'))).click();
      await click(this.driver, 'comentario-exclusao-confirmar');
      await commentIsGone(this.driver, card, text);
    });

    it('CT-08.6 outro usuário comenta, mas não pode editar comentários alheios', async function () {
      let card = await openComments(this.driver, this.postText);
      const mine = unique('Comentário do autor');
      await addComment(this.driver, card, mine);
      await logout(this.driver);

      await registerAndEnter(this.driver);
      card = await openComments(this.driver, this.postText);
      const theirs = await waitForComment(this.driver, card, mine);
      assert.strictEqual((await theirs.findElements(byTest('comentario-editar'))).length, 0);
      assert.strictEqual((await theirs.findElements(byTest('comentario-excluir'))).length, 0);
      const own = await addComment(this.driver, card, unique('Comentário do visitante'));
      await own.findElement(byTest('comentario-editar'));
    });

    it('CT-08.7 o autor da publicação pode excluir o comentário de outra pessoa', async function () {
      await logout(this.driver);
      await registerAndEnter(this.driver);
      let card = await openComments(this.driver, this.postText);
      const text = unique('Comentário inadequado');
      await addComment(this.driver, card, text);
      await logout(this.driver);

      // Volta como autor da publicação
      await login(this.driver, this.user.email, this.user.password);
      await find(this.driver, 'usuario-logado');
      card = await openComments(this.driver, this.postText);
      const comment = await waitForComment(this.driver, card, text);
      assert.strictEqual((await comment.findElements(byTest('comentario-editar'))).length, 0);
      await (await comment.findElement(byTest('comentario-excluir'))).click();
      await click(this.driver, 'comentario-exclusao-confirmar');
      await commentIsGone(this.driver, card, text);
    });
  });
});