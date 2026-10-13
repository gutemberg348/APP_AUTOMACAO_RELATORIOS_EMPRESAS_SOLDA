# Cadastro de obra e dados técnicos opcionais — 08/10/2026

Fábrica/unidade e proprietário foram movidos para a identificação da obra, com indicação de preenchimento opcional. Referência do projeto e dados técnicos por tipo começam recolhidos e podem ser abertos quando necessários. O cadastro mantém os dados em `reportDefaults`, preservando o preenchimento automático dos relatórios. A validação da API já permite omitir esses campos.

Erros locais mostram mensagens no campo correspondente e um resumo. A página rola até o primeiro campo inválido. Se a seção técnica estiver fechada ou mostrar outro tipo, ela abre e seleciona o modelo que contém o erro. Falhas da API aparecem no início do formulário, preservando os valores digitados.

## Conferência pela interface

- Cadastro mínimo com somente empresa e nome da obra, sem fábrica, proprietário, datas ou dados técnicos.
- Empresa/nome ausentes: mensagens específicas e rolagem até o primeiro campo inválido.
- Data de aferição inválida do TH, com a seção fechada e EVS selecionado: seção aberta automaticamente no TH, campo destacado e visível. O banco não foi alterado enquanto o formulário estava inválido.
- Correção e salvamento com a seção recolhida: fábrica, proprietário, referência, processo de soldagem do EVS e dados do TH persistidos.
- Data final anterior à inicial: campo final revelado com mensagem específica. Correção salva normalmente.
- Novo relatório EVS: fábrica, proprietário, referência e processo de soldagem preenchidos a partir da obra.
- Falha de servidor simulada: mensagem revelada no início e edição preservada.
- Conferência em 390px sem rolagem horizontal; axe não encontrou violações nos critérios WCAG 2 A/AA e 2.1 AA analisados. Essa análise é pontual.
- TypeScript, ESLint e exportação Expo para web, Android e iOS passaram.

Banco e armazenamento temporários foram removidos ao terminar os testes. Nenhum registro fictício foi criado no banco principal. Capturas `report-pdf-project-*.png` são artefatos locais ignorados pelo Git. A execução em aparelho físico continua pendente.
