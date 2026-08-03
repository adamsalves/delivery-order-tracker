# Delivery Order Tracker

Sistema simplificado de rastreamento de pedidos de delivery: uma API REST
autenticada por JWT e um front React que consome ela.

Um pedido tem cliente, endereço de entrega e itens. Ele nasce em `RECEBIDO` e
caminha por uma máquina de estados até `ENTREGUE` ou `CANCELADO`, e cada passo
desse caminho fica registrado num histórico com autor e horário.

- **API** — Java 21, Spring Boot 4.1.0, Spring Security (resource server com
  HS256), Spring Data JPA, Bean Validation, springdoc-openapi, SQLite.
- **Web** — Vite, React 19, TypeScript, react-router, Tailwind CSS 4 e shadcn/ui.

## Pré-requisitos

| Ferramenta | Versão | Como conferir |
| --- | --- | --- |
| JDK | 21 | `java -version` |
| Node.js | 24 (fixado em `web/.nvmrc`) | `node --version` |
| openssl | qualquer | `openssl version` |

Maven **não** precisa estar instalado: o projeto traz o wrapper (`api/mvnw`).
SQLite também não — o driver `org.xerial:sqlite-jdbc` é uma dependência Java e
carrega a engine junto.

## Subindo a aplicação

São dois processos, em dois terminais. A ordem entre eles não importa, mas as
portas importam: a API só aceita chamadas do navegador vindas de
`http://localhost:5173`, e o Vite está com `strictPort`, então nenhum dos dois
lados se muda de porta sozinho.

### 1. API — `http://localhost:8080`

```bash
cd api
cp .env.example .env
```

Gere um segredo e escreva ele no `.env`, na linha `JWT_SECRET=`:

```bash
openssl rand -base64 48
```

O `.env` é git-ignored e lido no boot. **HS256 exige pelo menos 32 bytes**, e a
aplicação se recusa a subir com o segredo vazio ou curto demais — é uma falha
explícita no start, não um 500 na primeira chamada.

```bash
./mvnw spring-boot:run
```

Na primeira execução o Hibernate cria o schema (`ddl-auto=update`) num arquivo
SQLite em `api/data/app.db`. Não é preciso criar o diretório `data/` na mão: a
aplicação cria ele antes de abrir a primeira conexão, porque o driver do SQLite
não conecta se o diretório do arquivo não existir.

Para começar do zero em qualquer momento, pare a API e apague o arquivo — ainda
de dentro de `api/`:

```bash
rm -rf data
```

### 2. Web — `http://localhost:5173`

Em outro terminal, a partir da raiz do repositório:

```bash
cd web
nvm use          # opcional; lê a versão do .nvmrc
cp .env.example .env
npm install
npm run dev
```

O `.env` já vem apontando para `VITE_API_URL=http://localhost:8080`, que é onde
a API sobe. Só precisa mexer nisso se você mudou a porta dela.

Abra `http://localhost:5173`.

### 3. Primeiro uso

1. A raiz redireciona para `/login`. Clique em **Cadastre-se**.
2. Cadastre-se com nome, e-mail e uma senha entre **8 caracteres** e **72
   bytes** — o teto é do BCrypt, e conta bytes, então um acento pesa dois.
3. Faça login. Você cai na listagem de pedidos, vazia.
4. **Novo pedido** — preencha cliente, endereço e ao menos um item (nome,
   quantidade e preço unitário). O pedido nasce em `RECEBIDO`.
5. Clique no pedido na listagem para abrir o detalhe: itens, total, timeline do
   histórico e os botões das transições que o status atual permite.
6. De volta à listagem, **Ordenar por** troca a ordem e **Carregar mais** traz a
   página seguinte, quando houver.

O token fica no `localStorage` e vale 24h. **Sair** revoga ele no servidor — não
é só um logout de cliente, o token deixa de ser aceito na hora.

## Documentação da API

Com a API no ar:

