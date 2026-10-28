const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const SCREENSHOTS = path.join(__dirname, '..', 'reports', 'screenshots');

async function createDriver() {
  const options = new chrome.Options().addArguments(
    '--window-size=1280,900',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--lang=pt-BR',
  );
  if (config.HEADLESS) options.addArguments('--headless=new');
  if (config.CHROME_BIN) options.setChromeBinaryPath(config.CHROME_BIN);

  const builder = new Builder().forBrowser('chrome').setChromeOptions(options);
  if (config.CHROMEDRIVER) builder.setChromeService(new chrome.ServiceBuilder(config.CHROMEDRIVER));
  return builder.build();
}

/**
 * Fecha o navegador ao fim de cada teste. Se o teste falhou, salva antes um print
 * da tela em e2e/reports/screenshots — anexe esse print no bug do Mantis/Bugzilla.
 */
async function closeDriver(context) {
  const { driver, currentTest } = context;
  if (!driver) return;
  if (currentTest?.state === 'failed') {
    const image = await driver.takeScreenshot().catch(() => null);
    if (image) {
      const name = currentTest.fullTitle().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\-]+/g, '_').slice(0, 120);
      fs.mkdirSync(SCREENSHOTS, { recursive: true });
      fs.writeFileSync(path.join(SCREENSHOTS, `${name}.png`), image, 'base64');
    }
  }
  await driver.quit();
}

/** Seletor pelo atributo data-test, que não muda quando o visual muda. */
const byTest = (name) => By.css(`[data-test="${name}"]`);

async function find(driver, name, timeout = config.WAIT) {
  const el = await driver.wait(until.elementLocated(byTest(name)), timeout, `Elemento "${name}" não apareceu`);
  await driver.wait(until.elementIsVisible(el), timeout, `Elemento "${name}" não ficou visível`);
  return el;
}

/**
 * Limpa um campo avisando o Angular. O clear() do Selenium sozinho não dispara o
 * evento "input", e o formulário continuaria com o valor antigo.
 */
async function clearField(driver, el) {
  await el.clear();
  await driver.executeScript("arguments[0].dispatchEvent(new Event('input', { bubbles: true }))", el);
}

async function type(driver, name, text) {
  const el = await find(driver, name);
  await clearField(driver, el);
  await el.sendKeys(text);
}

async function click(driver, name) {
  const el = await find(driver, name);
  await driver.wait(until.elementIsEnabled(el), config.WAIT, `Botão "${name}" continuou desabilitado`);
  await el.click();
}

async function textOf(driver, name) {
  return (await find(driver, name)).getText();
}

async function waitForUrl(driver, pathPart) {
  await driver.wait(until.urlContains(pathPart), config.WAIT, `A URL não chegou em "${pathPart}"`);
}

async function waitForText(driver, name, expected) {
  await driver.wait(
    async () => {
      const els = await driver.findElements(byTest(name));
      for (const el of els) if ((await el.getText()).includes(expected)) return true;
      return false;
    },
    config.WAIT,
    `Texto "${expected}" não apareceu em "${name}"`,
  );
}

/** Espera um campo de formulário ser preenchido (ex.: dados do perfil carregados). */
async function waitForValue(driver, name) {
  const el = await find(driver, name);
  await driver.wait(async () => (await el.getAttribute('value')) !== '', config.WAIT, `Campo "${name}" continuou vazio`);
  return el;
}

async function waitUntilGone(driver, locator) {
  await driver.wait(async () => (await driver.findElements(locator)).length === 0, config.WAIT);
}

module.exports = { SCREENSHOTS, createDriver, closeDriver, clearField, byTest, find, type, click, textOf, waitForUrl, waitForText, waitForValue, waitUntilGone, By, until };
