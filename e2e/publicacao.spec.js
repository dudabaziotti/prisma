/**
 * CRUD de Publicação — Release 01
 * Criar (C), listar no feed (R), editar (U) e excluir (D) publicações.
 * Só o autor pode editar ou excluir a própria publicação.
 */
const assert = require('assert');
const { createDriver, closeDriver, byTest, click, find, type } = require('./support/driver');
const { registerAndEnter, logout, createPost, waitForPost, postIsGone, inCard } = require('./support/actions');

const unique = (text) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

describe('CRUD de Publicação', function () {
  beforeEach(async function () {
    this.driver = await createDriver();
    this.user = await registerAndEnter(this.driver);
  });

  afterEach(async function () {
    await closeDriver(this);
  });

  describe('Criação (RF04, RF05)', function () {
    it('CT-04.1 cria uma publicação que aparece no feed com autor e data', async function () {
      const text = unique('Resumo de Cálculo I');
      const card = await createPost(this.driver, text);
      assert.strictEqual(await (await inCard(card, 'publicacao-autor')).getText(), this.user.name);
      assert.match(await (await inCard(card, 'publicacao-data')).getText(), /\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);
    });

    it('CT-04.2 não permite publicar um texto vazio', async function () {
      const button = await find(this.driver, 'nova-publicacao-salvar');
      assert.strictEqual(await button.isEnabled(), false);
      await type(this.driver, 'nova-publicacao-conteudo', '    ');
      assert.strictEqual(await button.isEnabled(), false);
    });

    it('CT-05.1 categoriza a publicação por disciplina e hashtags', async function () {
      const text = unique('Lista resolvida #Prova1 #derivadas');
      const card = await createPost(this.driver, text, 'Cálculo');
      assert.strictEqual(await (await inCard(card, 'publicacao-disciplina')).getText(), 'Cálculo');
      const tags = await card.findElements(byTest('publicacao-hashtag'));
      assert.deepStrictEqual(await Promise.all(tags.map((t) => t.getText())), ['#prova1', '#derivadas']);
    });
  });

  describe('Feed (RF06)', function () {
    it('CT-06.1 mostra as publicações da mais recente para a mais antiga', async function () {
      const first = unique('Primeira publicação');
      const second = unique('Segunda publicação');
      await createPost(this.driver, first);
      await createPost(this.driver, second);
      const contents = await Promise.all(
        (await this.driver.findElements(byTest('publicacao-conteudo'))).map((c) => c.getText()),
      );
      assert.ok(contents.indexOf(second) < contents.indexOf(first), 'A publicação mais nova deveria vir primeiro');
    });
  });

  describe('Edição e exclusão (RF18)', function () {
    it('CT-18.1 o autor edita a própria publicação', async function () {
      const text = unique('Texto original');
      const edited = unique('Texto corrigido #revisao');
      let card = await createPost(this.driver, text);

      await (await inCard(card, 'publicacao-editar')).click();
      await type(this.driver, 'edicao-conteudo', edited);
      await type(this.driver, 'edicao-disciplina', 'Física');
      await click(this.driver, 'edicao-salvar');

      card = await waitForPost(this.driver, edited);
      assert.strictEqual(await (await inCard(card, 'publicacao-disciplina')).getText(), 'Física');
      await inCard(card, 'publicacao-editada');
      await postIsGone(this.driver, text);
    });

    it('CT-18.2 cancelar a edição mantém o texto original', async function () {
      const text = unique('Não vou mudar');
      let card = await createPost(this.driver, text);
      await (await inCard(card, 'publicacao-editar')).click();
      await type(this.driver, 'edicao-conteudo', 'texto descartado');
      await click(this.driver, 'edicao-cancelar');
      card = await waitForPost(this.driver, text);
      assert.strictEqual((await card.findElements(byTest('publicacao-editada'))).length, 0);
    });

    it('CT-18.3 o autor exclui a própria publicação após confirmar', async function () {
      const text = unique('Publicação para excluir');
      const card = await createPost(this.driver, text);
      await (await inCard(card, 'publicacao-excluir')).click();
      await click(this.driver, 'exclusao-confirmar');
      await postIsGone(this.driver, text);
    });

    it('CT-18.4 outro usuário não vê os botões de editar e excluir', async function () {
      const text = unique('Publicação de outra pessoa');
      await createPost(this.driver, text);
      await logout(this.driver);

      await registerAndEnter(this.driver);
      const card = await waitForPost(this.driver, text);
      assert.strictEqual((await card.findElements(byTest('publicacao-editar'))).length, 0);
      assert.strictEqual((await card.findElements(byTest('publicacao-excluir'))).length, 0);
    });
  });
});