- Swagger UI — <http://localhost:8080/swagger-ui.html>
- OpenAPI JSON — <http://localhost:8080/v3/api-docs>

As duas rotas são públicas de propósito: a página que explica como obter um
token não pode exigir um. Use o botão **Authorize** para colar o token e testar
os endpoints protegidos direto dali.

### Endpoints

| Método | Rota | Token | Resposta |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | — | `201` com id, nome e e-mail |
| `POST` | `/api/auth/login` | — | `200` com `token` e `expiresIn` (segundos) |
| `POST` | `/api/auth/logout` | sim | `204`, revogando o token da própria chamada |
| `POST` | `/api/orders` | sim | `201` com o pedido, seus itens e o histórico |
| `GET` | `/api/orders` | sim | `200` com a página de pedidos |
| `GET` | `/api/orders/{id}` | sim | `200` com o pedido, seus itens e o histórico |
| `PATCH` | `/api/orders/{id}/status` | sim | `200` com o pedido já no novo status |

Fora as duas rotas de documentação acima, qualquer outra exige
`Authorization: Bearer <token>`.

### Um passeio completo via curl

```bash
# 1. Cadastro
curl -sS -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","password":"segredo123"}'

# 2. Login, guardando o token
TOKEN=$(curl -sS -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"segredo123"}' \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 3. Criar um pedido
curl -sS -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
        "customerName": "Ada Lovelace",
        "deliveryAddress": "Rua das Flores, 42",
        "items": [
          {"name": "Pizza margherita", "quantity": 1, "unitPrice": "45.90"},
          {"name": "Refrigerante 2L",  "quantity": 2, "unitPrice": "12.00"}
        ]
      }'

# 4. Listar (primeira página)
curl -sS -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8080/api/orders?page=0&size=20&sort=createdAt,desc'

# 5. Avançar o status do pedido 1
curl -sS -X PATCH http://localhost:8080/api/orders/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"EM_PREPARO"}'

# 6. Ler o detalhe, com itens e timeline
curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/orders/1

# 7. Sair, revogando o token
curl -sS -i -X POST http://localhost:8080/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

O `unitPrice` vai como **string** no JSON. A API aceita as duas formas e lê
qualquer uma delas exatamente como veio — o Jackson liga o literal em
`BigDecimal` pelo texto, sem passar por um double. Quem perde a escala é o
cliente: um número em JavaScript **é** um double, e `JSON.stringify(45.90)`
emite `45.9` antes de o JSON existir. Por isso o front guarda o preço em
centavos inteiros e remonta o literal decimal na hora de enviar.

### Status e transições

Os cinco valores são literais e em português, por exigência do enunciado:

| De | Para |
| --- | --- |
| `RECEBIDO` | `EM_PREPARO`, `CANCELADO` |
| `EM_PREPARO` | `SAIU_PARA_ENTREGA`, `CANCELADO` |
| `SAIU_PARA_ENTREGA` | `ENTREGUE`, `CANCELADO` |
| `ENTREGUE` | — terminal |
| `CANCELADO` | — terminal |

Nenhum status se lista a si mesmo, então repetir o status atual é recusado pela
mesma tabela que recusa pular etapa. Uma transição ilegal devolve **409**
nomeando o status em que o pedido está e as saídas que continuam abertas.

Cada transição grava uma linha no histórico com origem, destino, horário e o
e-mail de quem fez, lido do claim do token. A criação do pedido grava a primeira
linha, com origem nula, para a timeline não nascer vazia.

### Paginação e ordenação

A listagem é paginada. Sem parâmetros, ela devolve 20 pedidos ordenados por
`createdAt` decrescente, com `id` desempatando.

| Parâmetro | Padrão | Observação |
| --- | --- | --- |
| `page` | `0` | base zero |
| `size` | `20` | teto de `100` |
| `sort` | `createdAt,desc` e `id,desc` | `propriedade,asc\|desc` |

Ordenar só é aceito nas propriedades escalares que a listagem expõe: `id`,
`customerName`, `deliveryAddress`, `status` e `createdAt`. Qualquer outra coisa
devolve **400** dizendo quais são as aceitas.

Um `sort` seu substitui o padrão por inteiro, **inclusive o `id` que desempata**.
Sem repetir esse desempate, dois pedidos com o mesmo valor podem trocar de lugar
entre requests e aparecer em duas páginas ou em nenhuma — então mande os dois,
como o front faz:

```
?sort=customerName,asc&sort=id,asc
```

O corpo é um `PagedModel`, com o conteúdo em `content` e os metadados em `page`:

```json
{
  "content": [
    {
      "id": 1,
      "customerName": "Ada Lovelace",
      "deliveryAddress": "Rua das Flores, 42",
      "status": "RECEBIDO",
      "createdAt": "2026-08-02T18:24:11.482Z"
    }
  ],
  "page": { "size": 20, "number": 0, "totalElements": 1, "totalPages": 1 }
}
```

A listagem não carrega itens nem histórico — só o detalhe leva as duas coleções.

### Limites de entrada

Todo campo de texto para na largura da coluna que o guarda, e a lista de itens
tem chão e teto. O que passar disso volta **400** com o campo nomeado em
`errors`, e nada é gravado.

| Campo | Limite |
| --- | --- |
| `name`, `email` (cadastro) | 255 caracteres |
| `password` | de 8 caracteres a 72 bytes |
| `customerName`, `deliveryAddress` | 255 caracteres |
| `items` | de 1 a 100 itens |
| `items[].name` | 255 caracteres |
| `items[].quantity` | inteiro positivo |
| `items[].unitPrice` | positivo, até 10 inteiros e 2 decimais |

O 255 não é um número escolhido: é a largura que um `@Column` sem `length`
declara. O SQLite não a aplica, então até aqui um nome de 5000 caracteres era
aceito e gravado — as anotações são o que de fato o recusa.

O teto da senha é do BCrypt e conta **bytes**, então um acento pesa dois: 72
caracteres acentuados são 144 bytes e não passam. Esse é o único limite checado
fora de uma anotação — `@Size` conta caracteres, e quem responde pelo que o
encoder aceita é o `AuthService`. Onde ele é checado não muda como ele é
respondido: a recusa sai nomeando `password` em `errors`, como todas as outras.

O front repete os mesmos limites antes de enviar — inclusive o de 100 itens, que
para de oferecer a adição de linhas quando chega lá, dizendo por quê.

### Erros

Toda falha sai como `ProblemDetail` (RFC 9457), inclusive as recusadas na cadeia
de filtros antes de chegar no controller:

```json
{
  "title": "Conflict",
  "status": 409,
  "detail": "Cannot change status from RECEBIDO to ENTREGUE, the transitions allowed from RECEBIDO are [EM_PREPARO, CANCELADO]",
  "instance": "/api/orders/1/status"
}
```

O `type` não aparece porque o padrão `about:blank` é omitido na serialização; o
pedido é identificado pelo `instance`.

Falhas de validação trazem um campo `errors` a mais, com uma entrada por campo e
uma lista por campo, porque um mesmo campo pode quebrar mais de uma regra:

```json
{
  "title": "Bad Request",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/api/orders",
  "errors": {
    "customerName": ["must not be blank"],
    "items": ["must not be empty"]
  }
}
```

| Status | Quando |
| --- | --- |
| `400` | corpo inválido, JSON ilegível, status inexistente, ordenação não suportada, campo fora dos [limites](#limites-de-entrada) |
| `401` | token ausente, expirado ou revogado; e-mail ou senha errados no login |
| `404` | pedido inexistente |
| `409` | transição de status ilegal; e-mail já cadastrado |

O corpo do `401` não diz se o token faltou, expirou ou foi revogado. Isso é papel
do header `WWW-Authenticate`; distinguir no corpo ajudaria a separar tokens
válidos de inválidos.

Toda resposta — inclusive as recusadas antes de chegar na aplicação — volta com
um header `X-Request-Id`. É o mesmo identificador que aparece entre colchetes na
linha de log daquela requisição, então um erro relatado por quem chamou pode ser
encontrado no console pelo valor que ele tem em mãos. Vale também para o `401`
recusado na cadeia de filtros, que deixa linha própria. O header é exposto por
nome no CORS: sem isso ele chega ao browser e o JavaScript da página lê `null`,
porque um navegador só entrega a código de outra origem os headers que a resposta
autoriza.

As mensagens saem sempre em inglês, inclusive as do Bean Validation, que são a
metade da resposta que não escrevemos. O Hibernate Validator traz um bundle por
locale e resolve pelo `Accept-Language`, então um `curl` de navegador brasileiro
recebia `"não deve estar em branco"` ao lado de um `detail` em inglês. O locale
é fixo (`spring.web.locale`), e a resposta não muda de idioma conforme quem
pergunta.

## Testes

São três suítes, em três camadas: a da API, a do front em jsdom, e a de
navegador, que é a única que roda os dois lados juntos.

```bash
cd api
./mvnw test
```

Os testes não precisam do `.env`: eles usam um segredo fixo e bancos próprios em
`api/target/test-data/`, recriados a cada execução (`ddl-auto=create-drop`). Cada
classe que escreve aponta para um arquivo só seu, para que uma não veja as linhas
da outra. O banco de desenvolvimento em `api/data/` não é tocado.

A listagem tem cobertura de paginação e ordenação — tamanho de página, teto,
direção, página além do fim e as propriedades que ela recusa ordenar. O CORS e o
round-trip de criação de pedido também estão cobertos.

Os logs têm suíte própria, e a maior parte dela é sobre o que não pode aparecer:
que a recusa de login não nomeia o endereço tentado, que as duas maneiras de
falhar produzem a mesma linha, que uma senha rejeitada pela validação não vai
parar no console e que um token recusado não vai junto com a linha que o recusa.
O que essas asserções leem inclui o stack trace, e não só a mensagem — é por ali
que um valor que ninguém escreveu chegaria ao arquivo.

Um caso lê o console de verdade, e não a mensagem em memória: a chave do MDC, o
nome da propriedade e o padrão do Boot precisam concordar entre si, nenhum dos
três é conferido pelo compilador, e trocar a chave por outra deixava a suíte
inteira verde imprimindo colchetes vazios.

No front:

```bash
cd web
npm test           # vitest run
npm run test:watch # vitest em modo watch
```

A suíte roda em jsdom e não precisa da API no ar. Cobre a leitura de preço
em centavos inteiros, a tabela de ordenação conferida contra as
propriedades que a API aceita, a máquina de transições conferida contra o
enum do servidor, a cadeia de precedência das mensagens de erro, e o
comportamento temporal da listagem — trocar a ordem com uma página ainda a
caminho, e o que acontece com ela quando chega.

O que ela não alcança está na suíte de navegador, mais abaixo: em jsdom o
`fetch` é dublado, não existe segunda aba e não existe CSP.

### Fixtures do teste de contrato

`web/src/api/parse.ts` é escrito à mão e existe para pegar divergência
entre os dois lados. Quem confere ele são respostas **gravadas de uma API
de verdade**, em `web/src/api/__fixtures__/` — um corpo inventado no teste
concordaria com o parser por construção.

Os arquivos estão commitados e o teste roda offline. Para regravar, depois
de mudar o contrato, suba a API apontando para um banco e um segredo
descartáveis — nunca para os de desenvolvimento:

```bash
cd api
SPRING_DATASOURCE_URL=jdbc:sqlite:./data/fixtures.db \
JWT_SECRET=$(openssl rand -base64 48) ./mvnw spring-boot:run
```

```bash
cd web && node scripts/record-fixtures.ts
```

O token gravado é substituído por um placeholder: o que o teste precisa
dele é que seja um campo `token` de texto, e um JWT assinado dentro do
repositório parece credencial para qualquer scanner que passe por ali.

### Suíte de navegador (Playwright)

Esta é a única camada que exercita os dois processos juntos. Ela **sobe os
dois sozinha** — não precisa de nada no ar, e não atrapalha o que já estiver.

Uma vez, para baixar o navegador:

```bash
cd web
npx playwright install chromium
```

Depois, quantas vezes quiser:

```bash
npm run test:e2e      # playwright test
npm run test:e2e:ui   # o modo interativo, para depurar um caso
```

Ela usa portas próprias, `8081` para a API e `4173` para o front, com um banco
em `api/data/e2e.db` que é apagado e refeito a cada execução e um segredo
sorteado na hora. Ou seja: o `.env` e o `api/data/app.db` de desenvolvimento não
são tocados, e você pode deixar `npm run dev` rodando em 5173 enquanto isso.

O navegador dirige o **bundle do `vite preview`**, e não o dev server. A CSP é
injetada só no build, então uma suíte apontada para o dev server estaria
conferindo uma página que nunca é a publicada.

O que ela cobre:

| Arquivo | O que verifica |
| --- | --- |
| `fresh-database.setup.ts` | a listagem vazia, e que o banco começou limpo |
| `order-lifecycle.spec.ts` | cadastro, criação de pedido, `RECEBIDO` até `ENTREGUE`, timeline e total |
| `stale-transition.spec.ts` | duas abas no mesmo pedido, o 409 e a recuperação da tela |
| `session.spec.ts` | logout revogando o token no servidor, e a sessão caindo em toda aba |
| `sorting.spec.ts` | o controle de ordenação sob a CSP do build, e a ordem vinda da API |

## Formatação

Antes de commitar, rode o formatador do lado que você mexeu:

```bash
cd api && ./mvnw spotless:apply   # palantir-java-format
cd web && npm run format          # prettier
```

O front também tem `npm run lint` (oxlint) e `npm run build`, que roda o
`tsc -b` antes do bundle.

## Decisões

Coisas que foram escolhidas, e não herdadas de um padrão:

**Logout revoga o token de verdade.** Um JWT é stateless: encerrar a sessão só no
cliente deixaria o token válido até expirar. Então o token carrega um `jti`, o
logout grava esse identificador numa tabela de revogados, e um
`OAuth2TokenValidator` composto com os validadores padrão consulta ela a cada
request. As entradas expiradas são apagadas no próprio logout, sem job agendado.
O preço é deliberado: a API deixa de ser 100% stateless e paga um lookup por
request autenticado.

**O log não diz quem errou a senha.** Os pedidos sempre tiveram trilha de
auditoria (`OrderStatusHistory`); as sessões não tinham nenhuma. Agora login,
logout e cadastro deixam linha. O identificador que login e logout carregam é o
`jti` do token — o mesmo que o logout revoga —, e o do cadastro é o id do
usuário, porque naquele ponto ainda não há token. Nunca o e-mail, nunca o token.
Uma senha errada e um e-mail que não existe produzem a mesma linha, palavra por
palavra: o `decoyHash` já faz as duas demorarem igual para que o tempo de
resposta não entregue quais contas existem, e um log nomeando o endereço
devolveria pelos arquivos aquilo que a resposta esconde. Sobra a taxa de
recusas, que é a parte que vale olhar. Pela mesma razão as recusas registram o
nome da exceção e não a mensagem dela: a de validação traz de volta os valores
rejeitados, e em `/api/auth` um deles é a senha.

O endereço de quem chamou também fica de fora, e essa é uma escolha e não o
padrão que sobrou: é dado pessoal, e um log guardado para contar recusas passaria
a carregá-lo pelo tempo em que for guardado. O preço é que a taxa é global — dá
para ver que houve cinquenta recusas num minuto, não que foram de um só lugar.

A regra da mensagem tem uma exceção, e é o `5xx`. Ali a exceção não é o pedido de
quem chamou voltando, e sim falta nossa: o framework a levanta quando não
consegue escrever a resposta ou vincular uma variável que o código declarou.
Essas saem em `ERROR` e com o stack trace, porque uma frase nomeando a classe é o
registro menos útil justamente do status que mais precisa de um.

**Toda transação começa `IMMEDIATE`.** O SQLite recusa promover a transação que
já leu em transação que escreve, e recusa sem esperar o `busy_timeout` — então
qualquer read-modify-write (a troca de status é um) devolvia 500 com dois
clientes simultâneos. Tomar o lock na abertura transforma disputa em espera. Os
parâmetros vão como propriedades do driver, e não na URL, porque cada classe de
teste sobrescreve a URL e perderia o que estivesse escrito nela.

**As colunas são criadas na ordem em que estão declaradas.** O Hibernate reordena
as colunas ao criar uma tabela, e nesse caminho uma coluna de identidade sai sem
tipo nenhum: `id` em vez de `id integer`. O SQLite só preenche sozinho a chave
primária que ele tipou como INTEGER, e deixa passar `NULL` na que não tipou — o
item era gravado sem id, e o Hibernate, lendo o pedido de volta pelo join, via um
identificador nulo e o tomava por linha ausente. O pedido voltava sem itens. O
`ddl-auto=update` nunca reordenou, então só um schema criado do zero era
afetado: toda execução de teste. `column_ordering_strategy=legacy` faz os dois
caminhos produzirem a mesma tabela.

**A listagem é paginada desde o começo.** Devolver a tabela inteira numa resposta
só não escala, e sem `ORDER BY` a ordem das linhas fica a critério do banco. A
resposta é um `PagedModel` e não um `Page<T>` direto, cuja serialização o Spring
avisa não ser contrato estável.

**A listagem não carrega itens nem histórico.** Tocar as associações lazy dentro
de um laço sobre a página dispararia uma query por pedido. E o histórico não é
mapeado como coleção em `Order`: os itens já são um bag, e um segundo bag no
mesmo entity graph quebra com `MultipleBagFetchException`.

**Os services não conhecem HTTP.** Eles levantam exceções de domínio, e um único
`@RestControllerAdvice` traduz cada uma para o status certo. A exceção inevitável
são o 401 e o 403, recusados na cadeia de filtros antes do `DispatcherServlet`,
onde o advice não alcança: lá um `AuthenticationEntryPoint`/`AccessDeniedHandler`
próprio escreve o mesmo `ProblemDetail`, delegando antes aos handlers de origem
para preservar o header `WWW-Authenticate`.

**Dinheiro é contado em centavos no front.** Somar preços como float acumula erro,
e o `Intl` esconde isso até a lista ficar longa o bastante para não esconder mais.
As duas telas que mostram total contam da mesma forma.

**O token fica no `localStorage`, e a resposta ao XSS é uma CSP.** É exposição a
XSS em troca de sobreviver a um refresh da página. A alternativa seria um cookie
`httpOnly`, e ela resolve menos do que parece: um cookie `httpOnly` impede a
**exfiltração**, não o XSS. Quem roda JavaScript na origem não precisa ler o
cookie — o navegador anexa ele em toda requisição que essa pessoa fizer, e a
sessão é usada no lugar. A diferença real é o alcance: `localStorage` permite
"roubar o token e usar de qualquer lugar por 24h", `httpOnly` reduz para "abusar
da sessão enquanto a página estiver aberta". É ganho verdadeiro, mas parcial — e
aqui o primeiro caso já é encurtado por algo que a maioria dos projetos com JWT
não faz: **o logout revoga o token no servidor**. A troca ainda traria CSRF de
volta como superfície nova para acertar.

O que faltava mesmo era CSP, e agora existe: `default-src 'self'`, `script-src
'self'`, `connect-src` nomeando a API. Ela é gerada no build (`vite.config.ts`),
porque uma das diretivas depende de `VITE_API_URL`. `style-src` carrega
`'unsafe-inline'` por necessidade medida, não por padrão: o Radix escreve
atributos `style` para posicionar o popover, e com `style-src 'self'` o Chromium
bloqueia e o controle de ordenação para de abrir. `frame-ancestors` ficou de
fora de propósito — o navegador ignora ela quando vem em `<meta>`, e diretiva que
não faz nada em silêncio é pior que diretiva ausente. Proteção contra
clickjacking precisa vir de header, onde quer que isso seja hospedado.

**O E2E dirige o build, e não o dev server.** A CSP acima é injetada por um
plugin que só roda no build, então uma suíte apontada para `npm run dev`
estaria conferindo uma página que nunca é a publicada. Ela sobe `vite preview`
em 4173 e a API em 8081, com banco e segredo descartáveis, o que também deixa
as portas e o banco de desenvolvimento livres para quem estiver trabalhando ao
mesmo tempo. E vale a pena: com `style-src 'self'` de volta, o navegador
registra dezoito recusas ao posicionar o popover do controle de ordenação —
mas o controle ainda responde ao clique. Quem pega isso é o ouvinte de console
da suíte, não a interação.

## Estrutura

```
api/                              Spring Boot
  src/main/java/dev/adamsalves/ordertracker/
    auth/                         cadastro, login, logout e revogação de token
    config/                       segurança, JWT, tratamento de erros, OpenAPI
    order/                        pedido, itens, status, histórico
    user/                         o usuário cadastrado e seu repositório
  src/main/resources/
    application.properties
  src/test/java/                  testes de integração e de unidade
