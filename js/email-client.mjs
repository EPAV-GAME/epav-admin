export function serviceUrl(config) {
  if (!config?.serviceUrl) return null;
  try { const url = new URL(config.serviceUrl); if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null; return url.origin; } catch { return null; }
}
export async function requestRecovery({ config, email, token, challenge, fetcher = fetch }) {
  const base = serviceUrl(config); if (!base) throw new Error('SERVICE_CONFIG');
  const response = await fetcher(base + (token ? '/admin/password-reset' : '/auth/forgot-password'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify({ email, ...(challenge ? { turnstileToken: challenge } : {}) }), signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok || data.sucesso !== true) {
    const error = new Error('SERVICE_REQUEST'); error.status = response.status; throw error;
  }
  return 'Se este e-mail estiver cadastrado, você receberá as instruções de recuperação.';
}
export function recoveryError(error) {
  if (error.message === 'SERVICE_CONFIG') return 'O serviço de recuperação ainda não foi configurado.';
  if (error.status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (error.status === 403) return 'O acesso foi recusado. Confira a permissão ou refaça a verificação.';
  if (error.status === 429) return 'Muitas solicitações. Aguarde um minuto e tente novamente.';
  if (error.status === 503) return 'O envio de recuperação está temporariamente indisponível.';
  return 'Não foi possível solicitar a recuperação. Confira sua conexão e tente novamente.';
}
