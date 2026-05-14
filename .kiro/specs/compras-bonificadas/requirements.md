# Documento de Requisitos - Compras Bonificadas

## Introdução

O sistema "Compras Bonificadas" é uma plataforma que permite aos usuários visualizar promoções de compras bonificadas de programas de fidelidade (inicialmente Livelo). O sistema realiza coleta automatizada (crawling) de promoções em sites de marketplace de programas de milhas, exibe as melhores pontuações por loja e permite filtragem por nome e faixa de bonificação. O cadastro de usuários é feito por administradores, com ativação via e-mail no primeiro acesso.

## Glossário

- **Sistema**: A plataforma Compras Bonificadas como um todo
- **Administrador**: Usuário com permissões administrativas para gerenciar cadastros
- **Cliente**: Usuário final cadastrado pelo Administrador que acessa a plataforma
- **Crawler**: Módulo responsável por coletar promoções automaticamente dos sites de programas de fidelidade
- **Loja**: Estabelecimento comercial parceiro de um programa de fidelidade que oferece bonificação
- **Programa_de_Fidelidade**: Programa de milhas/pontos (ex: Livelo, Shopping Azul, Smiles, LatamPass)
- **Pontuacao_Bonificada**: Multiplicador de pontos oferecido por uma loja em um programa de fidelidade (ex: 5:1 significa 5 pontos por real gasto)
- **Token_de_Ativacao**: Código único enviado por e-mail para verificação e ativação da conta do Cliente
- **Cron_Job**: Tarefa agendada que executa o Crawler em horários pré-definidos

## Requisitos

### Requisito 1: Cadastro de Usuários pelo Administrador

**User Story:** Como Administrador, eu quero cadastrar novos Clientes na plataforma, para que eles possam acessar as promoções de compras bonificadas.

#### Critérios de Aceitação

1. THE Sistema SHALL permitir que o Administrador cadastre um Cliente informando e-mail (obrigatório, máximo 254 caracteres), nome (opcional, máximo 100 caracteres) e telefone (opcional, máximo 15 dígitos numéricos)
2. WHEN o Administrador submete o cadastro de um Cliente, THE Sistema SHALL validar que o campo e-mail está preenchido e possui formato válido (contendo exatamente um caractere "@" com parte local e domínio não vazios)
3. IF o e-mail informado não possuir formato válido, THEN THE Sistema SHALL rejeitar o cadastro e exibir mensagem indicando que o formato do e-mail é inválido
4. WHEN o Administrador cadastra um Cliente, THE Sistema SHALL oferecer a opção de enviar o e-mail de ativação imediatamente ou postergar o envio para o momento do primeiro login
5. IF o Administrador selecionar envio imediato, THEN THE Sistema SHALL enviar o e-mail de ativação contendo o Token_de_Ativacao com validade de 24 horas para o endereço cadastrado
6. IF o e-mail informado já estiver cadastrado no Sistema, THEN THE Sistema SHALL rejeitar o cadastro e exibir mensagem informando duplicidade
7. WHEN o cadastro do Cliente é realizado com sucesso, THE Sistema SHALL exibir confirmação ao Administrador contendo o e-mail do Cliente cadastrado e o status do envio de ativação (enviado ou pendente)

### Requisito 2: Ativação de Conta e Primeiro Login

**User Story:** Como Cliente, eu quero ativar minha conta no primeiro acesso, para que eu possa utilizar a plataforma com segurança.

#### Critérios de Aceitação

