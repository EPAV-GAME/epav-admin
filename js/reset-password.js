const $ = id => document.getElementById(id);
const parameters = new URLSearchParams(location.search);
const code = parameters.get('oobCode');
const mode = parameters.get('mode');
// Keep the code in memory only; remove it from the URL before any SDK request.
history.replaceState(null, '', location.pathname);
let auth, sdk;
function status(text, error = false) { $('reset-status').textContent = text; $('reset-status').classList.toggle('error', error); }
function controls(disabled) { for (const id of ['new-password', 'confirm-password', 'reset-button']) $(id).disabled = disabled; }
function errorMessage(error) {
  const messages = { 'auth/expired-action-code': 'Este link expirou. Solicite uma nova recuperação de senha.', 'auth/invalid-action-code': 'Este link é inválido ou já foi utilizado. Solicite uma nova recuperação de senha.', 'auth/weak-password': 'Esta senha não atende aos requisitos da conta. Use uma senha mais forte.', 'auth/password-does-not-meet-requirements': 'Esta senha não atende aos requisitos da conta. Use uma senha mais forte.', 'auth/network-request-failed': 'Confira sua conexão e tente novamente.' };
  return messages[error.code] || 'Não foi possível redefinir a senha. Tente novamente ou solicite um novo link.';
}
$('reset-form').addEventListener('submit', async event => {
  event.preventDefault();
  if ($('new-password').value !== $('confirm-password').value) { status('As senhas devem ser iguais.', true); return; }
  if ($('new-password').value.length < 8) { status('Use pelo menos 8 caracteres.', true); return; }
  controls(true); status('Salvando sua nova senha…');
  try {
    await sdk.confirmPasswordReset(auth, code, $('new-password').value);
    $('new-password').value = ''; $('confirm-password').value = '';
    $('reset-account').textContent = 'Senha atualizada.';
    status('Tudo certo! Você já pode entrar com a nova senha.');
    $('reset-button').hidden = true;
  } catch (error) {
    status(errorMessage(error), true);
    if (!['auth/expired-action-code', 'auth/invalid-action-code'].includes(error.code)) controls(false);
  }
});
async function init() {
  if (!code || mode !== 'resetPassword') { $('reset-account').textContent = 'Link de recuperação inválido.'; status('Abra o link recebido por e-mail ou solicite uma nova recuperação.', true); return; }
  try {
    if (window.EPAV_FIREBASE_CONFIG?.projectId !== 'epav-game') throw new Error('CONFIG');
    const base = 'https://www.gstatic.com/firebasejs/12.18.0';
    const appSdk = await import(base + '/firebase-app.js'); sdk = await import(base + '/firebase-auth.js');
    auth = sdk.getAuth(appSdk.initializeApp(window.EPAV_FIREBASE_CONFIG));
    const email = await sdk.verifyPasswordResetCode(auth, code);
    $('reset-account').textContent = 'Redefina a senha da conta ' + email + '.';
    status('O link é válido. Informe sua nova senha.'); controls(false);
  } catch (error) { $('reset-account').textContent = 'Não foi possível validar seu link.'; status(errorMessage(error), true); }
}
init();
