# Delivery Order Tracker

Desafio técnico: sistema simplificado de rastreamento de pedidos de delivery.
O README na raiz descreve como subir os dois lados e o contrato da API.

## Escopo FECHADO — não implemente nada além disto
Tudo abaixo já está implementado. A descrição é do que existe, e serve para
que uma mudança respeite as decisões que sustentam cada parte.

- Auth: cadastro (nome, email, senha), login por email+senha, JWT.
  Apenas autenticados acessam a API.
- Logout: revoga o token que autorizou a chamada. Como o JWT é
  stateless, encerrar a sessão só no cliente deixaria o token válido
  até expirar; por isso o token carrega um `jti` e o logout grava esse
  identificador numa tabela de revogados, consultada a cada request por
  um `OAuth2TokenValidator` composto com os validadores padrão. As
  entradas expiradas são apagadas no próprio logout, sem job agendado.
  O trade-off é deliberado: a API deixa de ser 100% stateless e paga um
  lookup por request autenticado.
- Pedido: cliente, itens, endereço de entrega.
- Status: RECEBIDO, EM_PREPARO, SAIU_PARA_ENTREGA, ENTREGUE, CANCELADO.
  Estes valores são LITERAIS e em português. Nunca traduza.
- As transições legais são uma máquina de estados no próprio enum
  (`allowedTransitions()`): RECEBIDO -> EM_PREPARO ou CANCELADO;
  EM_PREPARO -> SAIU_PARA_ENTREGA ou CANCELADO; SAIU_PARA_ENTREGA ->
  ENTREGUE ou CANCELADO; ENTREGUE e CANCELADO são terminais. Nenhum
  status se lista a si mesmo, então parar no lugar é recusado pela mesma
  tabela — não crie uma regra separada para isso. Transição inválida
  devolve 409 nomeando o status atual e as saídas abertas; o pedido é
  identificado pelo `instance` do problem detail.
- Histórico de status: cada transição grava uma linha
  (`OrderStatusHistory`) com origem, destino, horário e o e-mail do
  autor, lido do claim do JWT. A criação do pedido grava a primeira
  linha, com origem nula, para a timeline não nascer vazia. A associação
  NÃO é mapeada como coleção em `Order`: os itens já são um bag e um
  segundo no mesmo entity graph quebra com MultipleBagFetchException.
- Erros: um `@RestControllerAdvice` único devolvendo `ProblemDetail`
  (RFC 9457). Os services levantam exceções de domínio próprias e não
  conhecem status HTTP. Não escreva um record de erro próprio.
  Exceção inevitável: 401 e 403 são recusados na cadeia de filtros,
  antes do DispatcherServlet, onde o advice não alcança. Um
  `AuthenticationEntryPoint`/`AccessDeniedHandler` próprio escreve o
  mesmo `ProblemDetail` ali, delegando antes aos handlers de origem
  para preservar o header `WWW-Authenticate`. O corpo não diz se o
  token faltou, expirou ou foi revogado: isso é papel do header, e
  distinguir no corpo ajudaria a separar tokens válidos dos inválidos.
- Logs: SLF4J direto, sem `logback-spring.xml` e sem dependência de
  tracing. Um filtro à frente da cadeia de segurança (`@Order` mais alto,
  não atrás dela) gera um id por requisição, põe no MDC — costurado no
  padrão do Boot por `logging.pattern.correlation` — e devolve em
  `X-Request-Id`, exposto no CORS por nome — sem isso o header chega ao
  browser e o JS lê `null`. Estando à frente, 401 e 403 também saem com
  id. Ele também registra, no caminho de volta, a falha que ninguém
  tratou, que o container só logaria depois, com o MDC já limpo. Deixam
  linha: cadastro, login recusado, token emitido, token revogado, cada
  recusa do advice e cada recusa escrita na cadeia de filtros (401/403,
  no `ProblemDetailAuthenticationHandler`) — esta última é a recusa mais
  comum de uma API bearer, e sem ela o id voltava sem nada a que
  correlacionar. NUNCA registre o e-mail tentado, o token, a senha, nem
  a mensagem de uma exceção de validação — ela traz os valores
  rejeitados, e em `/api/auth` um deles é a senha. A linha leva `jti`
  (ou, no cadastro, o id do usuário), status, rota e o NOME da exceção.
  As duas falhas de login (senha errada, conta inexistente) produzem
  linha idêntica de propósito: é o mesmo motivo do `decoyHash`, e há
  teste exigindo que sejam iguais. O endereço de quem chamou fica de
  fora por decisão, não por descuido: é dado pessoal, e o log é
  guardado. Exceção à regra da mensagem: um 5xx sai em ERROR com o stack
  trace, porque ali a exceção é falta nossa e não o input do chamador
  voltando — não há `@Validated` nesta aplicação para levantar validação
  de método em 500.
