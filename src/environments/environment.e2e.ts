// Configuração usada nos testes Selenium: aponta para os emuladores locais do Firebase.
// Projetos com prefixo "demo-" rodam só nos emuladores e não precisam de credenciais reais.
export const environment = {
  useEmulators: true,
  firebase: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-prisma.firebaseapp.com',
    projectId: 'demo-prisma',
    storageBucket: 'demo-prisma.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
  },
};
