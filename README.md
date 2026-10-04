# EPAV Admin

Painel administrativo independente do jogo, conectado ao Firebase **epav-game**.

O painel usa a identidade visual da Missão EPAV: logo e cenário originais, fontes Nunito e Press Start 2P, cores do jogo, painéis com bordas escuras e botões com sombras em blocos. Os arquivos necessários ficam em `assets/images` e são incluídos na publicação do Pages.

## Acesso

Site: https://epav-game.github.io/epav-admin/

Entre com uma conta do Firebase Authentication que tenha a custom claim `admin: true`. A conta administradora já provisionada no projeto pode ser usada aqui. A sessão é mantida somente nesta aba. Contas comuns não acessam o catálogo, as importações nem o histórico, mesmo por chamadas diretas ao Firestore.

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

### Ativação pendente do envio manual

Por decisão do responsável em 04/10/2026, a publicação das regras de fotos no Firebase foi deixada para depois. O dashboard está disponível; o envio manual permanece **desativado** por padrão (`MANUAL_PHOTOS_ENABLED` ausente ou diferente de `true`). O editor informa essa pendência.

As novas regras estão preparadas e sincronizadas com `epav-game/firestore.rules`, sem publicação em produção. Antes de ativar: obter autorização para publicar as regras compartilhadas, testar, fazer o deploy das regras, definir a repository variable `MANUAL_PHOTOS_ENABLED=true` no GitHub e republicar o painel. Não ativar essa variável antes do deploy das regras.

Com Firestore Emulator em `127.0.0.1:8590`, projeto `demo-epav-photo` e este `firestore.rules`, executar `node tests/firestore-image-rules.mjs`. Os 11 casos verificam a foto administrativa com auditoria, as edições anteriores e recusas esperadas; o teste não pode acessar produção. No Java 21 deste Windows, usar `-Djdk.net.unixdomain.tmpdir=./test-results/no-unix-sockets` com esse caminho inexistente permite o fallback TCP para contornar a falha dos sockets Unix.

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

Esses valores identificam o app Web e são públicos no navegador. Senhas, tokens e chaves privadas de conta de serviço nunca são usados no build ou incluídos no repositório. Os dados do catálogo ficam no Firestore e só são carregados depois da autenticação administrativa. Nenhum Excel ou JSON de produtos é publicado com o site.

## Regras do banco compartilhado

`firestore.rules` inclui a política de ranking já utilizada pelo jogo e as permissões do catálogo administrativo. As regras foram publicadas no Firebase durante a configuração inicial. O workflow de Pages publica somente o site; mudanças nas regras exigem deploy separado por uma conta autorizada:

```sh
firebase deploy --only firestore --project epav-game
```

As regras impedem edições sem histórico, categorias inválidas, alteração de preços/margens e exclusão de registros pelo cliente. `auditoria_catalogo` não permite alterar ou excluir históricos. `importacoes_catalogo` é somente leitura no painel. Atribua a claim de administrador apenas por uma ferramenta confiável com Firebase Admin SDK.

Os repositórios `epav-game` e `epav-admin` usam o mesmo banco. Mantenha as cópias das regras sincronizadas antes de qualquer deploy do Firestore. Um deploy substitui a política completa do banco.

## Cache e atualização do jogo

O catálogo já carregado é reutilizado na memória da sessão por até cinco minutos ao trocar de seção. **Atualizar dados** sempre busca o servidor. Sair ou trocar de conta limpa essa memória. As edições continuam conferindo a versão atual no Firebase e registrando auditoria por transação.

Depois de salvar um produto, o painel chama `/v1/cache/invalidate` na API do jogo com o token Firebase do administrador. A API confirma a claim `admin` novamente e invalida o Redis compartilhado em até cinco segundos. Se a chamada falhar, o painel informa que os dados foram salvos e a atualização no jogo ocorre pela expiração do cache, em até 15 minutos. Nenhuma credencial Redis é enviada ao navegador.
