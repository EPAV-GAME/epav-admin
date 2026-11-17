# EPAV Admin

Painel administrativo independente do jogo, com dados no PostgreSQL Neon e login no Firebase **epav-game**.

O painel usa a identidade visual da Missão EPAV: logo e cenário originais, fontes Nunito e Press Start 2P, cores do jogo, painéis com bordas escuras e botões com sombras em blocos. Os arquivos necessários ficam em `assets/images` e são incluídos na publicação do Pages.

## Acesso

Site: https://epav-game.github.io/epav-admin/

Entre com uma conta do Firebase Authentication que tenha a custom claim `admin: true`. A conta administradora já provisionada no projeto pode ser usada aqui. A sessão é mantida somente nesta aba. Contas comuns não acessam o catálogo nem o histórico, mesmo por chamadas diretas à API.

## Recursos

- Formulário administrativo de recuperação e página de nova senha. O serviço de envio está no repositório independente [EPAV-GAME/epav-password-reset](https://github.com/EPAV-GAME/epav-password-reset), preparado para Cloudflare.

- Consulta de todos os registros de `produtos_swift`, sem juntar códigos repetidos.
- Busca por nome, código, marca e família; filtros de disponibilidade, tipo e ocasião.
- Paginação visual de 50 registros. O catálogo completo é consultado em lotes de até 300; filtros e contagens abrangem todos os registros após a carga terminar.
- Edição de nome, disponibilidade, seis tipos de produto e oito ocasiões.
- Dashboard de imagens do Cloudflare: arquivos WebP únicos, espaço ocupado, tamanho médio e maior arquivo. Consulta paginada do bucket, com medição reutilizada por até 60 segundos e autenticação administrativa atual em cada acesso. Inclui fotos de versões anteriores.
- Envio/troca manual de foto preparado no editor, com prévia e redução para WebP 512 × 512, até 100 KB. Aceita JPEG, PNG e WebP de até 10 MB e preserva as proporções com fundo branco. O Worker verifica dimensões, tamanho e hash. A associação ao produto e a auditoria usam a mesma transação. O bot preserva `imagemSwift.manual=true`.
- Sincronização das classificações com os campos correspondentes da planilha.
- Consulta dos 36 campos de origem. Preços, margens, código, unidade, status de origem e vínculo à importação são preservados.
- Exportação JSON dos produtos correspondentes aos filtros atuais.
- Consulta de importações, histórico e resultados do jogo em lotes de 100.
- Histórico obrigatório com autor, data, valores anteriores e novos. Cada edição e seu histórico são gravados na mesma transação.
- Detecção de edição concorrente: se o produto mudou desde a abertura, atualize os dados antes de editar novamente.

Disponibilidade no jogo pode ser ajustada independentemente do status comercial de origem. O campo `Status Produto` conserva o valor recebido da planilha.

Esta versão gerencia os registros existentes. Novas importações, criação/exclusão de produtos, alterações de dados comerciais e concessão de permissões administrativas continuam sendo operações do responsável pelo banco. O painel não muda as pontuações dos jogadores. O jogo consome o catálogo pela API `epav-product-evaluator`.

## Executar localmente

### Fotos e permissões

A edição usa a API PostgreSQL, com permissão administrativa verificada em cada operação. As fotos permanecem no Cloudflare R2. `MANUAL_PHOTOS_ENABLED` conserva a configuração escolhida anteriormente; a migração não ativa o envio manual por conta própria. O backend valida foto WebP 512 × 512, até 100 KB, URL do bucket e histórico obrigatório.

### Servir o painel

Requer Node.js 24 e um servidor HTTP.

1. Copie `.env.example` para `.env` e preencha a configuração pública do app Web Firebase.
2. Rode `npm run build`.
3. Sirva esta pasta: por exemplo, `python -m http.server 8000`.
4. Abra `http://localhost:8000`. `localhost` deve estar autorizado no Firebase Authentication.

Verificações: `npm test`.

## Publicação

O workflow `.github/workflows/deploy-pages.yml` testa e publica no GitHub Pages ao enviar commits à `main`.

Repository secrets usados no build:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

Repository variable: `FIREBASE_PROJECT_ID=epav-game`. Esse identificador público fica em uma variável para que o GitHub não oculte o endereço do Pages por conter o nome do projeto. Após a publicação, o resumo da execução e o ambiente `github-pages` mostram o link para abrir o painel.

Esses valores identificam o app Web e são públicos no navegador. Senhas, tokens e chaves privadas de conta de serviço nunca são usados no build ou incluídos no repositório. Os dados do catálogo ficam no PostgreSQL Neon e só são carregados depois da autenticação administrativa. Nenhum Excel ou JSON de produtos é publicado com o site.

## Regras do banco compartilhado

A API `epav-product-evaluator` centraliza leitura, edição com revisão e histórico obrigatório. O navegador não recebe a conexão do Postgres nem usa o SDK Firestore. `firestore.rules` bloqueia todos os acessos de clientes ao Firestore, cujos registros antigos foram excluídos após a migração. Firebase Authentication e a custom claim `admin` permanecem ativos.

## Cache e atualização do jogo

O catálogo já carregado é reutilizado na memória da sessão por até cinco minutos ao trocar de seção. **Atualizar dados** sempre busca o servidor. Sair ou trocar de conta limpa essa memória. As edições continuam conferindo a versão atual no Firebase e registrando auditoria por transação.

Depois de salvar um produto, o painel chama `/v1/cache/invalidate` na API do jogo com o token Firebase do administrador. A API confirma a claim `admin` novamente e invalida o Redis compartilhado em até cinco segundos. Se a chamada falhar, o painel informa que os dados foram salvos e a atualização no jogo ocorre pela expiração do cache, em até 15 minutos. Nenhuma credencial Redis é enviada ao navegador.

A aba de importações da carga antiga foi removida. Produtos e fichas usam os dados atuais no PostgreSQL, sem referências ao identificador de importação ou à linha da planilha.
