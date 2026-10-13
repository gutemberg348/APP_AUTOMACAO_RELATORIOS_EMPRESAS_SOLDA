# Mensagens nos cadastros

Revisão de 13/10/2026 nos formulários de empresas, obras e relatórios.

- Empresa: validações locais e da API identificam o campo; a tela rola até o primeiro erro. Nome ausente e nome acima do limite têm mensagens diferentes. E-mail inválido mostra um exemplo. Falha ao gravar revela o aviso sem apagar os valores.
- Obra: preservada a abertura automática do bloco técnico e a rolagem ao campo inválido. Avisos agora explicam como continuar. Empresa e obra mostram texto de salvamento enquanto aguardam a API.
- Relatório: erros listam o nome do campo, número do ponto ou responsável correspondente, abrem a seção correta e destacam o campo. Erros de campos técnicos recebidos da API seguem o mesmo fluxo da validação local.
- Falhas de conexão, acesso e conflito recebem orientações. Em falha de conexão após criar, a mensagem recomenda conferir a lista antes de repetir para evitar duplicação.
- Seleções indisponíveis e carregamento de obras/tipos oferecem nova tentativa. Listas vazias orientam onde cadastrar a empresa ou obra necessária.

Verificação no navegador com API simulada: nome/empresa obrigatórios, e-mail incorreto, intervalo de datas da obra, data inválida do relatório, validade técnica em seção recolhida, indicação de salvamento, falha de servidor, preservação dos campos e nova tentativa bem-sucedida sem recarregar. Um erro de validação da API no ponto 02 também revelou a seção correta e permitiu corrigir e salvar. Nenhum cadastro real foi gravado pelo teste. TypeScript, ESLint e exportações web, Android e iOS conferidos.

Captura: [falha de salvamento com orientação](company-save-error-guidance.png).