- Endpoints: criar pedido, atualizar status, listar todos, buscar por ID.
- A listagem é PAGINADA e ordenável. Decisão deliberada, tomada na fase
  de domínio: devolver a tabela inteira numa resposta só não escala e a
  ordem das linhas sem ORDER BY fica a critério do banco. Contrato:
  `Pageable` no controller, `@PageableDefault(size = 20, sort =
  {"createdAt", "id"}, direction = DESC)`, resposta em
  `PagedModel<OrderSummaryResponse>` (nunca `Page<T>` direto, que emite
  PlainPageSerializationWarning), e `max-page-size` limitado.
  A ordenação aceita apenas as propriedades escalares que a listagem
  expõe — propriedade desconhecida ou associação to-many devolve 400.
  A listagem NÃO carrega itens nem histórico, pelo mesmo motivo de N+1:
  só o detalhe (`OrderDetailResponse`) leva as duas coleções.
- Front React: lista de pedidos com status atual + criação de pedido,
  e a timeline do histórico na tela de detalhe. A listagem também
  oferece um controle de ordenação, que não vai para a URL e não
  inclui status entre as opções.

## Fora de escopo — NÃO implemente, mesmo se parecer útil
Mapa, geolocalização, entregador/motoboy, roteirização, WebSocket,
refresh token, roles/permissões, Docker, CI, cache, i18n.
Recuperação de senha e verificação de e-mail também estão fora.
Filtro por status também está fora: a listagem tem paginação e
ordenação, e nada além disso.
Se achar que algo assim agrega, escreva na seção "Próximos passos" do
README em vez de codar.

## Stack
- API: Java 21, Spring Boot 4.1.0, Spring Security
  (oauth2-resource-server com chave simétrica HS256), Spring Data JPA,
  Bean Validation, springdoc-openapi.

  Dependências em `api/pom.xml`, transcritas literalmente (o Boot 4
  renomeou vários starters em relação ao 3.x — confira aqui antes de
  escrever um artifactId de memória):
  - `spring-boot-starter-webmvc` — e **não** `spring-boot-starter-web`
  - `spring-boot-starter-security`
  - `spring-boot-starter-security-oauth2-resource-server` — e **não**
    `spring-boot-starter-oauth2-resource-server`, que é o nome antigo
  - `spring-boot-starter-data-jpa`
  - `spring-boot-starter-validation`
  - `org.springdoc:springdoc-openapi-starter-webmvc-ui`
  - `org.hibernate.orm:hibernate-community-dialects`
  - `org.xerial:sqlite-jdbc`, em escopo `runtime`
  - escopo `test`: `spring-boot-starter-webmvc-test`,
    `spring-boot-starter-security-test`, `spring-boot-starter-data-jpa-test`,
    `spring-boot-starter-validation-test` — o `spring-boot-starter-test`
    único do Boot 3 foi fatiado por módulo

  O build também traz o spotless-maven-plugin, com palantir-java-format.
