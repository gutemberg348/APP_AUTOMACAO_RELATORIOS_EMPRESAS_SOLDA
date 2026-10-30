# Auditoria das alterações — 30/10/2026

## Resultado e correções

Revisão do código alterado, testes de toda a suíte, fluxos de interface em navegador e geração real de PDFs. Nenhum dado de produção foi acessado ou alterado.

Encontrado e corrigido um erro real no tratamento de alterações concorrentes: o adaptador PostgreSQL pode devolver `DriverAdapterError` ao confirmar uma transação, em vez do erro Prisma `P2034`. A proteção do último administrador continuava funcionando, mas a segunda operação podia retornar erro interno. Agora os conflitos reconhecidos retornam HTTP 409 e orientação para atualizar e tentar novamente. Não há repetição automática da gravação nem relaxamento das permissões. Quatro testes unitários cobrem os formatos de conflito e impedem que outros erros sejam disfarçados.

Corrigidos testes de integração antigos para permitir uma auditoria completa:

- Import do codificador de upload resolve o Expo instalado no workspace do app.
- Fixtures de cadastro informam o número obrigatório; testes de número ausente permanecem ativos.
- Contagem do painel considera os relatórios realmente criados no banco de teste.
- Fotos sintéticas do EVS e EVD são distintas; a validação que bloqueia reutilização entre pontos/relatórios permanece ativa.
- Testes gerais de PDFs e status percorrem os seis tipos do registro compartilhado, incluindo EVD.

## Verificações automáticas

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Shared e API compilados |
| `npm run typecheck` | API, app e shared aprovados |
| `npm run lint` | Aprovado no projeto inteiro |
| `npm test` | 231 testes em 39 arquivos aprovados |
| `npm run test:integration` | 47 testes em 7 arquivos aprovados |
| `npm run test:deployment` | 9 testes aprovados |
| `npm run export:web --workspace @weldcosta/app` | Exportação concluída |
| `npm run apk:check` | JDK 17, Android SDK e URL de produção reconhecidos |
| `git diff --check` | Sem erros de whitespace |

Integração usa PostgreSQL 17 descartável, aplica as 11 migrações e o seed, e remove o ambiente ao terminar. Foram exercitados autenticação, sessões, usuários, último administrador, acesso por empresa, operador limitado aos próprios relatórios, pessoas/assinaturas, tutoriais, versões concorrentes, status, fotos, pontos/desenhos e PDFs. Houve avisos de sourcemaps do Expo e depreciação de chamadas do driver pg; não impediram os testes.

## Interface e desenho

Automação no Chromium com interface de celular e API simulada; não substitui testes nativos:

- LP: dimensão ausente, edição e criação de grupos de soldas, sugestão do próximo número, seletores de materiais, descrições personalizadas, salvamento e vínculo original da foto.
- EVD: escolha do modelo, dados diretos, registros de inspeção em acordeão, salvamento e PDF com aviso. Erro localizado no segundo registro abre esse registro por Corrigir sem perder edições.
- EVS, LP, TH, ME e RDO: salvar rascunho parcial e solicitar PDF com aviso; EVD também coberto no fluxo próprio.
- Lápis: traços curtos consecutivos, curva com 100 amostras, ausência de risco acidental por toque e desfazer. Folha de observações aceita traço/texto colorido, fecha/reabre e persiste separadamente.
- Conta-gotas: botões compactos, abertura visível do seletor, quatro posições amostradas iguais aos pixels da prévia e cor preservada ao pintar/salvar.
- Seleção: controles contextuais após soltar, espessura/cor/pontilhado, ocultação durante arraste e folha sem deslocamento. Painel dentro dos limites em 320 px.
- Laço: seleção real, quatro cantos para redimensionar, exclusão de objeto/bloco, menu de limpeza sem seleção e desfazer.
- Fotos: duas de uma vez, mesma foto nos dois espaços da própria ficha, bloqueio em outro ponto e preservação dos itens válidos de um lote parcialmente rejeitado.
- Anotação de fotos: prévia, marcador translúcido, borracha parcial, desfazer, reabertura e cancelamento sem perder anotações anteriores. Salvar preserva foto original, vínculo e legenda.

Um roteiro antigo de desenho ainda procurava o botão removido “Editar seleção”. Sua falha de localização não foi contabilizada como aprovação; os controles contextuais atuais foram verificados pelo roteiro específico e pelo teste de laço/redimensionamento/lixeira.

## PDF

Gerados PDFs reais no Chromium para EVS, EVD, LP, TH, ME e RDO, com fotos retrato, paisagem, quadradas e panorâmicas. Quadros iguais em 4:3, incluindo uma foto isolada. Imagens inteiras por `contain`, sem corte ou distorção; margens brancas são esperadas quando a proporção da foto difere do quadro.

