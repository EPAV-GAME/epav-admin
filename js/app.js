import { TYPES, OCCASIONS, filterProducts, makeEdit, fingerprint } from './catalog.mjs';
import { serviceUrl, requestRecovery, recoveryError } from './email-client.mjs';
import { createProductPhoto } from './product-photo.mjs';
const $ = id => document.getElementById(id);
let services, products = [], selected, page = 0, view = 'products', epoch = 0, busy = false;
let records = [], cursor = null, more = false;
const pageSize = 50;
let catalogLoadedAt = 0;
const titles = { products: 'Catálogo de produtos', imports: 'Importações', audit: 'Histórico de alterações', ranking: 'Resultados do jogo', emails: 'Recuperação de senha' };
const collections = { imports: 'importacoes_catalogo', audit: 'auditoria_catalogo', ranking: 'ranking' };
const errors = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/invalid-email': 'Confira o e-mail informado.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  'auth/network-request-failed': 'Confira sua conexão e tente novamente.',
  'permission-denied': 'O banco recusou o acesso. Confira a permissão de administrador.',
  'unavailable': 'O banco está indisponível. Tente novamente.',
  'CONFLICT': 'Este produto foi alterado por outra pessoa. Atualize os dados e abra a edição novamente.',
  'VALIDATION': 'Confira o nome e as categorias selecionadas.', 'NO_ADMIN': 'Esta conta não tem permissão de administrador.',
  'CONFIG': 'A conexão não foi configurada. Contate o responsável pelo painel.',
};
function message(text, error = false, target = 'status') { $(target).textContent = text; $(target).classList.toggle('error', error); }
function errorMessage(error) { return errors[error.code || error.message] || 'Não foi possível concluir. Tente novamente.'; }
function busyState(value) {
  busy = value;
  for (const id of ['refresh', 'export', 'more']) $(id).disabled = value;
  document.querySelectorAll('nav button').forEach(button => { button.disabled = value; });
}
function filters() { return { search: $('search').value, available: $('availability').value, type: $('type-filter').value, occasion: $('occasion-filter').value }; }
function matching() { return filterProducts(products, filters()); }
function textCell(row, value) { const cell = document.createElement('td'); cell.textContent = String(value ?? '—'); row.append(cell); return cell; }
function tags(cell, values) { if (!values.length) { cell.textContent = 'Sem classificação'; return; } for (const value of values) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = value; cell.append(tag); } }
function renderProducts() {
  $('total').textContent = products.length.toLocaleString('pt-BR');
  $('available').textContent = products.filter(product => product.disponivelNoJogo).length.toLocaleString('pt-BR');
  $('unclassified').textContent = products.filter(product => !product.tiposProduto.length).length.toLocaleString('pt-BR');
  const list = matching();
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  page = Math.min(page, pages - 1);
  const fragment = document.createDocumentFragment();
  for (const product of list.slice(page * pageSize, (page + 1) * pageSize)) {
    const row = document.createElement('tr');
    const cell = textCell(row, '');
    const name = document.createElement('strong'); name.textContent = product.nome;
    const code = document.createElement('small'); code.textContent = 'Código ' + product.codigo + ' · ' + (product.dadosOriginais['Unidade Medida'] || '—') + ' · Linha ' + product.linhaOrigem;
    const summary = document.createElement('div'); summary.className = 'product-summary';
    const copy = document.createElement('div'); copy.className = 'product-copy'; copy.append(name, code);
    summary.append(createProductPhoto(product), copy); cell.append(summary);
    tags(textCell(row, ''), product.tiposProduto); tags(textCell(row, ''), product.ocasioes);
    const availability = document.createElement('span'); availability.className = 'tag ' + (product.disponivelNoJogo ? 'available' : 'unavailable'); availability.textContent = product.disponivelNoJogo ? 'Disponível' : 'Indisponível'; textCell(row, '').append(availability);
    const edit = document.createElement('button'); edit.className = 'secondary'; edit.textContent = 'Editar'; edit.disabled = busy; edit.setAttribute('aria-label', 'Editar ' + product.nome); edit.onclick = () => openEditor(product); textCell(row, '').append(edit);
    fragment.append(row);
  }
  $('product-rows').replaceChildren(fragment); $('empty').hidden = !!list.length;
  $('count').textContent = list.length.toLocaleString('pt-BR') + ' registro(s) encontrados · ' + products.length.toLocaleString('pt-BR') + ' no catálogo';
  $('page-label').textContent = (page + 1) + ' / ' + pages;
  $('prev').disabled = page === 0; $('next').disabled = page + 1 >= pages;
  $('export').disabled = busy || !list.length;
}
function date(value) { return value?.toDate ? value.toDate().toLocaleString('pt-BR') : value ? new Date(value).toLocaleString('pt-BR') : '—'; }
function renderRecords() {
  const definitions = {
    imports: { columns: ['Arquivo', 'Registros', 'Disponíveis na importação', 'Situação', 'Verificação'], values: r => [r.arquivoOrigem, r.totalRegistros, r.totalDisponiveis, r.status, date(r.verificadoEm)], description: 'Metadados das importações. As quantidades registradas aqui correspondem ao momento da importação.' },
    audit: { columns: ['Produto', 'Alterações', 'Administrador', 'Data'], values: r => [r.depois?.nome || r.produtoId, ['nome', 'disponivelNoJogo', 'tiposProduto', 'ocasioes'].filter(field => fingerprint(r.antes?.[field]) !== fingerprint(r.depois?.[field])).map(field => ({ nome: 'Nome', disponivelNoJogo: 'Disponibilidade', tiposProduto: 'Tipos', ocasioes: 'Ocasiões' })[field]).join(', '), r.autorEmail, date(r.criadoEm)], description: 'Alterações de produtos, da mais recente para a mais antiga. Cada edição registra os valores anteriores e os novos no banco.' },
    ranking: { columns: ['Jogador', 'Pontos', 'Satisfação', 'Tempo', 'Classificação', 'Publicação'], values: r => [r.nome, r.pontos, r.satisfacao + '%', Number.isFinite(r.tempoJogadoMs) ? Math.floor(r.tempoJogadoMs / 60000) + ':' + String(Math.floor(r.tempoJogadoMs / 1000) % 60).padStart(2, '0') : '—', r.classificacao, date(r.publicadoEm)], description: 'Resultados publicados pelos jogadores. Esta seção permite consultar as pontuações.' },
  };
  const definition = definitions[view];
  $('records-description').textContent = definition.description;
  const head = document.createElement('tr');
  for (const title of definition.columns) { const cell = document.createElement('th'); cell.textContent = title; head.append(cell); }
  $('records-head').replaceChildren(head);
  const fragment = document.createDocumentFragment();
  for (const record of records) { const row = document.createElement('tr'); for (const value of definition.values(record)) textCell(row, value); fragment.append(row); }
  if (!records.length) { const row = document.createElement('tr'); const cell = textCell(row, 'Nenhum registro encontrado.'); cell.colSpan = definition.columns.length; fragment.append(row); }
  $('records-rows').replaceChildren(fragment); $('more').hidden = !more;
}
async function requireAdmin() {
  const user = services.auth.currentUser;
  if (!user || (await services.authSdk.getIdTokenResult(user, true)).claims.admin !== true) throw new Error('NO_ADMIN');
  return user;
}
async function load(reset = true, force = false) {
  if (busy || !services.auth.currentUser) return;
  const generation = epoch;
  const activeView = view;
  busyState(true); renderProducts(); message('Carregando dados…');
  try {
    await requireAdmin();
    const f = services.firestoreSdk;
    if (activeView === 'emails') {
      renderEmailConfig();
    } else if (activeView === 'products') {
      if (!force && catalogLoadedAt && Date.now() - catalogLoadedAt < 300000) {
        message('Catálogo carregado. Use Atualizar dados para buscar alterações recentes.');
        return;
      }
      let last, all = [];
      do {
        const clauses = [f.orderBy(f.documentId()), f.limit(300)];
        if (last) clauses.push(f.startAfter(last));
        const result = await f.getDocsFromServer(f.query(f.collection(services.db, 'produtos_swift'), ...clauses));
        if (generation !== epoch) return;
        all.push(...result.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        last = result.size === 300 ? result.docs.at(-1) : null;
        message('Carregando catálogo: ' + all.length.toLocaleString('pt-BR') + ' registros…');
      } while (last);
      products = all; page = 0; catalogLoadedAt = Date.now();
    } else {
      const clauses = [f.orderBy(activeView === 'audit' ? 'criadoEm' : f.documentId(), activeView === 'audit' ? 'desc' : 'asc'), f.limit(100)];
      if (!reset && cursor) clauses.push(f.startAfter(cursor));
      const result = await f.getDocsFromServer(f.query(f.collection(services.db, collections[activeView]), ...clauses));
      if (generation !== epoch) return;
      records = reset ? [] : records;
      const unique = new Map(records.map(record => [record.id, record]));
      result.docs.forEach(doc => unique.set(doc.id, { ...doc.data(), id: doc.id }));
      records = [...unique.values()]; cursor = result.docs.at(-1); more = result.size === 100;
    }
    message('Dados atualizados às ' + new Date().toLocaleTimeString('pt-BR') + '.');
  } catch (error) {
    if (generation !== epoch) return;
    message(errorMessage(error), true);
    if (error.message === 'NO_ADMIN' || error.code === 'permission-denied') {
      await services.authSdk.signOut(services.auth);
      message(errorMessage(error), true, 'login-status');
    }
  } finally {
    if (generation === epoch) { busyState(false); activeView === 'products' ? renderProducts() : activeView === 'emails' ? renderEmailConfig() : renderRecords(); }
  }
}
function openEditor(product) {
  selected = product;
  $('editor-photo').replaceChildren(createProductPhoto(product, { large: true }));
  $('editor-title').textContent = product.nome; $('editor-code').textContent = 'Código ' + product.codigo + ' · linha ' + product.linhaOrigem;
  $('product-name').value = product.nome; $('product-available').checked = product.disponivelNoJogo;
  document.querySelectorAll('#type-options input').forEach(input => { input.checked = product.tiposProduto.includes(input.value); });
  document.querySelectorAll('#occasion-options input').forEach(input => { input.checked = product.ocasioes.includes(input.value); });
  const fragment = document.createDocumentFragment();
  for (const [key, value] of Object.entries(product.dadosOriginais)) { const label = document.createElement('dt'); label.textContent = key; const detail = document.createElement('dd'); detail.textContent = value ?? '—'; fragment.append(label, detail); }
  $('source-fields').replaceChildren(fragment); $('editor').querySelector('details').open = false;
  message('As alterações serão registradas no histórico.', false, 'editor-status'); $('editor').showModal();
}
function closeEditor() { if (!$('save').disabled) $('editor').close(); }
$('edit-form').addEventListener('submit', async event => {
  event.preventDefault();
  const generation = epoch;
  const baseline = selected;
  let changes;
  try { changes = makeEdit(baseline, { name: $('product-name').value, available: $('product-available').checked, types: [...document.querySelectorAll('#type-options input:checked')].map(input => input.value), occasions: [...document.querySelectorAll('#occasion-options input:checked')].map(input => input.value) }); }
  catch (error) { message(errorMessage(error), true, 'editor-status'); return; }
  if (Object.keys(changes).every(key => fingerprint(changes[key]) === fingerprint(baseline[key]))) { message('Nenhuma alteração para salvar.', false, 'editor-status'); return; }
  let committed = false;
  $('save').disabled = true; $('cancel-editor').disabled = true; $('close-editor').disabled = true;
  message('Salvando alterações…', false, 'editor-status');
  try {
    const user = await requireAdmin();
    const f = services.firestoreSdk;
    const productRef = f.doc(services.db, 'produtos_swift', baseline.id);
    const auditRef = f.doc(f.collection(services.db, 'auditoria_catalogo'));
    await f.runTransaction(services.db, async transaction => {
      const snapshot = await transaction.get(productRef);
      if (!snapshot.exists() || fingerprint(snapshot.data()) !== fingerprint(baseline)) throw new Error('CONFLICT');
      const updated = { ...snapshot.data(), ...changes, atualizadoEm: f.serverTimestamp(), atualizadoPor: user.uid, ultimaAlteracaoId: auditRef.id };
      transaction.set(productRef, updated);
      transaction.set(auditRef, { produtoId: baseline.id, autorUid: user.uid, autorEmail: user.email, criadoEm: f.serverTimestamp(), antes: snapshot.data(), depois: updated });
    });
    committed = true;
    let cacheUpdated = false;
    try {
      const response = await fetch('https://epav-product-evaluator.kevinernandes2012.workers.dev/v1/cache/invalidate', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { Authorization: 'Bearer ' + await user.getIdToken() },
      });
      cacheUpdated = response.ok;
    } catch { /* O salvamento permanece válido; o cache expira automaticamente. */ }
    if (generation !== epoch) return;
    // Releitura do servidor mantém timestamps e a detecção de conflitos corretos.
    const updated = await f.getDocFromServer(productRef);
    if (generation !== epoch) return;
    products = products.map(product => product.id === baseline.id ? { ...updated.data(), id: updated.id } : product);
    $('editor').close(); renderProducts(); message(cacheUpdated ? 'Produto atualizado. A alteração foi registrada no histórico e enviada ao jogo.' : 'Produto salvo. O jogo atualizará o catálogo em até 15 minutos.', !cacheUpdated);
  } catch (error) {
    if (generation === epoch) {
      if (committed) { $('editor').close(); message('Alteração salva no banco. Clique em Atualizar dados para conferir a versão atualizada.', true); }
      else message(errorMessage(error), true, 'editor-status');
    }
  }
  finally { $('save').disabled = false; $('cancel-editor').disabled = false; $('close-editor').disabled = false; }
});
$('editor').addEventListener('cancel', event => { if ($('save').disabled) event.preventDefault(); });
$('close-editor').onclick = closeEditor; $('cancel-editor').onclick = closeEditor;
for (const [container, values] of [['type-options', TYPES], ['occasion-options', OCCASIONS]]) {
  for (const value of values) { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.value = value; label.append(input, document.createTextNode(value)); $(container).append(label); }
}
for (const [id, values] of [['type-filter', TYPES], ['occasion-filter', OCCASIONS]]) { for (const value of values) { const option = document.createElement('option'); option.value = value; option.textContent = value; $(id).append(option); } }
for (const id of ['search', 'availability', 'type-filter', 'occasion-filter']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { page = 0; renderProducts(); });
$('prev').onclick = () => { page--; renderProducts(); }; $('next').onclick = () => { page++; renderProducts(); };
$('refresh').onclick = () => load(true, true); $('more').onclick = () => load(false);
document.querySelectorAll('nav button').forEach(button => button.onclick = () => {
  view = button.dataset.view; cursor = null; more = false; records = [];
  document.querySelectorAll('nav button').forEach(item => item.classList.toggle('active', item === button));
  $('view-title').textContent = titles[view]; $('products-view').hidden = view !== 'products'; $('records-view').hidden = ['products', 'emails'].includes(view); $('emails-view').hidden = view !== 'emails';
  if (!['products', 'emails'].includes(view)) renderRecords();
  load(true);
});
$('export').onclick = () => {
  if ($('workspace').hidden || busy) return;
  const list = matching();
  const url = URL.createObjectURL(new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), totalRegistros: list.length, produtos: list }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'epav-produtos-' + new Date().toISOString().slice(0, 10) + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function passwordVisibility(visible) {
  $('password').type = visible ? 'text' : 'password';
  $('toggle-password').setAttribute('aria-pressed', String(visible));
  const label = visible ? 'Ocultar senha' : 'Mostrar senha';
  $('toggle-password').setAttribute('aria-label', label);
  $('toggle-password').title = label;
  $('password-eye-slash').toggleAttribute('hidden', !visible);
}
$('toggle-password').onclick = () => passwordVisibility($('password').type === 'password');
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); $('login-button').disabled = true; message('Conferindo acesso…', false, 'login-status');
  try { await services.authSdk.signInWithEmailAndPassword(services.auth, $('email').value.trim(), $('password').value); }
  catch (error) { message(errorMessage(error), true, 'login-status'); }
  finally { $('password').value = ''; passwordVisibility(false); $('login-button').disabled = false; }
});
$('logout').onclick = async () => { try { await services.authSdk.signOut(services.auth); } catch (error) { message(errorMessage(error), true); } };
async function init() {
  try {
    const config = window.EPAV_FIREBASE_CONFIG;
    if (!config?.apiKey || config.projectId !== 'epav-game') throw new Error('CONFIG');
    const base = 'https://www.gstatic.com/firebasejs/12.18.0';
    const [appSdk, authSdk, firestoreSdk] = await Promise.all([import(base + '/firebase-app.js'), import(base + '/firebase-auth.js'), import(base + '/firebase-firestore.js')]);
    const app = appSdk.initializeApp(config); const auth = authSdk.getAuth(app); auth.languageCode = 'pt';
    await authSdk.setPersistence(auth, authSdk.browserSessionPersistence);
    services = { auth, authSdk, firestoreSdk, db: firestoreSdk.getFirestore(app) };
    authSdk.onAuthStateChanged(auth, async user => {
      epoch++; const generation = epoch; catalogLoadedAt = 0; products = []; records = []; selected = null; page = 0; cursor = null; more = false; busyState(false);
      $('editor').close(); $('workspace').hidden = true; $('access').hidden = false; $('product-rows').replaceChildren(); $('records-rows').replaceChildren(); $('source-fields').replaceChildren(); $('identity').textContent = ''; $('search').value = ''; $('recipient-email').value = ''; message('', false, 'email-status');
      if (!user) { message('Entre com sua conta de administrador.', false, 'login-status'); return; }
      try {
        await requireAdmin(); if (generation !== epoch) return;
        $('identity').textContent = user.email; $('access').hidden = true; $('workspace').hidden = false;
        await load(true);
      } catch (error) { if (generation === epoch) { await authSdk.signOut(auth); message(errorMessage(error), true, 'login-status'); } }
    });
    $('login-button').disabled = false;
  } catch (error) { message(errorMessage(error), true, 'login-status'); }
}
function renderEmailConfig() {
  const ready = !!serviceUrl(window.EPAV_EMAIL_CONFIG);
  $('send-recovery').disabled = !ready;
  message(ready ? 'O envio será feito pelo serviço de recuperação do EPAV.' : 'O serviço de recuperação ainda está sendo configurado.', false, 'email-status');
}
$('send-recovery-form').addEventListener('submit', async event => {
  event.preventDefault(); const generation = epoch; $('send-recovery').disabled = true;
  message('Solicitando a recuperação…', false, 'email-status');
  try {
    const user = await requireAdmin();
    const token = await services.authSdk.getIdToken(user, true);
    const result = await requestRecovery({ config: window.EPAV_EMAIL_CONFIG, email: $('recipient-email').value.trim(), token });
    if (generation === epoch) message(result, false, 'email-status');
  } catch (error) { if (generation === epoch) message(error.message === 'NO_ADMIN' ? errorMessage(error) : recoveryError(error), true, 'email-status'); }
  finally { if (generation === epoch) $('send-recovery').disabled = !serviceUrl(window.EPAV_EMAIL_CONFIG); }
});
let challengeToken = '', challengeWidget, challengeLoad;
const emailConfig = window.EPAV_EMAIL_CONFIG;
$('forgot-open').hidden = !serviceUrl(emailConfig) || !emailConfig?.turnstileSiteKey;
$('forgot-open').onclick = async () => {
  $('forgot-email').value = $('email').value; $('forgot-dialog').showModal();
  message('Conclua a verificação para solicitar a recuperação.', false, 'forgot-status');
  if (challengeWidget !== undefined) { window.turnstile.reset(challengeWidget); challengeToken = ''; $('forgot-send').disabled = true; return; }
  try {
    if (!challengeLoad) challengeLoad = new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.onload = resolve; script.onerror = reject; document.head.append(script); });
    await challengeLoad;
    challengeWidget = window.turnstile.render('#recovery-challenge', { sitekey: emailConfig.turnstileSiteKey, action: 'password-reset', callback: token => { challengeToken = token; $('forgot-send').disabled = false; }, 'expired-callback': () => { challengeToken = ''; $('forgot-send').disabled = true; }, 'error-callback': () => { challengeToken = ''; $('forgot-send').disabled = true; message('Não foi possível carregar a verificação. Feche e tente novamente.', true, 'forgot-status'); } });
  } catch { challengeLoad = null; message('Não foi possível carregar a verificação. Confira a conexão e tente novamente.', true, 'forgot-status'); }
};
$('forgot-close').onclick = () => $('forgot-dialog').close();
$('forgot-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!challengeToken) return;
  $('forgot-send').disabled = true; message('Solicitando a recuperação…', false, 'forgot-status');
  try { message(await requestRecovery({ config: emailConfig, email: $('forgot-email').value.trim(), challenge: challengeToken }), false, 'forgot-status'); }
  catch (error) { message(recoveryError(error), true, 'forgot-status'); }
  finally { challengeToken = ''; if (challengeWidget !== undefined) window.turnstile.reset(challengeWidget); }
});
init();