1. WHEN o Cliente tenta realizar login com um e-mail cadastrado cuja conta ainda não foi ativada, THE Sistema SHALL enviar o Token_de_Ativacao para o e-mail cadastrado, sendo o token válido por 24 horas a partir do envio
2. IF o e-mail não estiver cadastrado pelo Administrador, THEN THE Sistema SHALL rejeitar o acesso e exibir mensagem informando que o cadastro deve ser feito por um Administrador
3. WHEN o Cliente informa um Token_de_Ativacao que corresponde ao token emitido e está dentro do prazo de validade de 24 horas, THE Sistema SHALL solicitar a definição de senha (mínimo 8 caracteres, contendo ao menos uma letra maiúscula, uma minúscula e um número) e o preenchimento dos dados de perfil pendentes (nome e telefone, caso não tenham sido preenchidos no cadastro)
4. WHEN o Cliente completa a definição de senha válida e dados de perfil, THE Sistema SHALL ativar a conta e permitir o acesso à plataforma
5. IF o Token_de_Ativacao informado não corresponder ao token emitido ou estiver expirado (mais de 24 horas desde o envio), THEN THE Sistema SHALL rejeitar a ativação e oferecer a opção de reenvio de um novo token, limitado a no máximo 5 reenvios por período de 24 horas
6. IF o Cliente já possuir conta ativada e tentar acessar o fluxo de ativação, THEN THE Sistema SHALL redirecionar o Cliente para o fluxo de login padrão

### Requisito 3: Autenticação de Usuários Ativos

**User Story:** Como Cliente, eu quero realizar login na plataforma, para que eu possa visualizar as promoções de compras bonificadas.

#### Critérios de Aceitação

1. WHEN o Cliente informa e-mail e senha que correspondem às credenciais armazenadas de uma conta ativa, THE Sistema SHALL autenticar o Cliente e conceder acesso à plataforma em até 3 segundos
2. IF o Cliente informar e-mail não cadastrado, e-mail de conta não ativada, ou senha que não corresponde ao e-mail informado, THEN THE Sistema SHALL rejeitar o acesso e exibir mensagem de erro indicando que as credenciais são inválidas, sem revelar qual campo está incorreto
3. WHILE o Cliente estiver autenticado, THE Sistema SHALL manter a sessão ativa por no máximo 30 minutos de inatividade, encerrando a sessão automaticamente após esse período ou quando o Cliente realizar logout
4. IF o Cliente atingir 5 tentativas consecutivas de login com falha para o mesmo e-mail, THEN THE Sistema SHALL bloquear temporariamente novas tentativas de login para esse e-mail por 15 minutos e exibir mensagem informando o bloqueio temporário

### Requisito 4: Coleta Automatizada de Promoções (Crawler)

**User Story:** Como Administrador, eu quero que o sistema colete automaticamente as promoções de compras bonificadas dos sites de programas de fidelidade, para que os Clientes tenham acesso a informações atualizadas.

#### Critérios de Aceitação

1. THE Cron_Job SHALL executar o Crawler diariamente às 10:00 e às 17:00 (horário de Brasília)
2. WHEN o Crawler é executado, THE Crawler SHALL acessar o site do Programa_de_Fidelidade Livelo e coletar todas as promoções de compras bonificadas disponíveis dentro de um tempo limite de 120 segundos por tentativa de acesso
3. WHEN o Crawler encontra uma Loja não cadastrada no Sistema, THE Sistema SHALL registrar a Loja com no mínimo o nome da Loja e a Pontuacao_Bonificada coletada, e associá-la ao Programa_de_Fidelidade correspondente
4. WHEN o Crawler encontra uma promoção para uma Loja já cadastrada, THE Sistema SHALL atualizar a Pontuacao_Bonificada da Loja com o valor mais recente coletado
5. WHEN o Crawler completa a coleta com sucesso, THE Sistema SHALL remover as Pontuacoes_Bonificadas de Lojas que não estejam mais presentes na listagem do Programa_de_Fidelidade de origem
6. IF o Crawler falhar ao acessar o site do Programa_de_Fidelidade (tempo limite excedido ou erro de conexão), THEN THE Sistema SHALL registrar o erro em log, descartar quaisquer dados parcialmente coletados nessa execução, e tentar novamente na próxima execução agendada
7. IF o Crawler encontrar uma Loja em um Programa_de_Fidelidade não registrado, THEN THE Sistema SHALL registrar o novo Programa_de_Fidelidade e a Loja associada

### Requisito 5: Exibição de Lojas e Pontuações

**User Story:** Como Cliente, eu quero visualizar a lista de lojas com suas melhores pontuações bonificadas, para que eu possa identificar as melhores oportunidades de compra.

