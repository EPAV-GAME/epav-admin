# EPAV Admin

Painel administrativo independente do jogo, conectado ao Firebase **epav-game**.

## Acesso

Site: https://epav-game.github.io/epav-admin/

Entre com uma conta do Firebase Authentication que tenha a custom claim `admin: true`. A conta administradora já provisionada no projeto pode ser usada aqui. A sessão é mantida somente nesta aba. Contas comuns não acessam o catálogo, as importações nem o histórico, mesmo por chamadas diretas ao Firestore.

## Recursos

- Consulta de todos os registros de `produtos_swift`, sem juntar códigos repetidos.
- Busca por nome, código, marca e família; filtros de disponibilidade, tipo e ocasião.
- Paginação visual de 50 registros. O catálogo completo é consultado em lotes de até 300; filtros e contagens abrangem todos os registros após a carga terminar.
- Edição de nome, disponibilidade, seis tipos de produto e oito ocasiões.
- Sincronização das classificações com os campos correspondentes da planilha.
- Consulta dos 36 campos de origem. Preços, margens, código, unidade, status de origem e vínculo à importação são preservados.
- Exportação JSON dos produtos correspondentes aos filtros atuais.
- Consulta de importações, histórico e resultados do jogo em lotes de 100.
- Histórico obrigatório com autor, data, valores anteriores e novos. Cada edição e seu histórico são gravados na mesma transação.
- Detecção de edição concorrente: se o produto mudou desde a abertura, atualize os dados antes de editar novamente.

Disponibilidade no jogo pode ser ajustada independentemente do status comercial de origem. O campo `Status Produto` conserva o valor recebido da planilha.

Esta versão gerencia os registros existentes. Novas importações, criação/exclusão de produtos, alterações de dados comerciais e concessão de permissões administrativas continuam sendo operações do responsável pelo banco. O painel não muda as pontuações dos jogadores. O jogo ainda precisa de integração específica para consumir o catálogo editado.

## Executar localmente

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
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

Esses valores identificam o app Web e são públicos no navegador. Senhas, tokens e chaves privadas de conta de serviço nunca são usados no build ou incluídos no repositório. Os dados do catálogo ficam no Firestore e só são carregados depois da autenticação administrativa. Nenhum Excel ou JSON de produtos é publicado com o site.

## Regras do banco compartilhado

`firestore.rules` inclui a política de ranking já utilizada pelo jogo e as permissões do catálogo administrativo. As regras foram publicadas no Firebase durante a configuração inicial. O workflow de Pages publica somente o site; mudanças nas regras exigem deploy separado por uma conta autorizada:

```sh
firebase deploy --only firestore --project epav-game
```

As regras impedem edições sem histórico, categorias inválidas, alteração de preços/margens e exclusão de registros pelo cliente. `auditoria_catalogo` não permite alterar ou excluir históricos. `importacoes_catalogo` é somente leitura no painel. Atribua a claim de administrador apenas por uma ferramenta confiável com Firebase Admin SDK.

Os repositórios `epav-game` e `epav-admin` usam o mesmo banco. Mantenha as cópias das regras sincronizadas antes de qualquer deploy do Firestore. Um deploy substitui a política completa do banco.
