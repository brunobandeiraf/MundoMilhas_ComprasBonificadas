# Plano de Implementação: Compras Bonificadas

## Visão Geral

Implementação incremental do sistema Compras Bonificadas utilizando Node.js + Express + TypeScript no backend, React + TypeScript no frontend, Prisma com SQLite para persistência, Puppeteer para crawling e Vitest + fast-check para testes. A abordagem segue a ordem: estrutura do projeto → banco de dados → serviços backend → rotas API → crawler → frontend → testes.

## Tasks

- [x] 1. Configuração do projeto e infraestrutura base
  - [x] 1.1 Criar estrutura de diretórios e configurar monorepo
    - Criar diretórios: `src/`, `src/config/`, `src/middleware/`, `src/routes/`, `src/controllers/`, `src/services/`, `src/crawler/`, `src/crawler/scrapers/`, `src/validators/`, `src/utils/`, `frontend/src/`, `tests/unit/`, `tests/integration/`, `tests/property/`
    - Criar `package.json` raiz com scripts para backend (dev, build, start, test, migrate)
    - Criar `tsconfig.json` com configuração strict para TypeScript
    - Criar `vitest.config.ts` com suporte a testes unitários, integração e property
    - Criar `.env.example` com variáveis: `DATABASE_URL`, `JWT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `CRON_SCHEDULE`
    - _Requisitos: Todos (infraestrutura base)_

  - [x] 1.2 Configurar dependências do backend
    - Instalar: `express`, `@prisma/client`, `jsonwebtoken`, `bcrypt`, `node-cron`, `nodemailer`, `zod`, `puppeteer`, `cors`, `helmet`
    - Instalar devDependencies: `typescript`, `vitest`, `fast-check`, `supertest`, `prisma`, `@types/express`, `@types/jsonwebtoken`, `@types/bcrypt`, `@types/node-cron`, `@types/nodemailer`, `@types/supertest`, `tsx`
    - _Requisitos: Todos (dependências)_

  - [x] 1.3 Configurar frontend React
    - Criar `frontend/package.json` com Vite + React + TypeScript
    - Instalar: `react`, `react-dom`, `react-router-dom`
    - Instalar devDependencies: `@vitejs/plugin-react`, `vite`, `typescript`, `@types/react`, `@types/react-dom`
    - Criar `frontend/vite.config.ts` com proxy para API backend
    - _Requisitos: 5, 6 (infraestrutura frontend)_

- [ ] 2. Schema do banco de dados e Prisma
  - [x] 2.1 Criar schema Prisma e executar migration inicial
    - Criar `prisma/schema.prisma` com modelos: `User`, `LoyaltyProgram`, `Store`, `BonusScore`, `CrawlLog`
    - Configurar datasource SQLite com `DATABASE_URL` do `.env`
    - Definir relações: Store ↔ BonusScore, LoyaltyProgram ↔ BonusScore
    - Definir constraint unique `@@unique([storeId, programId])` em BonusScore
    - Executar `npx prisma migrate dev --name init`
    - _Requisitos: 1.1, 4.3, 4.4, 5.1, 7.1_

  - [ ] 2.2 Criar singleton do Prisma Client e módulo de configuração
    - Criar `src/config/database.ts` com instância singleton do PrismaClient
    - Criar `src/config/env.ts` com validação Zod das variáveis de ambiente
    - _Requisitos: Todos (acesso a dados)_

- [ ] 3. Utilitários e middleware base
  - [ ] 3.1 Implementar utilitários de senha e token
    - Criar `src/utils/password.ts` com funções `hashPassword` e `comparePassword` usando bcrypt (salt rounds: 10)
    - Criar `src/utils/token.ts` com funções `generateToken` (JWT), `verifyToken`, e `generateActivationToken` (código de 6 dígitos)
    - _Requisitos: 2.3, 3.1_

  - [ ] 3.2 Implementar middleware de autenticação e autorização
    - Criar `src/middleware/auth.ts` com middleware JWT que extrai token do header Authorization
    - Implementar verificação de role (admin/client) para rotas protegidas
    - Implementar expiração de sessão de 30 minutos de inatividade
    - _Requisitos: 3.1, 3.3_

  - [ ] 3.3 Implementar middleware de rate limiting e error handler
    - Criar `src/middleware/rateLimiter.ts` com limitação por IP
    - Criar `src/middleware/errorHandler.ts` com tratamento centralizado de erros, mapeando exceções para códigos HTTP (400, 401, 403, 404, 409, 429, 500)
    - _Requisitos: 3.4_

  - [ ] 3.4 Implementar helpers de paginação
    - Criar `src/utils/pagination.ts` com funções para calcular offset, total de páginas e formatar resposta paginada
    - Suportar parâmetros `page` e `limit` (default: page=1, limit=50)
    - _Requisitos: 5.1_

- [ ] 4. Validadores Zod
  - [ ] 4.1 Criar validadores de autenticação e cadastro
    - Criar `src/validators/auth.validator.ts` com schemas Zod para login (email + password), ativação (email + token + password + profile), reenvio de token
    - Validação de e-mail: formato válido, máximo 254 caracteres, exatamente um "@" com partes não vazias
    - Validação de senha: mínimo 8 caracteres, ao menos 1 maiúscula, 1 minúscula, 1 número
    - _Requisitos: 1.2, 1.3, 2.3_

  - [ ] 4.2 Criar validadores de administração e lojas
    - Criar `src/validators/admin.validator.ts` com schemas para criação de usuário (email obrigatório, nome max 100 chars, telefone max 15 dígitos) e criação de programa (nome + url)
    - Criar `src/validators/stores.validator.ts` com schema para filtros de busca (search max 100 chars, minScore 1-99, maxScore 1-99, page, limit)
    - _Requisitos: 1.1, 6.1, 6.2, 6.3_

- [ ] 5. Checkpoint - Verificar infraestrutura base
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Serviços do backend
  - [ ] 6.1 Implementar UserService
    - Criar `src/services/user.service.ts` com métodos: `createUser`, `findByEmail`, `updateProfile`, `incrementLoginAttempts`, `resetLoginAttempts`, `isLoginBlocked`
    - Bloqueio de login: 5 tentativas consecutivas → bloqueio de 15 minutos
    - Busca de e-mail case-insensitive
    - _Requisitos: 1.1, 1.6, 3.4_

  - [ ] 6.2 Implementar EmailService
    - Criar `src/services/email.service.ts` com método `sendActivationEmail` usando Nodemailer
    - Configurar transporte SMTP via variáveis de ambiente
    - Template de e-mail com token de ativação
    - _Requisitos: 1.5, 2.1_

  - [ ] 6.3 Implementar AuthService
    - Criar `src/services/auth.service.ts` com métodos: `login`, `initiateActivation`, `validateToken`, `activateAccount`, `resendToken`
    - Login: verificar credenciais, incrementar tentativas em falha, resetar em sucesso, verificar bloqueio
    - Ativação: gerar token de 6 dígitos, validade 24h, limite de 5 reenvios por 24h
    - Mensagem genérica em falha de login ("Credenciais inválidas")
    - _Requisitos: 2.1, 2.3, 2.4, 2.5, 3.1, 3.2, 3.4_

  - [ ] 6.4 Implementar StoreService
    - Criar `src/services/store.service.ts` com métodos: `listStores`, `upsertStore`, `updateScore`, `removeScoresNotInList`
    - `listStores`: filtro por nome (case-insensitive, parcial), faixa de pontuação [min, max], ordenação decrescente por bestScore, paginação
    - `upsertStore`: criar loja se não existir, atualizar se existir
    - `removeScoresNotInList`: remover scores de lojas ausentes para um programa específico
    - _Requisitos: 4.3, 4.4, 4.5, 5.1, 5.3, 5.4, 6.1, 6.2, 6.4_

  - [ ] 6.5 Implementar ProgramService
    - Criar `src/services/program.service.ts` com métodos: `listPrograms`, `createProgram`, `findByName`
    - Validar unicidade do nome do programa
    - _Requisitos: 7.1, 7.2, 7.5_

  - [ ] 6.6 Implementar CrawlerService
    - Criar `src/services/crawler.service.ts` com métodos: `runAll`, `runForProgram`
    - Orquestrar execução de scrapers para cada programa ativo
    - Registrar resultado em CrawlLog (sucesso/erro, lojas encontradas, tempo)
    - Em caso de falha: descartar dados parciais, manter dados anteriores, registrar erro
    - Isolamento entre programas: falha em um não afeta outros
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.4_

- [ ] 7. Crawler - Scraper Livelo
  - [ ] 7.1 Implementar interface base e scraper Livelo
    - Criar `src/crawler/scrapers/base.scraper.ts` com interface `BaseScraper` (programName, scrape())
    - Criar `src/crawler/scrapers/livelo.scraper.ts` implementando `BaseScraper`
    - Usar Puppeteer para acessar site da Livelo, aguardar carregamento dinâmico
    - Timeout de 120 segundos por tentativa
    - Coletar nome da loja e pontuação bonificada de cada item
    - Tratar erros: timeout, conexão, parsing
    - _Requisitos: 4.2, 4.6_

  - [ ] 7.2 Implementar orquestrador do crawler e agendamento
    - Criar `src/crawler/index.ts` como orquestrador que busca programas ativos e executa scrapers
    - Criar `src/config/scheduler.ts` com node-cron agendando execução às 10:00 e 17:00 (horário de Brasília)
    - Criar `src/crawler/parser.ts` para normalização dos dados coletados (trim, lowercase para comparação)
    - _Requisitos: 4.1, 7.5_

- [ ] 8. Controllers e Rotas da API
  - [ ] 8.1 Implementar AuthController e rotas de autenticação
    - Criar `src/controllers/auth.controller.ts` com handlers: login, initiateActivation, confirmActivation, resendToken, logout
    - Criar `src/routes/auth.routes.ts` com rotas POST `/api/auth/login`, `/api/auth/activate/initiate`, `/api/auth/activate/confirm`, `/api/auth/activate/resend`, `/api/auth/logout`
    - Aplicar validadores Zod em cada rota
    - _Requisitos: 1.4, 2.1, 2.4, 2.5, 3.1, 3.2, 3.3_

  - [ ] 8.2 Implementar AdminController e rotas de administração
    - Criar `src/controllers/admin.controller.ts` com handlers: createUser, listUsers, listPrograms, createProgram, runCrawler
    - Criar `src/routes/admin.routes.ts` com rotas protegidas por JWT + role admin
    - POST `/api/admin/users`, GET `/api/admin/users`, GET `/api/admin/programs`, POST `/api/admin/programs`, POST `/api/admin/crawler/run`
    - _Requisitos: 1.1, 1.4, 1.7, 7.2, 7.5_

  - [ ] 8.3 Implementar StoresController e rotas de lojas
    - Criar `src/controllers/stores.controller.ts` com handler: listStores
    - Criar `src/routes/stores.routes.ts` com rota GET `/api/stores` protegida por JWT
    - Aceitar query params: page, limit, search, minScore, maxScore
    - Retornar dados paginados com bestScore e programName
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.4_

  - [ ] 8.4 Configurar Express app e entry point
    - Criar `src/app.ts` com configuração Express: cors, helmet, json parser, rotas, error handler
    - Criar `src/server.ts` como entry point: inicializar app, scheduler e escutar na porta configurada
    - _Requisitos: Todos (wiring)_

- [ ] 9. Checkpoint - Verificar backend completo
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Frontend - Contexto e serviços
  - [ ] 10.1 Implementar API client e AuthContext
    - Criar `frontend/src/services/api.ts` com funções fetch para todos os endpoints (login, activate, stores, admin)
    - Criar `frontend/src/contexts/AuthContext.tsx` com estado de autenticação, token JWT, user info, funções login/logout
    - Implementar interceptor para adicionar token JWT em requisições e tratar expiração de sessão
    - _Requisitos: 3.1, 3.3_

  - [ ] 10.2 Implementar hooks customizados
    - Criar `frontend/src/hooks/useAuth.ts` para consumir AuthContext
    - Criar `frontend/src/hooks/useStores.ts` para buscar lojas com filtros e paginação
    - Criar `frontend/src/hooks/useFilters.ts` para gerenciar estado dos filtros (search, minScore, maxScore)
    - _Requisitos: 5.1, 6.1, 6.2_

- [ ] 11. Frontend - Páginas e componentes
  - [ ] 11.1 Implementar páginas de autenticação
    - Criar `frontend/src/pages/LoginPage.tsx` com formulário de e-mail e senha, mensagens de erro genéricas, link para ativação
    - Criar `frontend/src/pages/ActivationPage.tsx` com fluxo: informar e-mail → receber token → definir senha e perfil
    - Implementar feedback visual para bloqueio temporário e reenvio de token
    - _Requisitos: 2.1, 2.3, 2.5, 3.1, 3.2, 3.4_

  - [ ] 11.2 Implementar página principal de lojas
    - Criar `frontend/src/pages/StoresPage.tsx` como página principal após login
    - Criar `frontend/src/components/StoreList.tsx` para renderizar lista de lojas
    - Criar `frontend/src/components/StoreCard.tsx` para exibir: nome da loja, melhor pontuação, programa de origem
    - Criar `frontend/src/components/Pagination.tsx` para navegação entre páginas (max 50 itens/página)
    - Exibir mensagem quando não há promoções disponíveis
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 11.3 Implementar componentes de filtro
    - Criar `frontend/src/components/SearchFilter.tsx` com campo de texto para busca por nome (max 100 chars)
    - Criar `frontend/src/components/ScoreRangeFilter.tsx` com inputs para faixa de pontuação (1-99)
    - Validar que min ≤ max e exibir mensagem de faixa inválida
    - Exibir mensagem quando nenhum resultado é encontrado com filtros aplicados
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ] 11.4 Implementar página de administração
    - Criar `frontend/src/pages/AdminPage.tsx` com seções: cadastro de clientes, lista de clientes, programas de fidelidade, execução manual do crawler
    - Criar `frontend/src/components/UserForm.tsx` para formulário de cadastro (email obrigatório, nome opcional, telefone opcional, opção de envio imediato)
    - Exibir confirmação com status do envio de ativação
    - _Requisitos: 1.1, 1.4, 1.7, 7.2_

  - [ ] 11.5 Configurar roteamento e App principal
    - Criar `frontend/src/App.tsx` com React Router: rotas públicas (login, ativação) e protegidas (stores, admin)
    - Criar `frontend/src/main.tsx` como entry point
    - Implementar guarda de rotas baseada em autenticação e role
    - _Requisitos: 3.1, 3.3_

- [ ] 12. Checkpoint - Verificar frontend completo
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Testes de propriedade (Property-Based Tests)
  - [ ]* 13.1 Property test - Validação de e-mail
    - **Property 1: Validação de e-mail aceita apenas formatos válidos**
    - Gerar strings arbitrárias e verificar que a validação aceita se e somente se contém exatamente um "@" com parte local não vazia e domínio não vazio (máximo 254 caracteres)
    - Usar fast-check com generators customizados para e-mails válidos e inválidos
    - **Valida: Requisitos 1.2, 1.3**

  - [ ]* 13.2 Property test - Rejeição de e-mail duplicado
    - **Property 2: Rejeição de e-mail duplicado**
    - Para qualquer e-mail válido já cadastrado, uma segunda tentativa de cadastro com o mesmo e-mail (case-insensitive) deve ser rejeitada com erro 409
    - Usar banco SQLite em memória para isolamento
    - **Valida: Requisito 1.6**

  - [ ]* 13.3 Property test - Validação de senha
    - **Property 3: Validação de senha aceita apenas formatos válidos**
    - Gerar strings arbitrárias e verificar que a validação aceita se e somente se tem ≥8 chars com ao menos 1 maiúscula, 1 minúscula e 1 número
    - **Valida: Requisito 2.3**

  - [ ]* 13.4 Property test - Limite de reenvios de token
    - **Property 4: Limite de reenvios de token**
    - Para qualquer sequência de N reenvios no mesmo período de 24h, as primeiras 5 devem ter sucesso e N > 5 deve ser rejeitado
    - **Valida: Requisito 2.5**

  - [ ]* 13.5 Property test - Mensagem genérica de login
    - **Property 5: Login retorna mensagem genérica para qualquer tipo de falha**
    - Para qualquer tentativa de login que falhe (e-mail não cadastrado, conta inativa, senha incorreta), a mensagem deve ser idêntica ("Credenciais inválidas")
    - **Valida: Requisito 3.2**

  - [ ]* 13.6 Property test - Bloqueio após tentativas de login
    - **Property 6: Bloqueio após tentativas consecutivas de login**
    - Após exatamente 5 tentativas consecutivas com falha, a próxima tentativa deve ser bloqueada por 15 minutos
    - **Valida: Requisito 3.4**

  - [ ]* 13.7 Property test - Sincronização do crawler (upsert)
    - **Property 7: Sincronização do crawler - upsert de lojas**
    - Para qualquer lista de resultados, lojas novas devem ser criadas e existentes devem ter pontuação atualizada
    - Usar banco em memória com dados pré-populados
    - **Valida: Requisitos 4.3, 4.4**

  - [ ]* 13.8 Property test - Sincronização do crawler (remoção)
    - **Property 8: Sincronização do crawler - remoção de lojas ausentes**
    - Após execução bem-sucedida, pontuações de lojas ausentes devem ser removidas para aquele programa, sem afetar outros programas
    - **Valida: Requisitos 4.5, 7.4**

  - [ ]* 13.9 Property test - Ordenação por melhor pontuação
    - **Property 9: Ordenação decrescente por melhor pontuação**
    - Para qualquer conjunto de lojas, a lista retornada deve estar ordenada com bestScore decrescente
    - **Valida: Requisito 5.1**

  - [ ]* 13.10 Property test - Consolidação do melhor score
    - **Property 10: Consolidação e exibição do melhor score entre programas**
    - Para qualquer loja com N programas, bestScore deve ser o máximo e programName deve corresponder ao programa com essa pontuação
    - **Valida: Requisitos 5.3, 5.4, 7.3**

  - [ ]* 13.11 Property test - Filtragem combinada
    - **Property 11: Filtragem de lojas por critérios combinados**
    - Para qualquer combinação de filtro nome + faixa [min, max] onde min ≤ max, todas as lojas retornadas devem satisfazer ambos os critérios e nenhuma loja válida deve ser omitida
    - **Valida: Requisitos 6.1, 6.2, 6.3, 6.4**

  - [ ]* 13.12 Property test - Isolamento entre programas
    - **Property 12: Isolamento de dados entre programas de fidelidade**
    - Para qualquer operação em um programa, scores de outros programas devem permanecer inalterados
    - **Valida: Requisitos 7.1, 7.2**

- [ ] 14. Testes de integração
  - [ ]* 14.1 Testes de integração - Rotas de autenticação
    - Testar fluxo completo: cadastro → ativação → login → logout
    - Testar bloqueio após 5 tentativas
    - Testar expiração de token de ativação
    - Testar reenvio de token (sucesso e limite)
    - Usar supertest com banco SQLite em memória
    - _Requisitos: 1, 2, 3_

  - [ ]* 14.2 Testes de integração - Rotas de administração
    - Testar criação de usuário (sucesso, duplicidade, validação)
    - Testar criação de programa de fidelidade
    - Testar execução manual do crawler
    - Testar proteção de rotas (sem token, token inválido, role incorreta)
    - _Requisitos: 1, 7_

  - [ ]* 14.3 Testes de integração - Rotas de lojas
    - Testar listagem com paginação
    - Testar filtro por nome (parcial, case-insensitive)
    - Testar filtro por faixa de pontuação
    - Testar filtros combinados
    - Testar ordenação decrescente por bestScore
    - Testar resposta quando não há lojas
    - _Requisitos: 5, 6_

- [ ] 15. Checkpoint final - Verificar sistema completo
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de corretude
- Testes unitários validam exemplos específicos e edge cases
- O crawler Livelo pode precisar de ajustes conforme mudanças no site alvo

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "3.1", "3.4"] },
    { "id": 4, "tasks": ["3.2", "3.3", "4.1", "4.2"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.5"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.6"] },
    { "id": 7, "tasks": ["7.1", "7.2"] },
    { "id": 8, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 9, "tasks": ["8.4"] },
    { "id": 10, "tasks": ["10.1"] },
    { "id": 11, "tasks": ["10.2", "11.1"] },
    { "id": 12, "tasks": ["11.2", "11.3", "11.4"] },
    { "id": 13, "tasks": ["11.5"] },
    { "id": 14, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5", "13.6"] },
    { "id": 15, "tasks": ["13.7", "13.8", "13.9", "13.10", "13.11", "13.12"] },
    { "id": 16, "tasks": ["14.1", "14.2", "14.3"] }
  ]
}
```