#### Critérios de Aceitação

1. WHEN o Cliente acessa a tela principal após login, THE Sistema SHALL exibir a lista de Lojas ordenada pela maior Pontuacao_Bonificada de forma decrescente, apresentando no máximo 50 Lojas por página
2. WHILE apenas o Programa_de_Fidelidade Livelo estiver configurado, THE Sistema SHALL exibir a pontuação da Livelo como a maior pontuação de cada Loja
3. WHILE múltiplos Programas_de_Fidelidade estiverem configurados, THE Sistema SHALL exibir a maior Pontuacao_Bonificada entre todos os programas para cada Loja
4. THE Sistema SHALL exibir para cada Loja o nome da Loja, a Pontuacao_Bonificada mais alta e o Programa_de_Fidelidade correspondente
5. IF nenhuma Loja com Pontuacao_Bonificada estiver disponível no Sistema, THEN THE Sistema SHALL exibir mensagem informando que não há promoções disponíveis no momento

### Requisito 6: Filtros de Busca e Pesquisa

**User Story:** Como Cliente, eu quero filtrar e pesquisar lojas por nome e faixa de bonificação, para que eu possa encontrar rapidamente as promoções que me interessam.

#### Critérios de Aceitação

1. WHEN o Cliente digita um termo com pelo menos 1 caractere no campo de pesquisa, THE Sistema SHALL filtrar a lista de Lojas em até 1 segundo, exibindo apenas aquelas cujo nome contenha o termo pesquisado (busca parcial, case-insensitive, máximo de 100 caracteres no campo de pesquisa)
2. WHEN o Cliente define uma faixa de Pontuacao_Bonificada (valor mínimo e valor máximo, dentro do intervalo de 1 a 99), THE Sistema SHALL filtrar a lista exibindo apenas Lojas cuja maior pontuação esteja dentro da faixa definida (inclusive nos limites)
3. IF o Cliente definir um valor mínimo maior que o valor máximo no filtro de faixa, THEN THE Sistema SHALL exibir mensagem indicando que a faixa é inválida e não aplicar o filtro até que os valores sejam corrigidos
4. WHEN o Cliente aplica filtro de nome e filtro de faixa simultaneamente, THE Sistema SHALL exibir apenas Lojas que atendam a ambos os critérios (interseção)
5. WHEN nenhuma Loja atender aos critérios de filtro aplicados, THE Sistema SHALL exibir mensagem informando que nenhum resultado foi encontrado e manter os filtros aplicados visíveis para que o Cliente possa ajustá-los
6. WHEN o Cliente remove todos os filtros ou limpa o campo de pesquisa deixando-o vazio, THE Sistema SHALL exibir novamente a lista completa de Lojas

### Requisito 7: Extensibilidade para Novos Programas de Fidelidade

**User Story:** Como Administrador, eu quero que o sistema suporte a adição de novos programas de fidelidade no futuro, para que a cobertura de promoções seja ampliada.

#### Critérios de Aceitação

1. THE Sistema SHALL armazenar cada Loja e sua Pontuacao_Bonificada associada ao Programa_de_Fidelidade de origem, mantendo registros separados por programa mesmo quando a Loja existir em múltiplos programas
2. THE Sistema SHALL permitir que o Administrador adicione um novo Programa_de_Fidelidade informando nome do programa e URL de coleta, sem necessidade de alteração nos dados já armazenados de outros programas
3. WHEN uma mesma Loja existir em múltiplos Programas_de_Fidelidade, THE Sistema SHALL identificar a correspondência pelo nome exato da Loja (case-insensitive) e consolidar a exibição apresentando a maior Pontuacao_Bonificada e o Programa_de_Fidelidade de origem dessa pontuação
4. IF o Crawler falhar ao coletar dados de um Programa_de_Fidelidade específico, THEN THE Sistema SHALL manter os dados previamente coletados dos demais programas inalterados e registrar o erro em log
5. WHEN o Administrador adiciona um novo Programa_de_Fidelidade, THE Sistema SHALL incluí-lo no próximo ciclo de execução do Crawler sem interromper a coleta dos programas já configurados
