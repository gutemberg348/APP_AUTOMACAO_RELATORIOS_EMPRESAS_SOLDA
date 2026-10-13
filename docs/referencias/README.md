# Materiais de base

Os cinco PDFs originais em `materiais_base/` foram preservados. Todos são digitalizações sem camada de texto. As **25 páginas** foram renderizadas e conferidas visualmente na fase inicial. As imagens de conferência são artefatos locais ignorados pelo Git.

| Arquivo original                                      | Páginas reais | Tipo | Estrutura observada                                                                                                                                                                     |
| ----------------------------------------------------- | ------------: | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REL- 001 ENDOSCOPIA.pdf`                             |             8 | EVS  | Capa cliente/fábrica; identificação e normas; duas páginas de desenho isométrico; fotos por solda com número, dimensão, descontinuidade e aceitabilidade; laudo, legenda e assinaturas. |
| `REL 002 - LIQUIDO PENETRANTE ( LP).pdf`              |             6 | LP   | Capa; identificação com metal de adição; desenho; fotos por solda; dados gerais, materiais e descontinuidades; laudo, resultado e assinaturas.                                          |
| `REL 005 - TH - TESTE HIDROSTATICO.pdf`               |             5 | TH   | Capa cliente/local; identificação, desenho de referência, norma do material e ART; dados do teste, manômetro e dados gerais; fotos; observação, resultado e assinaturas.                |
| `REL-004 - MODELO DE REL DE MEDIÇÃO DE ESPESSURA.pdf` |             4 | ME   | Capa; identificação e espessura de projeto; fotos com pontos numerados e leituras; laudo, resultado e assinaturas.                                                                      |
| `RDO.pdf`                                             |             2 | RDO  | Duas referências de ficha diária: cabeçalho compacto, dados da inspeção, foto/observação e visto opcional. Não exige laudo, croqui ou pontos.                                           |

## Mapeamento implementado

- Identificação, normas, processo e material: `Report.specificData`, validado pelo schema separado de cada tipo em `packages/shared/src/schemas/reports/`.
- Cliente e obra do sistema: `Company → Project → Report`; textos de proprietário, fábrica e referência de projeto do documento permanecem específicos por tipo.
- Número, título, data e fluxo de aprovação: campos comuns de `Report`. O número é texto livre, sem sequência global nem unicidade global.
- Soldas e medições: `ReportPoint`, editados no formulário e persistidos junto do relatório, com dimensão, leitura/unidade, lado, descontinuidade, aceitabilidade e observações.
- Fotos vinculadas ao relatório/ponto/seção: `ReportMedia`, upload autenticado, validação de imagem, limite de tamanho e deduplicação SHA-256. Fotos e croquis anexados como imagem entram no PDF.
- Desenhos editáveis: `ReportDrawing.data` e contrato `DrawingData`; editor SVG com malha isométrica/ortogonal, trechos, símbolos, textos, cotas informadas e pontos numerados vinculados à inspeção. As pranchas entram como vetores no PDF. Veja [desenhos técnicos](../desenhos-tecnicos.md).
- Responsáveis: `ReportSignature`, com edição de função, nome, registro e data; não se importaram nomes, registros ou imagens dos exemplos. O PDF reserva espaço para assinatura, sem assinatura digital.
- Laudo e resultados: campos próprios dos schemas. Códigos de descontinuidade são informados manualmente; não há diagnóstico automático.
- Cabeçalho, logo, número, paginação e rodapé: templates HTML/Puppeteer próprios para os cinco tipos, sem copiar dados, contatos, assinaturas ou imagens dos exemplos. Campos e seções seguem as referências; paginação acompanha o conteúdo gerado.

## Conferências necessárias para os templates finais

1. O LP tem seis páginas físicas, mas seus cabeçalhos indicam sete e pulam uma página. A paginação final deve ser calculada pelo documento gerado.
2. A legenda do LP repete `FF` para descrições diferentes e distribui a indicação de recomendação complementar em linhas separadas. Não se adotou um significado automático para esses códigos.
3. A legenda EVS também apresenta códigos repetidos em descrições distintas. O schema mantém a descontinuidade manual, sem catálogo técnico inventado.
4. O RDO inclui uma referência com marca diferente no cabeçalho. A identidade do sistema é Weldcosta; o outro cabeçalho não será reproduzido.
5. Os exemplos não definem quais campos são obrigatórios em cada situação. `ReportType.config.submissionRequiredKeys` permite configurá-los após validação técnica.

Os PDFs são referências internas, não são servidos pela API nem incluídos na imagem Docker. Nenhum dado deles foi inserido no seed ou usado como registro de produção. Consulte `manifest.json` para tamanho, número de páginas e SHA-256 de cada original.
