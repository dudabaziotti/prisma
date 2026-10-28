# Testes automatizados (Selenium)

Os testes abrem o Chrome e usam o Prisma como um usuário faria. Eles rodam contra os
**emuladores do Firebase**, então não criam usuários nem publicações no projeto real.

## Pré-requisitos (uma vez só)

- Node.js 20 ou mais novo
- Google Chrome instalado
- Java 11 ou mais novo (o emulador do Firestore precisa)
- `npm install` na raiz do projeto

O Selenium baixa sozinho o `chromedriver` compatível com o seu Chrome.

## Como rodar

Abra **três terminais** na raiz do projeto:

```bash
# Terminal 1 – emuladores do Firebase (Auth + Firestore)
npm run emulators

# Terminal 2 – Prisma apontando para os emuladores
npm run start:e2e

# Terminal 3 – testes
npm run test:e2e
```

Para gerar o relatório em HTML (bom para anexar no Status Report):

```bash
npm run test:e2e:report
```

O relatório fica em `e2e/reports/relatorio-testes.html`.

## Quando um teste falha

- Um print da tela é salvo em `e2e/reports/screenshots/`.
- Registre o bug no Mantis/Bugzilla com o ID do caso de teste (ex.: `CT-18.1`), os passos,
  o resultado esperado, o resultado obtido e o print.
- No commit da correção, cite o bug: `[BUG-12] Corrige edição de publicação`.

## Opções úteis

| Variável | Para que serve |
|----------|----------------|
| `HEADLESS=false` | Mostra o Chrome na tela durante os testes |
| `BASE_URL=http://localhost:4300` | Testa o Prisma rodando em outro endereço |
| `RESET_EMULATORS=false` | Não apaga os dados dos emuladores antes de rodar |
| `CHROME_BIN` / `CHROMEDRIVER` | Usa um Chrome ou chromedriver específico |

Exemplo no Windows (PowerShell): `$env:HEADLESS="false"; npm run test:e2e`

## Casos de teste

| Arquivo | Casos | Requisitos |
|---------|-------|------------|
| `usuario.spec.js` | CT-01.1 a CT-01.4, CT-02.1 a CT-02.3, CT-03.1 a CT-03.3, CT-19.1 e CT-19.2 | RF01, RF02, RF03, RF19 |
| `publicacao.spec.js` | CT-04.1, CT-04.2, CT-05.1, CT-06.1, CT-18.1 a CT-18.4 | RF04, RF05, RF06, RF18 |
