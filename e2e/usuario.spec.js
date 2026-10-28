/**
 * CRUD de Usuário/Perfil — Release 01
 * Cadastro (C), visualização de perfil (R), edição de perfil (U) e exclusão de conta (D),
 * além de login/logout e proteção de rotas.
 */
const assert = require('assert');
const { createDriver, closeDriver, clearField, byTest, click, find, textOf, type, waitForUrl, waitForText, waitForValue } = require('./support/driver');
const { newUser, open, register, registerAndEnter, login, logout } = require('./support/actions');

describe('CRUD de Usuário/Perfil', function () {
  beforeEach(async function () {
    this.driver = await createDriver();
  });

  afterEach(async function () {
    await closeDriver(this);
  });

  describe('Cadastro (RF01)', function () {
    it('CT-01.1 cadastra um novo usuário e entra no feed', async function () {
      const user = await registerAndEnter(this.driver);
      assert.strictEqual(await textOf(this.driver, 'usuario-logado'), user.name);
    });

    it('CT-01.2 não cadastra quando as senhas são diferentes', async function () {
      await register(this.driver, { ...newUser(), confirm: 'outraSenha' });
      assert.match(await textOf(this.driver, 'erro-confirmar'), /não coincidem/);
      assert.match(await this.driver.getCurrentUrl(), /\/cadastro$/);
    });

    it('CT-01.3 valida campos obrigatórios e senha curta', async function () {
      await open(this.driver, '/cadastro');
      await type(this.driver, 'cadastro-senha', '123');
      await click(this.driver, 'cadastro-enviar');
      await find(this.driver, 'erro-nome');
      await find(this.driver, 'erro-email');
      assert.match(await textOf(this.driver, 'erro-senha'), /6 caracteres/);
    });

    it('CT-01.4 não permite cadastrar um e-mail já usado', async function () {
      const user = await registerAndEnter(this.driver);
      await logout(this.driver);
      await register(this.driver, { ...newUser(), email: user.email });
      assert.match(await textOf(this.driver, 'cadastro-erro'), /já está cadastrado/);
    });
  });

  describe('Login e sessão (RF02)', function () {
    it('CT-02.1 entra com e-mail e senha válidos', async function () {
      const user = await registerAndEnter(this.driver);
      await logout(this.driver);
      await login(this.driver, user.email, user.password);
      await waitForUrl(this.driver, '/feed');
      await waitForText(this.driver, 'usuario-logado', user.name);
    });

    it('CT-02.2 mostra erro com senha incorreta', async function () {
      const user = await registerAndEnter(this.driver);
      await logout(this.driver);
      await login(this.driver, user.email, 'senhaErrada');
      assert.match(await textOf(this.driver, 'login-erro'), /incorretos/);
    });

    it('CT-02.3 redireciona para o login ao acessar o feed sem estar logado', async function () {
      await open(this.driver, '/feed');
      await waitForUrl(this.driver, '/login');
    });
  });

  describe('Perfil (RF03)', function () {
    it('CT-03.1 mostra o perfil do usuário logado', async function () {
      const user = await registerAndEnter(this.driver);
      await click(this.driver, 'nav-perfil');
      await waitForText(this.driver, 'perfil-nome', user.name);
      await find(this.driver, 'perfil-editar');
    });

    it('CT-03.2 edita nome, biografia, interesses e avatar', async function () {
      await registerAndEnter(this.driver);
      await open(this.driver, '/perfil/editar');
      await waitForValue(this.driver, 'editar-nome');
      const newName = `Nome Editado ${Date.now().toString(36)}`;
      await type(this.driver, 'editar-nome', newName);
      await type(this.driver, 'editar-bio', 'Estudante de Engenharia de Computação na UNIFEI.');
      await type(this.driver, 'editar-interesses', 'Cálculo, Programação, Física');
      await this.driver.findElement(byTest('avatar-raposa')).findElement({ xpath: '..' }).click();
      await click(this.driver, 'editar-salvar');

      await waitForUrl(this.driver, '/perfil');
      await waitForText(this.driver, 'perfil-nome', newName);
      assert.strictEqual(await textOf(this.driver, 'perfil-bio'), 'Estudante de Engenharia de Computação na UNIFEI.');
      const interests = await this.driver.findElements(byTest('perfil-interesse'));
      assert.deepStrictEqual(await Promise.all(interests.map((i) => i.getText())), ['Cálculo', 'Programação', 'Física']);
      assert.strictEqual(await (await find(this.driver, 'perfil-avatar')).getAttribute('data-avatar'), 'raposa');
      await waitForText(this.driver, 'usuario-logado', newName);
    });

    it('CT-03.3 não salva o perfil com nome vazio', async function () {
      await registerAndEnter(this.driver);
      await open(this.driver, '/perfil/editar');
      await waitForValue(this.driver, 'editar-nome');
      await clearField(this.driver, await find(this.driver, 'editar-nome'));
      await click(this.driver, 'editar-salvar');
      await find(this.driver, 'erro-editar-nome');
      assert.match(await this.driver.getCurrentUrl(), /\/perfil\/editar$/);
    });
  });

  describe('Exclusão de conta (RF19)', function () {
    it('CT-19.1 não exclui a conta com a senha errada', async function () {
      await registerAndEnter(this.driver);
      await open(this.driver, '/perfil/editar');
      await click(this.driver, 'excluir-conta');
      await type(this.driver, 'excluir-conta-senha', 'senhaErrada');
      await click(this.driver, 'excluir-conta-confirmar');
      assert.match(await textOf(this.driver, 'excluir-conta-erro'), /incorret/);
      assert.match(await this.driver.getCurrentUrl(), /\/perfil\/editar$/);
    });

    it('CT-19.2 exclui a conta e impede um novo login', async function () {
      const user = await registerAndEnter(this.driver);
      await open(this.driver, '/perfil/editar');
      await click(this.driver, 'excluir-conta');
      await type(this.driver, 'excluir-conta-senha', user.password);
      await click(this.driver, 'excluir-conta-confirmar');

      await waitForUrl(this.driver, '/login');
      await find(this.driver, 'aviso-conta-excluida');

      await login(this.driver, user.email, user.password);
      assert.match(await textOf(this.driver, 'login-erro'), /incorretos/);
    });
  });
});
