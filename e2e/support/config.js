/**
 * Configuração dos testes Selenium. Tudo pode ser alterado por variável de ambiente:
 *   BASE_URL         endereço do Prisma (padrão: http://localhost:4200)
 *   HEADLESS=false   abre o Chrome na tela para acompanhar o teste
 *   CHROME_BIN       caminho de um Chrome específico (opcional)
 *   CHROMEDRIVER     caminho de um chromedriver específico (opcional; por padrão o
 *                    Selenium Manager baixa o driver certo automaticamente)
 *   RESET_EMULATORS=false  não limpa os emuladores antes da execução
 */
module.exports = {
  BASE_URL: (process.env.BASE_URL || 'http://localhost:4200').replace(/\/$/, ''),
  HEADLESS: process.env.HEADLESS !== 'false',
  CHROME_BIN: process.env.CHROME_BIN,
  CHROMEDRIVER: process.env.CHROMEDRIVER,
  RESET_EMULATORS: process.env.RESET_EMULATORS !== 'false',
  PROJECT_ID: process.env.FIREBASE_PROJECT || 'demo-prisma',
  WAIT: Number(process.env.WAIT_MS || 10000),
};
