/**
 * CRUD de Sala de Foco — Release 02 (RF14, RF15, RF16)
 * Criar (C), listar (R), editar (U) e excluir (D) salas; entrar e sair;
 * participantes em tempo real e cronômetro Pomodoro sincronizado.
 * Nos testes, o Pomodoro é curto (6 s de foco e 3 s de pausa), definido em environment.e2e.ts.
 */
const assert = require('assert');
const { By } = require('selenium-webdriver');
const config = require('./support/config');
const { createDriver, closeDriver, byTest, click, find, textOf, type, waitForUrl, waitForText } = require('./support/driver');
const { open, registerAndEnter } = require('./support/actions');

const unique = (text) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Converte "mm:ss" em segundos. */
async function clockSeconds(driver) {
  const [m, s] = (await textOf(driver, 'timer-tempo')).split(':').map(Number);
  return m * 60 + s;
}

async function createRoom(driver, name, subject = '') {
  await open(driver, '/salas');
  await type(driver, 'sala-nova-nome', name);
  if (subject) await type(driver, 'sala-nova-disciplina', subject);
  await click(driver, 'sala-nova-criar');
  await waitForText(driver, 'sala-nome', name);
  await waitForParticipants(driver, 1);
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

async function waitForParticipants(driver, count) {
  await driver.wait(
    async () => (await driver.findElements(byTest('participante'))).length === count,
    config.WAIT,
    `A sala deveria ter ${count} participante(s)`,
  );
}

async function waitForPhase(driver, phase, timeout = 15000) {
  await driver.wait(async () => (await textOf(driver, 'timer-fase')) === phase, timeout, `O cronômetro não chegou em "${phase}"`);
}

describe('CRUD de Sala de Foco', function () {
  beforeEach(async function () {
    this.driver = await createDriver();
    this.user = await registerAndEnter(this.driver);
    this.room = unique('Revisão para a P2');
  });

  afterEach(async function () {
    await closeDriver(this);
    await this.other?.quit().catch(() => undefined);
    this.other = undefined;
  });

  /** Segundo navegador, com outro usuário (para testes com duas pessoas). */
  async function secondUser(ctx) {
    ctx.other = await createDriver();
    await registerAndEnter(ctx.other);
    return ctx.other;
  }

  describe('Criação, listagem, edição e exclusão (RF14)', function () {
    it('CT-14.1 cria uma sala e entra nela como participante', async function () {
      await createRoom(this.driver, this.room, 'Cálculo');
      assert.strictEqual(await textOf(this.driver, 'sala-disciplina'), 'Cálculo');
      assert.strictEqual(await textOf(this.driver, 'sala-dono'), this.user.name);
      assert.strictEqual(await textOf(this.driver, 'participante-nome'), this.user.name);
      assert.strictEqual(await textOf(this.driver, 'participantes-contagem'), '1/10');
    });

    it('CT-14.2 não cria uma sala sem nome', async function () {
      await open(this.driver, '/salas');
      const button = await find(this.driver, 'sala-nova-criar');
      assert.strictEqual(await button.isEnabled(), false);
      await type(this.driver, 'sala-nova-nome', ' ');
      assert.strictEqual(await button.isEnabled(), false);
    });

    it('CT-14.3 outro usuário encontra a sala na lista e entra', async function () {
      await createRoom(this.driver, this.room);
      const other = await secondUser(this);
      await enterRoom(other, this.room);
      await waitForParticipants(other, 2);
    });

    it('CT-14.4 o dono edita o nome e a disciplina da sala', async function () {
      await createRoom(this.driver, this.room);
      const renamed = unique('Sala renomeada');
      await click(this.driver, 'sala-editar');
      await type(this.driver, 'sala-edicao-nome', renamed);
      await type(this.driver, 'sala-edicao-disciplina', 'Física');
      await click(this.driver, 'sala-edicao-salvar');
      await waitForText(this.driver, 'sala-nome', renamed);
      assert.strictEqual(await textOf(this.driver, 'sala-disciplina'), 'Física');
    });

    it('CT-14.5 o dono exclui a sala e ela some da lista', async function () {
      await createRoom(this.driver, this.room);
      await click(this.driver, 'sala-excluir');
      await click(this.driver, 'sala-exclusao-confirmar');
      await waitForUrl(this.driver, '/salas');
      await this.driver.wait(
        async () => (await this.driver.findElements(By.xpath(`//*[@data-test="sala-card-nome" and text()="${this.room}"]`))).length === 0,
        config.WAIT,
        'A sala ainda aparece na lista',
      );
    });

    it('CT-14.6 quem não é dono não vê editar, excluir nem os controles do cronômetro', async function () {
      await createRoom(this.driver, this.room);
      const other = await secondUser(this);
      await enterRoom(other, this.room);
      for (const name of ['sala-editar', 'sala-excluir', 'timer-iniciar']) {
        assert.strictEqual((await other.findElements(byTest(name))).length, 0, `"${name}" não deveria aparecer`);
      }
    });
  });

  describe('Participantes em tempo real (RF15)', function () {
    it('CT-15.1 a lista de participantes atualiza quando alguém entra e sai', async function () {
      await createRoom(this.driver, this.room);
      const other = await secondUser(this);
      await enterRoom(other, this.room);
      await waitForParticipants(this.driver, 2);
      await (await other.findElement(byTest('sala-sair'))).click();
      await waitForParticipants(this.driver, 1);
      assert.strictEqual(await textOf(this.driver, 'participantes-contagem'), '1/10');
    });
  });

  describe('Cronômetro Pomodoro (RF16, RNF10)', function () {
    it('CT-16.1 ao iniciar, entra em foco e conta o tempo regressivamente', async function () {
      await createRoom(this.driver, this.room);
      assert.strictEqual(await textOf(this.driver, 'timer-fase'), 'Aguardando início');
      await click(this.driver, 'timer-iniciar');
      await waitForPhase(this.driver, 'Foco');
      const first = await clockSeconds(this.driver);
      await sleep(2000);
      assert.ok((await clockSeconds(this.driver)) < first, 'O tempo deveria diminuir');
      assert.strictEqual(await textOf(this.driver, 'timer-ciclo'), 'Ciclo 1 de 4');
    });

    it('CT-16.2 passa do foco para a pausa e depois para o ciclo seguinte', async function () {
      await createRoom(this.driver, this.room);
      await click(this.driver, 'timer-iniciar');
      await waitForPhase(this.driver, 'Pausa');
      assert.strictEqual(await textOf(this.driver, 'timer-ciclo'), 'Ciclo 1 de 4');
      await waitForPhase(this.driver, 'Foco');
      assert.strictEqual(await textOf(this.driver, 'timer-ciclo'), 'Ciclo 2 de 4');
    });

    it('CT-16.3 pausar congela o tempo e retomar continua de onde parou', async function () {
      await createRoom(this.driver, this.room);
      await click(this.driver, 'timer-iniciar');
      await sleep(1500);
      await click(this.driver, 'timer-pausar');
      await find(this.driver, 'timer-retomar');
      const paused = await clockSeconds(this.driver);
      await sleep(2000);
      assert.strictEqual(await clockSeconds(this.driver), paused, 'O tempo não deveria mudar pausado');
      await click(this.driver, 'timer-retomar');
      await sleep(1500);
      assert.ok((await clockSeconds(this.driver)) < paused, 'O tempo deveria voltar a diminuir');
    });

    it('CT-16.4 o cronômetro é o mesmo para todos os participantes (diferença de até 2 s)', async function () {
      await createRoom(this.driver, this.room);
      const other = await secondUser(this);
      await enterRoom(other, this.room);
      await click(this.driver, 'timer-iniciar');
      await other.wait(async () => (await textOf(other, 'timer-fase')) === 'Foco', config.WAIT, 'O outro participante não viu o início');
      const [mine, theirs] = await Promise.all([clockSeconds(this.driver), clockSeconds(other)]);
      assert.ok(Math.abs(mine - theirs) <= 2, `Diferença de ${Math.abs(mine - theirs)} s entre os participantes`);
    });
  });
});