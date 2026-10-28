/** Traduz os códigos de erro do Firebase para mensagens em português. */
const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
  'auth/requires-recent-login': 'Por segurança, faça login novamente antes de continuar.',
  'permission-denied': 'Você não tem permissão para esta ação.',
  unavailable: 'Serviço indisponível no momento. Tente novamente.',
};

export function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  return MESSAGES[code] ?? 'Algo deu errado. Tente novamente.';
}
