# Fotos em dois espaços do mesmo ponto

- A seleção e o upload permitem reutilizar a mesma imagem no mesmo ponto do mesmo relatório. Outro ponto, outro relatório ou anexo sem vínculo continua bloqueado. A comparação usa o conteúdo do arquivo, independentemente do nome.
- A API valida o contexto de acesso antes de permitir a exceção. Reatribuir uma foto também verifica se ela continua no mesmo ponto das outras cópias.
- A galeria e os arquivos permitem selecionar as duas imagens de uma vez quando os dois espaços estão vazios. A seleção entra em ordem no ponto aberto. Com um espaço ocupado, o seletor aceita uma imagem.
- Uma foto recém-selecionada pode preencher também o espaço ao lado pelo botão **Usar esta foto também ao lado**. A cópia recebe um identificador próprio.
- O progresso identifica cada arquivo do lote. Falhas parciais preservam as imagens válidas e mostram quais devem ser selecionadas novamente.
- Cada envio leva um identificador estável: repetir a tentativa depois de perder a resposta da API devolve a imagem já gravada, sem criar outra cópia involuntária.

## Publicação

A migração `202610180001_same_point_photos` substitui o índice global único da foto por um índice de busca e adiciona a chave de tentativa de envio. Os registros existentes são preservados. Upload e reatribuição usam bloqueio transacional por hash para impedir duas requisições simultâneas de associarem a mesma foto a pontos diferentes.

Atualizar a API e executar as migrações antes de usar o app atualizado. O fluxo `npm run docker:production` executa `db:deploy` no container. Não aplicar apenas a alteração do app contra a API antiga.

## Verificação

- 128 testes unitários passaram, incluindo seleção local, permissões de acesso, upload, alteração de vínculo, repetição no mesmo ponto e tentativa de reenvio.
- TypeScript, ESLint dos arquivos alterados e build da API aprovados.
- Navegador com API simulada, viewport 390 × 844: escolha de duas fotos na galeria, repetição ao lado, bloqueio entre pontos antes de salvar, lote com falha parcial e salvamento de três imagens nos dois pontos corretos.
- Adicionado teste de integração PostgreSQL para migração, repetição, reenvio e concorrência entre relatórios. Não executado: Docker Desktop local desligado. Nenhuma alteração na base local ou na VPS.
- Galeria e câmera em aparelho físico ainda precisam de conferência.
