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
| `400` | corpo inválido, JSON ilegível, status inexistente, ordenação não suportada, senha acima de 72 bytes |
| `401` | token ausente, expirado ou revogado; e-mail ou senha errados no login |
| `404` | pedido inexistente |
| `409` | transição de status ilegal; e-mail já cadastrado |

O corpo do `401` não diz se o token faltou, expirou ou foi revogado. Isso é papel
do header `WWW-Authenticate`; distinguir no corpo ajudaria a separar tokens
válidos de inválidos.

## Testes

```bash
cd api
./mvnw test
```

Os testes não precisam do `.env`: eles usam um segredo fixo e bancos próprios em
`api/target/test-data/`, recriados a cada execução (`ddl-auto=create-drop`). Cada
classe que escreve aponta para um arquivo só seu, para que uma não veja as linhas
da outra. O banco de desenvolvimento em `api/data/` não é tocado.

O front ainda não tem suíte — está listado em [Próximos passos](#próximos-passos).

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

**Toda transação começa `IMMEDIATE`.** O SQLite recusa promover a transação que
já leu em transação que escreve, e recusa sem esperar o `busy_timeout` — então
qualquer read-modify-write (a troca de status é um) devolvia 500 com dois
clientes simultâneos. Tomar o lock na abertura transforma disputa em espera. Os
parâmetros vão como propriedades do driver, e não na URL, porque cada classe de
teste sobrescreve a URL e perderia o que estivesse escrito nela.

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

**O token fica no `localStorage`.** É exposição a XSS em troca de sobreviver a um
refresh da página. A alternativa é um cookie `httpOnly`, e essa decisão é da API,
não do front: significaria reinstaurar proteção contra CSRF e abrir mão do header
`Authorization` que o resource server lê.

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

- **Suíte de testes no front.** Não há runner configurado em `web/`. Vitest com
  Testing Library cobriria o parser de resposta, a máquina de transições da tela
  de detalhe e o formulário de criação.
- **Testes de paginação na API.** O 400 da ordenação inválida está coberto, mas
  tamanho de página, direção e limites de página ainda não.
- **Filtro por status na listagem.** O caminho natural depois da ordenação.
- **Refresh token.** Hoje a sessão dura 24h e acaba de uma vez; um refresh
  encurtaria o token de acesso sem obrigar um novo login.
- **Papéis e permissões.** Todo usuário autenticado pode fazer tudo. Separar quem
  cria pedido de quem move status é o primeiro corte útil.
- **Docker Compose.** Subiria os dois lados com um comando só, no lugar do
  passo a passo acima.
- **Postgres no lugar do SQLite.** O `IMMEDIATE` resolve a disputa de escrita para
  um volume pequeno, mas um banco com MVCC não precisaria dela.
