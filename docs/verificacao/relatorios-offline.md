# Relatórios e fotos sem internet

Implementação de 04/11/2026. Vale para os seis tipos: EVS, EVD, LP, TH, ME e RDO.

## Como usar no telefone

1. Entre na conta com internet. Em **Relatórios → Relatórios neste telefone**, toque em **Preparar empresas e obras para uso offline** e espere a confirmação.
2. Para levar um relatório existente com suas imagens, abra-o com internet e toque em **Guardar relatório e fotos para uso offline**.
3. Sem conexão, escolha uma empresa/obra preparada e preencha o relatório. Dados, desenhos, fotos selecionadas e assinaturas ficam no armazenamento privado do telefone. O formulário salva as alterações localmente e também oferece **Salvar no telefone**.
4. Os rascunhos reaparecem em **Relatórios neste telefone** ao fechar e abrir o app. Eles pertencem à conta e ao endereço da API usados no preenchimento.
5. Com o app aberto, a reconexão sincroniza os rascunhos que não estão em edição. No formulário aberto, toque em **Sincronizar**. Se o app estiver fechado, a sincronização espera a próxima abertura.

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
