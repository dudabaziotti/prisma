/**
 * CRUD de Disciplinas — Release 03 (RF05)
 * Catálogo de disciplinas: adicionar (C), listar (R), editar (U) e excluir (D).
 * Só quem adicionou a disciplina pode editá-la ou excluí-la.
 */
const assert = require('assert');
const { By } = require('selenium-webdriver');
const config = require('./support/config');
const { byTest, click, find, textOf, type } = require('./support/driver');
const { open } = require('./support/actions');
const { useSessions } = require('./support/session');

const unique = (text) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function addSubject(driver, name, description = '') {
  await open(driver, '/disciplinas');
  await type(driver, 'disciplina-nova-nome', name);
  if (description) await type(driver, 'disciplina-nova-descricao', description);
  await click(driver, 'disciplina-nova-criar');
  return waitForSubject(driver, name);
}

async function waitForSubject(driver, name) {
  const xpath = By.xpath(`//*[@data-test="disciplina"][.//*[@data-test="disciplina-nome" and text()="${name}"]]`);
  return driver.wait(async () => (await driver.findElements(xpath))[0], config.WAIT, `Disciplina "${name}" não apareceu`);
}

async function subjectIsGone(driver, name) {
  const xpath = By.xpath(`//*[@data-test="disciplina-nome" and text()="${name}"]`);
  await driver.wait(async () => (await driver.findElements(xpath)).length === 0, config.WAIT, `Disciplina "${name}" ainda aparece`);
}

describe('CRUD de Disciplinas', function () {
  // Login uma vez: quem cria as disciplinas e outra pessoa (outro navegador) para conferir as permissões.
  const s = useSessions(['criador', 'visitante']);

  it('CT-05.2 adiciona uma disciplina ao catálogo', async function () {
    const name = unique('Cálculo');
    const item = await addSubject(this.driver, name, 'Limites e derivadas');
    assert.strictEqual(await (await item.findElement(byTest('disciplina-descricao'))).getText(), 'Limites e derivadas');
  });

  it('CT-05.3 não adiciona disciplina sem nome nem com nome repetido', async function () {
    await open(this.driver, '/disciplinas');
    const button = await find(this.driver, 'disciplina-nova-criar');
    assert.strictEqual(await button.isEnabled(), false);
    const name = unique('Física');
    await addSubject(this.driver, name);
    await type(this.driver, 'disciplina-nova-nome', name.toUpperCase());
    await click(this.driver, 'disciplina-nova-criar');
    assert.match(await textOf(this.driver, 'disciplina-nova-erro'), /Já existe/);
  });

  it('CT-05.4 quem adicionou edita o nome e a descrição', async function () {
    const name = unique('Química');
    const renamed = unique('Química Geral');
    const item = await addSubject(this.driver, name);
    await (await item.findElement(byTest('disciplina-editar'))).click();
    await type(this.driver, 'disciplina-edicao-nome', renamed);
    await type(this.driver, 'disciplina-edicao-descricao', 'Estrutura atômica');
    await click(this.driver, 'disciplina-edicao-salvar');
    const updated = await waitForSubject(this.driver, renamed);
    assert.strictEqual(await (await updated.findElement(byTest('disciplina-descricao'))).getText(), 'Estrutura atômica');
    await subjectIsGone(this.driver, name);
  });

  it('CT-05.5 quem adicionou exclui a disciplina após confirmar', async function () {
    const name = unique('Estatística');
    const item = await addSubject(this.driver, name);
    await (await item.findElement(byTest('disciplina-excluir'))).click();
    await click(this.driver, 'disciplina-exclusao-confirmar');
    await subjectIsGone(this.driver, name);
  });

  it('CT-05.6 outro usuário não pode editar nem excluir a disciplina', async function () {
    const name = unique('Álgebra');
    await addSubject(this.driver, name);
    await open(s.visitante.driver, '/disciplinas');
    const item = await waitForSubject(s.visitante.driver, name);
    assert.strictEqual((await item.findElements(byTest('disciplina-editar'))).length, 0);
    assert.strictEqual((await item.findElements(byTest('disciplina-excluir'))).length, 0);
  });

  it('CT-05.7 a disciplina do catálogo aparece como sugestão ao publicar', async function () {
    const name = unique('Programação');
    await addSubject(this.driver, name);
    await open(this.driver, '/feed');
    const field = await find(this.driver, 'nova-publicacao-disciplina');
    const listId = await field.getAttribute('list');
    await this.driver.wait(
      async () => (await this.driver.findElements(By.css(`datalist#${listId} option[value="${name}"]`))).length === 1,
      config.WAIT,
      'A disciplina não apareceu nas sugestões',
    );
  });
});