- Banco: SQLite via org.xerial:sqlite-jdbc +
  org.hibernate.orm:hibernate-community-dialects.
  Dialect: org.hibernate.community.dialect.SQLiteDialect. ddl-auto=update.
  Toda transação começa IMMEDIATE, via
  `spring.datasource.hikari.data-source-properties`. Não é ajuste fino:
  o SQLite recusa promover a transação que já leu em transação que
  escreve, e recusa sem esperar o `busy_timeout`, então qualquer
  read-modify-write (a troca de status é um) devolvia 500 com dois
  clientes simultâneos. Os parâmetros vão como propriedades do driver e
  não na URL, porque cada classe de teste sobrescreve a URL e perderia
  o que estivesse escrito nela.
  `hibernate.column_ordering_strategy=legacy` também não é ajuste fino:
  reordenando colunas, o Hibernate cria a coluna de identidade sem tipo
  (`id`, e não `id integer`), o SQLite deixa passar NULL nela, e o pedido
  volta sem itens porque o join lê identificador nulo como linha ausente.
  Só afeta schema criado do zero — ou seja, toda execução de teste.
  REGRA DE ESCAPE: se o SQLiteDialect não subir o contexto da aplicação
  após duas abordagens distintas, PARE. Não tente uma terceira e não
  troque de banco por conta própria: me relate o que tentou, o erro exato
  de cada tentativa, e aguarde minha decisão sobre migrar para H2.
  O enunciado permite "SQLite ou similar"; se a decisão for migrar, o
  alvo é H2 em modo arquivo (jdbc:h2:file:./data/app).
- Web: Vite + React + TypeScript + react-router. Sem lib de estado global.
  Tailwind CSS e shadcn/ui são autorizados e já estão em uso: os primitivos
  ficam em `web/src/components/ui`. Não remova nem reescreva isso como se
  fosse desvio.
- Pacote base: dev.adamsalves.ordertracker

## Convenções
- Código, nomes e mensagens de commit em inglês. Exceções: os valores do
  enum de status, que são em português por exigência do enunciado, e o
  README, escrito para quem avalia o desafio.
- Conventional Commits: feat, fix, chore, docs, test, refactor.
- Commits ATÔMICOS. Uma unidade lógica por commit. Nunca agrupe uma
  feature inteira num commit só.
- Sem comentários óbvios no código. Sem README dentro de subpastas.
- Este projeto usa Spring Boot 4.x, que tem breaking changes em relação
  ao 3.x amplamente documentado. Antes de escrever configuração de Spring
  Security, JPA ou auto-configuração, consulte a documentação oficial da
  versão 4.x em vez de assumir o padrão do 3.x. Se uma API que você ia
  usar foi removida ou renomeada, me avise antes de implementar.
- Uma branch por fase, nomeada feat/<escopo> ou chore/<escopo>. Crie a
  branch no início de cada tarefa, a partir da main atualizada.
- TODA mudança chega na main por Pull Request. Nunca commite, nunca dê
  push e nunca faça merge direto na main. Ao terminar a tarefa: push da
  branch, abra o PR contra a main e me avise. Abrir o PR encerra a
  tarefa — a revisão e o merge são meus.
- O merge é feito com --no-ff. Nunca use squash: os commits atômicos são
  requisito do desafio.
- Antes de cada commit, rode o formatador do lado correspondente:
  ./mvnw spotless:apply na API, npm run format no web.

## Estado atual
As features do escopo estão fechadas. O que resta é trabalho de qualidade
sobre elas, e não escopo novo:
- `web/` roda vitest com Testing Library em jsdom (`npm test`). A config
  vive no próprio `vite.config.ts`, para que o alias `@` e o plugin do
  react tenham uma definição só. Os testes ficam ao lado do que testam,
  dentro de `src`, e o `tsc -b` do build também os checa.
- A lógica pura do front está coberta: preço em centavos, tabela de
  ordenação, máquina de transições e as mensagens de erro.
- Na API, paginação, ordenação, CORS, o round-trip de criação de pedido e
  os logs (id de correlação, evento de auth, recusa) estão cobertos.