Conferidos área útil próxima de 89% da folha, fontes ampliadas, paginação, preservação das fotos e ausência de notas internas digitadas/desenhadas. Laudos e observações formais permanecem no PDF. Dados extensos e continuações foram testados nos seis tipos; LP também com 25 descontinuidades e EVD com registros próprios. Renderizações rasterizadas foram inspecionadas, incluindo a página de Dados Gerais do LP.

Evidências locais ignoradas pelo Git: `artifacts/pdf-layout-90/`, `artifacts/lp-faithful/`, `artifacts/visual-direct/`, `artifacts/audit-pdf-contact.png` e capturas de interface em `docs/verificacao/`.

## Limites e publicação

- Não foi gerado APK nem feita instalação em aparelho físico. Teclado nativo, gestos multitoque, vibração e desempenho real em Android/iOS precisam de conferência no dispositivo.
- A VPS não foi acessada e nenhum deploy ou push foi realizado.
- O `.env.production` não existe neste checkout. Por isso `npm run docker:production:check` local pede a configuração; não se criou um arquivo de produção fictício. Testes dos scripts de publicação passaram, mas não houve rebuild das imagens Docker de produção nesta auditoria.
- Há alterações em API/shared/app. Para publicar o conjunto, atualizar API/web na VPS e instalar novo APK ou recarregar o Expo. PDFs antigos já baixados não mudam; gerar novamente.

Depois de enviar os arquivos ao Git, na VPS:

```bash
cd /var/www/solda/APP_AUTOMACAO_RELATORIOS_EMPRESAS_SOLDA
git pull origin master &&
npm run docker:production:check &&
npm run docker:production
```

No computador, para gerar o aplicativo atualizado: `npm run apk`.

## Revisão complementar das alterações posteriores

Escopo: recorte e preenchimento da folha, medições por foto, PDF ME sem linhas vazias, legibilidade e pressão do teste no TH, persistência de LP/EVD e compatibilidade com relatórios antigos.

Encontrado e corrigido: ao adicionar uma lista de medições na primeira foto de um grupo ME, leituras antigas do cadastro podiam ficar ausentes do PDF. Agora continuam em “Leituras do cadastro”, separadas das medições da imagem. Teste de regressão reproduziu a falha antes da correção e passou depois, incluindo lista vazia, leitura antiga e resultado não aceitável.

A numeração de novos pontos na foto agora usa o estado mais recente dentro da atualização, protegendo contra números repetidos em toques rápidos enquanto a medição da posição está pendente.

Validação complementar:

- Build shared/API, typecheck de todos os workspaces, lint e export web passaram. Após as correções, build, typecheck do app e lint dos arquivos alterados passaram novamente.
- 242 testes unitários / 42 arquivos passaram.
- 4 testes de integração / 3 arquivos selecionados passaram: medições da foto, LP/grupos e recortes nos seis modelos, EVD. Não é uma nova execução de toda a suíte de integração.
- Navegador com API simulada: pontos, valores, zero/vazio, erro, mover, pintar, salvar/reabrir/excluir, recorte, desfazer, preenchimento da folha e largura de 320 px passaram.
- PDFs ME/TH gerados e conferidos; listas com 100 medições e campos técnicos longos sem transbordamento. Caso misto de leitura antiga e nova conferido visualmente em `artifacts/photo-measurements-audit/`.
- Sem teste em aparelho físico, geração de APK ou publicação na VPS nesta revisão.

## PDFs de relatórios já existentes

O download final agora renderiza os dados salvos com o template atual, em vez de devolver diretamente o último arquivo arquivado. Isso aplica as melhorias de apresentação também aos relatórios finalizados antes da atualização. Os PDFs arquivados, dados, status e versão do relatório permanecem intactos. Rascunhos continuam usando a geração de prévia atual.

PDFs já baixados no dispositivo não mudam: é necessário baixar novamente após atualizar a API na VPS. Campos novos sem preenchimento e escolhas de recorte/preenchimento de imagem não são inventados nem aplicados retroativamente aos dados. Esta correção de download não exige outro APK.

Validação: build shared/API, lint dos arquivos envolvidos, 16 testes unitários de PDF e 2 testes de integração passaram. A integração verificou o endpoint real com Chromium e banco isolado: PDF novo retornado com `no-store`, arquivo histórico preservado e dados/versão/status sem alteração. Os testes unitários cobrem os seis tipos e impedem servir PDF final de relatório reaberto como rascunho.
