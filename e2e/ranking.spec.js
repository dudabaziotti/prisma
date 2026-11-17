/**
 * Relatório Ranking semanal — Release 03 (RF13)
 * Publicação = 3 pontos, comentário = 1 ponto, curtida recebida = 2 pontos.
 * Filtro por período, exportação em CSV e impressão.
 */
const assert = require('assert');
const { By } = require('selenium-webdriver');
const config = require('./support/config');
const { createDriver, closeDriver, byTest, click, find } = require('./support/driver');
const { registerAndEnter, logout, createPost, waitForPost, inCard } = require('./support/actions');

const unique = (text) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function openRanking(driver) {
  await click(driver, 'nav-ranking');
  await driver.wait(
    async () => (await driver.findElements(byTest('ranking-tabela'))).length + (await driver.findElements(byTest('ranking-vazio'))).length > 0,
    config.WAIT,
    'Ranking não carregou',
  );
}

/** Linha do ranking de um usuário, com os números já lidos. */
async function rowOf(driver, name) {
  const xpath = By.xpath(`//*[@data-test="ranking-linha"][.//*[@data-test="ranking-nome" and normalize-space(.)="${name}"]]`);
  const row = await driver.wait(async () => (await driver.findElements(xpath))[0], config.WAIT, `"${name}" não aparece no ranking`);
  const value = async (test) => (await (await inCard(row, test)).getText()).trim();
  return {
    el: row,
    position: parseInt(await value('ranking-posicao'), 10),
    posts: Number(await value('ranking-publicacoes')),
    comments: Number(await value('ranking-comentarios')),
    likes: Number(await value('ranking-curtidas')),
    points: Number(await value('ranking-pontos')),
  };
}

async function selectPeriod(driver, value) {
  await (await find(driver, 'ranking-periodo')).findElement(By.css(`option[value="${value}"]`)).click();
}

describe('Relatório Ranking semanal', function () {
  beforeEach(async function () {
    this.driver = await createDriver();
  });

  afterEach(async function () {
    await closeDriver(this);
  });

  it('CT-13.1 publicações da semana entram no ranking com 3 pontos cada', async function () {
    const user = await registerAndEnter(this.driver);
    await createPost(this.driver, unique('Resumo de Física'));
    await createPost(this.driver, unique('Lista de Álgebra'));
    await openRanking(this.driver);
    const row = await rowOf(this.driver, user.name);
    assert.deepStrictEqual([row.posts, row.comments, row.likes, row.points], [2, 0, 0, 6]);
    assert.strictEqual(await row.el.getAttribute('data-me'), 'true');
  });

  it('CT-13.2 comentários e curtidas recebidas somam pontos e definem a ordem', async function () {
    const author = await registerAndEnter(this.driver);
    const text = unique('Publicação comentada');
    await createPost(this.driver, text);
    await logout(this.driver);

    const visitor = await registerAndEnter(this.driver);
    const card = await waitForPost(this.driver, text);
    await (await inCard(card, 'publicacao-curtir')).click();
    await this.driver.wait(async () => (await (await inCard(card, 'publicacao-curtir')).getAttribute('aria-pressed')) === 'true', config.WAIT);
    await (await inCard(card, 'publicacao-comentarios')).click();
    const field = await this.driver.wait(async () => (await card.findElements(byTest('comentario-novo-conteudo')))[0], config.WAIT);
    await field.sendKeys('Muito bom!');
    await (await card.findElement(byTest('comentario-novo-enviar'))).click();
    await this.driver.wait(async () => (await card.findElements(byTest('comentario'))).length > 0, config.WAIT);

    await openRanking(this.driver);
    const a = await rowOf(this.driver, author.name);
    const v = await rowOf(this.driver, visitor.name);
    assert.deepStrictEqual([a.posts, a.likes, a.points], [1, 1, 5]);
    assert.deepStrictEqual([v.comments, v.points], [1, 1]);
    assert.ok(a.position < v.position, 'quem tem mais pontos deve ficar acima');
  });

  it('CT-13.3 curtir a própria publicação não dá pontos', async function () {
    const user = await registerAndEnter(this.driver);
    const card = await createPost(this.driver, unique('Minha publicação'));
    await (await inCard(card, 'publicacao-curtir')).click();
    await this.driver.wait(async () => (await (await inCard(card, 'publicacao-curtir')).getAttribute('aria-pressed')) === 'true', config.WAIT);
    await openRanking(this.driver);
    const row = await rowOf(this.driver, user.name);
    assert.deepStrictEqual([row.likes, row.points], [0, 3]);
  });

  it('CT-13.4 o filtro "Semana passada" não mostra a atividade de hoje', async function () {
    const user = await registerAndEnter(this.driver);
    await createPost(this.driver, unique('Publicação de hoje'));
    await openRanking(this.driver);
    await rowOf(this.driver, user.name);
    await selectPeriod(this.driver, 'semana-passada');
    const xpath = By.xpath(`//*[@data-test="ranking-nome" and normalize-space(.)="${user.name}"]`);
    await this.driver.wait(async () => (await this.driver.findElements(xpath)).length === 0, config.WAIT, 'Atividade de hoje apareceu na semana passada');
    assert.match(await (await find(this.driver, 'ranking-intervalo')).getText(), /Semana passada/);
  });

  it('CT-13.5 exporta o ranking em CSV e mostra o botão de imprimir', async function () {
    const user = await registerAndEnter(this.driver);
    await createPost(this.driver, unique('Publicação para o relatório'));
    await openRanking(this.driver);
    await rowOf(this.driver, user.name);
    const link = await find(this.driver, 'ranking-exportar');
    assert.match(await link.getAttribute('download'), /^ranking-prisma-semana-atual\.csv$/);
    const csv = decodeURIComponent((await link.getAttribute('href')).split(',').slice(1).join(','));
    assert.ok(csv.includes('Posição;Nome;Publicações;Comentários;Curtidas recebidas;Pontos'), 'cabeçalho do CSV');
    assert.ok(csv.includes(`${user.name};1;0;0;3`), 'linha do usuário no CSV');
    assert.ok(await (await find(this.driver, 'ranking-imprimir')).isDisplayed());
  });
});
