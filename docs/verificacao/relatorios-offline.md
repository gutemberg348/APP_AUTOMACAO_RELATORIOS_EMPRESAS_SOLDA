# Relatórios e fotos sem internet

Implementação de 04/11/2026. Vale para os seis tipos: EVS, EVD, LP, TH, ME e RDO.

## Como usar no telefone

1. Entre na conta com internet. O aplicativo prepara automaticamente empresas, obras, modelos, relatórios e fotos acessíveis à conta, em sequência. Aguarde **Tudo sincronizado e disponível offline** antes de sair sem internet.
2. Em **Relatórios → Sincronização**, existe apenas um botão **Sincronizar** para atualizar os dados disponíveis offline e enviar as pendências. Abrir um relatório também guarda seus dados e fotos automaticamente.
3. Sem conexão, escolha uma empresa/obra preparada e preencha o relatório. Dados, desenhos, fotos e assinaturas ficam no armazenamento privado do telefone. O formulário salva localmente e oferece **Salvar no telefone**.
4. Os rascunhos pendentes reaparecem em **Sincronização** ao fechar e abrir o app. Eles pertencem à conta e ao endereço da API usados no preenchimento.
5. Com o app aberto, a reconexão envia os rascunhos fora de edição. Formulários abertos mantêm a ação de sincronizar após terminar de preencher. Conflitos ou validações continuam exigindo correção; não são sobrescritos automaticamente.
6. A preparação automática verifica atualizações a cada cinco minutos e ao voltar ao app. Versões já preparadas e fotos já armazenadas não são baixadas novamente. O botão manual permite repetir a verificação imediatamente.

Atualização de 05/11/2026: corrigidos `Blob.bytes()` indisponível no React Native e a construção incompatível de Blob a partir de ArrayBuffer. A gravação usa FileReader; a leitura usa o transporte local de arquivos, sem internet. Mensagens técnicas ficam nos diagnósticos, com orientação legível na tela. Esta atualização é no aplicativo/painel, sem nova migração ou alteração de API.

PDF, envio para análise, aprovação e compartilhamento do PDF exigem conexão. Campos incompletos podem ficar salvos no telefone; na sincronização, a validação identifica as pendências e oferece acesso ao preenchimento para corrigir. Erros de foto mantêm as fotos pendentes para nova tentativa.

Se outra pessoa tiver alterado a versão no servidor, o app preserva o preenchimento local e mostra o conflito. É necessário conferir a versão do servidor e confirmar explicitamente o uso do preenchimento local sobre essa versão antes de tentar novamente.

## Persistência e sincronização

- Android/iOS: arquivos em `Paths.document/weldcosta-offline/<conta-e-api>`, com duas versões alternadas do JSON para preservar o último snapshot válido se uma gravação for interrompida. Fotos são copiadas para esse diretório antes de entrar na fila.
- Navegador: IndexedDB para dados e imagens. Isso não instala um PWA nem garante abrir o site do zero sem carregar seus arquivos; o APK já inclui os arquivos do app.
- Catálogos preparados e respostas autorizadas consultadas podem ser recuperados do armazenamento quando a rede falha. Respostas de permissão negada não são substituídas pelo cache.
- Criação usa `clientDraftId`, único por autor; atualização usa `clientMutationId` e o controle de versão existente. Repetir uma requisição após perder a resposta não cria outro relatório nem reaplica a mesma alteração.
- A fila registra os IDs dos pontos confirmados no servidor antes de enviar fotos. Cada upload conserva seu identificador e cada foto confirmada sai da fila; uma interrupção retoma as restantes.
- Cópias locais de fotos pendentes são removidas após confirmação, mantendo uma cópia em cache para acesso offline ao relatório sincronizado. As fotos originais da galeria não são apagadas.
- A verificação definitiva de duplicidade ocorre no servidor durante o envio, respeitando a obra e as regras de reutilização já existentes.
- Desinstalar o app ou apagar seus dados remove os rascunhos ainda não sincronizados. Trocar de conta não apaga esses rascunhos; eles reaparecem ao entrar na conta original.

## Publicação

A alteração exige API atualizada, migração `20261104000000_offline_report_sync` e novo APK, que inclui `expo-network` e `expo-crypto`. Não exige novas variáveis de ambiente. O entrypoint de produção aplica as migrações antes de iniciar a API.

Depois de publicar o código no repositório, na VPS:

```bash
cd /var/www/solda/APP_AUTOMACAO_RELATORIOS_EMPRESAS_SOLDA
git pull origin master
npm run docker:production:api
```

Para publicar também a interface web, use `npm run docker:production` no lugar do comando que atualiza somente a API.

No computador de desenvolvimento:

```powershell
npm run apk
```

O APK é disponibilizado em `artifacts/android/weldcosta-release.apk`.

## Verificação realizada

- TypeScript do aplicativo, lint, build compartilhado/API e exportação web.
- Testes unitários de persistência interrompida, espaço insuficiente, isolamento por conta, restauração da fila, assinatura offline, sincronização parcial, validação e conflito.
- 34 testes de integração com PostgreSQL isolado: criação/atualização idempotente nos seis tipos, fotos e fluxos existentes da API/PDF.
- Teste do navegador com interface real, armazenamento real e API simulada: preparar catálogos, desligar a API, preencher EVD com duas fotos, reabrir a página em nova instância JavaScript, recuperar campos e prévias, reconectar e confirmar um relatório com dois uploads vinculados ao ponto correto.
- O mesmo teste verifica prévias do relatório sincronizado sem rede, envio automático de rascunho fechado e conflito sem sobrescrever o servidor antes da confirmação.

O APK não foi compilado nem validado em aparelho físico nesta verificação. Nenhuma implantação ou alteração no banco de produção foi executada.

## Confirmação de salvamento e responsáveis sem internet — 05/11/2026

- O botão final de salvar confirma no próprio card quando a gravação local termina. Salvar offline retorna um resultado próprio, sem exigir um relatório já criado no servidor. A confirmação também cobre perda de conexão durante o envio após a gravação local.
- O salvamento manual indica andamento; o aviso no início do formulário mostra o horário da última gravação. Falhas reais de armazenamento exibem orientação simples e retiram a mensagem de sucesso.
- A lista calcula a situação pelos rascunhos atuais: não mantém “Tudo sincronizado” quando há preenchimentos pendentes. Falta de internet não aparece como pendência de correção.
- A preparação automática/manual inclui pessoas e assinaturas para quem tem acesso à lista de pessoas. A busca offline funciona por nome, empresa ou registro, com paginação e filtro de disponibilidade, isolada por conta.
- Sem pessoas guardadas, a janela orienta a preencher os responsáveis diretamente no relatório. O cadastro geral de pessoas fica disponível com conexão. Mensagens de conexão não expõem “API” ou endereço do servidor.
- Validação desta revisão: 36 testes de cache de pessoas, preparação, fila e sincronização; TypeScript, lint e exportação web. Interface real no navegador com rede interrompida: selecionar pessoa preparada, salvar com confirmação no final, reabrir o rascunho e recuperar o responsável, pesquisar sem resultado e simular falta de espaço seguida de nova tentativa bem-sucedida. Armazenamento real do navegador e API simulada; aparelho físico não validado.

Esta revisão altera o cliente. Para o APK, gere e instale a atualização; a API não precisa de alteração adicional. O painel web exige nova publicação para receber o mesmo comportamento.