web/                              Vite + React
  e2e/                            suíte de navegador (Playwright)
  src/
    api/                          cliente HTTP, tipos e parsers de resposta
    auth/                         sessão e contexto de autenticação
    components/                   componentes de domínio e primitivos shadcn/ui
    hooks/                        estado das telas de listagem, detalhe e criação
    lib/                          formatação, dinheiro, ordenação, erros
    pages/                        login, cadastro, listagem, detalhe, novo pedido
    routes/                       layouts e guarda de rota
```

## Próximos passos

Fora do escopo do desafio, na ordem em que fariam mais diferença:

- **Cobertura de componente no front.** A lógica pura está coberta em jsdom e
  os caminhos felizes das telas estão cobertos no navegador. O buraco no meio
  são as ramificações do formulário de criação — cada regra de validação, cada
  linha adicionada e removida — que o E2E cobriria devagar demais.
- **Rodar as três suítes em CI.** Existem três comandos e nada que os execute
  sozinho; o E2E, que sobe os dois processos por conta própria, é o que mais
  ganharia com isso.
- **Filtro por status na listagem.** O caminho natural depois da ordenação.
- **Teto no tamanho do corpo.** O limite de 100 itens recusa depois que o Jackson
  já montou a lista: corta o que é gravado e o que é respondido, não o que é
  lido. Um teto em bytes é configuração de contêiner, não anotação de campo.
- **Refresh token.** Hoje a sessão dura 24h e acaba de uma vez; um refresh
  encurtaria o token de acesso sem obrigar um novo login.
- **Papéis e permissões.** Todo usuário autenticado pode fazer tudo. Separar quem
  cria pedido de quem move status é o primeiro corte útil.
- **Docker Compose.** Subiria os dois lados com um comando só, no lugar do
  passo a passo acima.
- **Postgres no lugar do SQLite.** O `IMMEDIATE` resolve a disputa de escrita para
  um volume pequeno, mas um banco com MVCC não precisaria dela.
