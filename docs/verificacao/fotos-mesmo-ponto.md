# Fotos em dois espaços do mesmo ponto

- A seleção e o upload permitem reutilizar a mesma imagem no mesmo ponto do mesmo relatório. Outro ponto, outro relatório ou anexo sem vínculo é bloqueado somente dentro da mesma obra. Outra obra pode reutilizar a foto, inclusive quando pertence à mesma empresa. A comparação usa o conteúdo do arquivo, independentemente do nome. Relatórios excluídos não bloqueiam o reaproveitamento.
- A API valida o contexto de acesso antes de permitir a exceção. Reatribuir uma foto também verifica se ela continua no mesmo ponto das outras cópias.
- A galeria e os arquivos permitem selecionar as duas imagens de uma vez quando os dois espaços estão vazios. A seleção entra em ordem no ponto aberto. Com um espaço ocupado, o seletor aceita uma imagem.
- Uma foto recém-selecionada pode preencher também o espaço ao lado pelo botão **Usar esta foto também ao lado**. A cópia recebe um identificador próprio.
- O progresso identifica cada arquivo do lote. Falhas parciais preservam as imagens válidas e mostram quais devem ser selecionadas novamente.
- Cada envio leva um identificador estável: repetir a tentativa depois de perder a resposta da API devolve a imagem já gravada, sem criar outra cópia involuntária.

## Escopo por obra e erros no EVD - 30/10/2026

O bloqueio anterior era global na API e nos rascunhos do app. Agora a consulta do hash filtra pelo `projectId` do relatório e ignora relatórios excluídos. Upload e alteração de vínculo usam a obra salva no servidor, sem confiar em uma obra enviada pelo cliente. A pré-verificação recebe a obra antes do primeiro salvamento e valida seu acesso. Clientes antigos que não informam relatório nem obra deixam a conferência para o upload, evitando uma recusa global indevida.

Os rascunhos guardam a obra para comparar fotos pendentes somente dentro do mesmo projeto. Uma repetição no mesmo ponto continua permitida. No salvamento, a falha conserva o código `DUPLICATE_MEDIA`, o número do ponto e o nome da imagem. O botão Corrigir abre o ponto indicado e explica qual foto trocar, com a regra de repetição por obra; as fotos pendentes e demais dados continuam recuperáveis.

Validação: build shared/API, typecheck do app, exportação web, lint e 284 testes unitários passaram. Outros 24 testes de integração em dois arquivos passaram com PostgreSQL isolado e Chromium real, incluindo EVD: repetição em duas obras da mesma empresa e em outra empresa, duas fotos iguais no mesmo ponto, bloqueio em outro ponto/relatório da mesma obra, pré-verificação antes de salvar, reenvio idempotente, upload simultâneo em obras diferentes, proteção contra obra forjada, edição da legenda, geração de PDF e reaproveitamento após excluir o relatório anterior. Não houve publicação na VPS nem teste em aparelho físico.

Publicação desta correção: atualizar API e painel na VPS com `npm run docker:production` e gerar/instalar outro APK com `npm run apk` no computador. A mudança no APK é necessária porque a conferência de rascunhos também era global no cliente. Não há migração adicional de banco.

## Publicação

A migração `202610180001_same_point_photos` substitui o índice global único da foto por um índice de busca e adiciona a chave de tentativa de envio. Os registros existentes são preservados. Upload e reatribuição usam bloqueio transacional por hash para impedir duas requisições simultâneas de associarem a mesma foto a pontos diferentes.

Atualizar a API e executar as migrações antes de usar o app atualizado. O fluxo `npm run docker:production` executa `db:deploy` no container. Não aplicar apenas a alteração do app contra a API antiga.

## Verificação

- 128 testes unitários passaram, incluindo seleção local, permissões de acesso, upload, alteração de vínculo, repetição no mesmo ponto e tentativa de reenvio.
- TypeScript, ESLint dos arquivos alterados e build da API aprovados.
- Navegador com API simulada, viewport 390 × 844: escolha de duas fotos na galeria, repetição ao lado, bloqueio entre pontos antes de salvar, lote com falha parcial e salvamento de três imagens nos dois pontos corretos.
- Adicionado teste de integração PostgreSQL para migração, repetição, reenvio e concorrência entre relatórios. Não executado: Docker Desktop local desligado. Nenhuma alteração na base local ou na VPS.
- Galeria e câmera em aparelho físico ainda precisam de conferência.
