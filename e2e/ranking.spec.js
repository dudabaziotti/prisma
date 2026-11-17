/**
 * Relatório Ranking semanal — Release 03 (RF13)
 * Publicação = 3 pontos, comentário = 1 ponto, curtida recebida = 2 pontos.
 * Filtro por período, exportação em CSV e impressão.
 *
 * O login é feito uma vez só, então os pontos do autor se acumulam de um teste para o outro.
 * Por isso cada teste lê o ranking antes e depois da ação e confere o quanto mudou.
 */
const assert = require('assert');
const { By } = require('selenium-webdriver');
const config = require('./support/config');
const { byTest, click, find } = require('./support/driver');
const { createPost, waitForPost, inCard } = require('./support/actions');
const { useSessions } = require('./support/session');

const unique = (text) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function openRanking(driver) {
  await click(driver, 'nav-ranking');
  await driver.wait(
    async () => (await driver.findElements(byTest('ranking-tabela'))).length + (await driver.findElements(byTest('ranking-vazio'))).length > 0,
    config.WAIT,
    'Ranking não carregou',
  );
}

const ZERO = { el: null, position: 0, posts: 0, comments: 0, likes: 0, points: 0 };

/** Linha do ranking de um usuário, com os números já lidos. Sem linha, devolve tudo zero. */
async function rowOf(driver, name, { required = true } = {}) {
  const xpath = By.xpath(`//*[@data-test="ranking-linha"][.//*[@data-test="ranking-nome" and normalize-space(.)="${name}"]]`);
  let row;
  if (required) row = await driver.wait(async () => (await driver.findElements(xpath))[0], config.WAIT, `"${name}" não aparece no ranking`);
  else row = (await driver.findElements(xpath))[0];
  if (!row) return ZERO;
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

/** Pontos atuais de um usuário: abre o ranking, lê e volta para o feed. */
async function snapshot(driver, name) {
  await openRanking(driver);
  const row = await rowOf(driver, name, { required: false });
  await click(driver, 'nav-feed');
  return row;
}

const delta = (after, before) => ({
  posts: after.posts - before.posts,
  comments: after.comments - before.comments,
  likes: after.likes - before.likes,
  points: after.points - before.points,
});

async function selectPeriod(driver, value) {
  await (await find(driver, 'ranking-periodo')).findElement(By.css(`option[value="${value}"]`)).click();
}

describe('Relatório Ranking semanal', function () {
  // Login uma vez: o autor publica; o visitante (outro navegador) curte e comenta.
  const s = useSessions(['autor', 'visitante']);

  it('CT-13.1 publicações da semana entram no ranking com 3 pontos cada', async function () {
    const before = await snapshot(this.driver, this.user.name);
    await createPost(this.driver, unique('Resumo de Física'));
    await createPost(this.driver, unique('Lista de Álgebra'));
    await openRanking(this.driver);
    const after = await rowOf(this.driver, this.user.name);
    assert.deepStrictEqual(delta(after, before), { posts: 2, comments: 0, likes: 0, points: 6 });
    assert.strictEqual(await after.el.getAttribute('data-me'), 'true');
  });

  it('CT-13.2 comentários e curtidas recebidas somam pontos e a tabela fica ordenada por pontos', async function () {
    const visitor = s.visitante.driver;
    const authorBefore = await snapshot(this.driver, this.user.name);
    const visitorBefore = await snapshot(visitor, s.visitante.user.name);

    const text = unique('Publicação comentada');
    await createPost(this.driver, text);

    const card = await waitForPost(visitor, text);
    await (await inCard(card, 'publicacao-curtir')).click();
    await visitor.wait(async () => (await (await inCard(card, 'publicacao-curtir')).getAttribute('aria-pressed')) === 'true', config.WAIT);
    await (await inCard(card, 'publicacao-comentarios')).click();
    const field = await visitor.wait(async () => (await card.findElements(byTest('comentario-novo-conteudo')))[0], config.WAIT);
    await field.sendKeys('Muito bom!');
    await (await card.findElement(byTest('comentario-novo-enviar'))).click();
    await visitor.wait(async () => (await card.findElements(byTest('comentario'))).length > 0, config.WAIT);

    await openRanking(this.driver);
    const a = await rowOf(this.driver, this.user.name);
    const v = await rowOf(this.driver, s.visitante.user.name);
    assert.deepStrictEqual(delta(a, authorBefore), { posts: 1, comments: 0, likes: 1, points: 5 });
    assert.deepStrictEqual(delta(v, visitorBefore), { posts: 0, comments: 1, likes: 0, points: 1 });

    const points = await Promise.all((await this.driver.findElements(byTest('ranking-pontos'))).map(async (el) => Number(await el.getText())));
    assert.deepStrictEqual(points, [...points].sort((x, y) => y - x), 'quem tem mais pontos deve ficar acima');
  });

  it('CT-13.3 curtir a própria publicação não dá pontos', async function () {
    const before = await snapshot(this.driver, this.user.name);
    const card = await createPost(this.driver, unique('Minha publicação'));
    await (await inCard(card, 'publicacao-curtir')).click();
    await this.driver.wait(async () => (await (await inCard(card, 'publicacao-curtir')).getAttribute('aria-pressed')) === 'true', config.WAIT);
    await openRanking(this.driver);
    const after = await rowOf(this.driver, this.user.name);
    assert.deepStrictEqual(delta(after, before), { posts: 1, comments: 0, likes: 0, points: 3 });
  });

  it('CT-13.4 o filtro "Semana passada" não mostra a atividade de hoje', async function () {
    await createPost(this.driver, unique('Publicação de hoje'));
    await openRanking(this.driver);
    await rowOf(this.driver, this.user.name);
    await selectPeriod(this.driver, 'semana-passada');
    const xpath = By.xpath(`//*[@data-test="ranking-nome" and normalize-space(.)="${this.user.name}"]`);
    await this.driver.wait(async () => (await this.driver.findElements(xpath)).length === 0, config.WAIT, 'Atividade de hoje apareceu na semana passada');
    assert.match(await (await find(this.driver, 'ranking-intervalo')).getText(), /Semana passada/);
  });

  it('CT-13.5 exporta o ranking em CSV e mostra o botão de imprimir', async function () {
    await openRanking(this.driver);
    const row = await rowOf(this.driver, this.user.name);
    const link = await find(this.driver, 'ranking-exportar');
    assert.match(await link.getAttribute('download'), /^ranking-prisma-semana-atual\.csv$/);
    const csv = decodeURIComponent((await link.getAttribute('href')).split(',').slice(1).join(','));
    assert.ok(csv.includes('Posição;Nome;Publicações;Comentários;Curtidas recebidas;Pontos'), 'cabeçalho do CSV');
    const line = `${row.position};${this.user.name};${row.posts};${row.comments};${row.likes};${row.points}`;
    assert.ok(csv.includes(line), `linha do usuário no CSV: ${line}`);
    assert.ok(await (await find(this.driver, 'ranking-imprimir')).isDisplayed());
  });
});
