# Observações internas e área útil do PDF - 30/10/2026

## Comportamento

- As observações do desenho (`notes` e `notesDrawing`) continuam salvas e disponíveis no app, mas não são exportadas para o PDF de nenhum dos seis tipos: EVS, EVD, LP, TH, ME e RDO. O desenho principal, seus textos e marcações continuam sendo impressos.
- Laudos, observações formais do teste hidrostático/RDO, legendas das fotos e resultados de inspeção continuam nos campos próprios do relatório. A mudança refere-se à folha de observações internas do desenho mostrada pelo usuário.
- O campo e a orientação da ferramenta de anotação agora explicam que as observações são internas ao app.
- A4 com margem de 7 mm, quadro de 196 x 283 mm: aproximadamente 89% da área total da folha. O gerador e o CSS compartilham a mesma geometria.
- Fontes ampliadas nos títulos, dados técnicos, cabeçalhos, tabelas, fotos, laudos, assinaturas e rodapés. Atualização de 30/10: dados técnicos de identificação usam 22 px e espaçamento natural a partir do topo; conteúdo curto pode deixar espaço abaixo. O conteúdo extenso continua em novas páginas.
- Desenhos deixam de ser reduzidos para abrir espaço para a folha de observações; fotos mantêm o padrão 4:3 e a imagem completa.

## Verificação

- Build shared/API, typecheck do app, exportação web e ESLint dos arquivos alterados aprovados.
- 41 testes unitários aprovados em cinco arquivos, incluindo ausência das observações internas nos seis templates, preservação dos dados no app, presença do desenho principal e manutenção do laudo formal.
- PDFs reais dos seis tipos gerados no Chromium e rasterizados com PyMuPDF; conferidos visualmente cabeçalhos, identificação, fotos, tabelas e conclusões.
- Conferência automática da área útil entre 88% e 90%, fontes da identificação, quadros iguais em 4:3, presença de todas as fotos, ausência do conteúdo interno e quantidade de folhas físicas igual à paginação do relatório.
- Campos de identificação/conclusão extensos, tabelas de LP com descrições longas e EVD com 23 registros extensos: marcadores finais preservados e nenhum bloco ultrapassando a folha.
- Interface no navegador em tamanhos de celular: folha interna abre, permite escrita e texto colorido, fecha/reabre e preserva as observações ao salvar, separadas do desenho principal (API simulada).
- Evidências locais em `artifacts/pdf-layout-90/`.

## Publicação

Atualizar os containers na VPS para aplicar aos PDFs gerados pelo servidor. O download dos relatórios finalizados também gera uma cópia pelo template atual; arquivos já baixados precisam ser baixados novamente. Nenhuma migração de banco adicional nesta alteração.

## Reforço na geração e abertura de arquivos

O serviço de PDF remove `notes` e `notesDrawing` de uma cópia do relatório antes de validar/renderizar qualquer template. A exclusão é comum à prévia, à geração final e ao download de finalizados; os campos originais continuam salvos para o app. Notas internas incompletas também deixam de bloquear a exportação do desenho principal.

O app usa um caminho de cache exclusivo para cada PDF recebido. Reutilizar e sobrescrever a mesma URI podia permitir ao visualizador/compartilhamento reutilizar uma cópia anterior. Para receber essa mudança no APK instalado é necessário gerar e instalar outro APK; no Expo, recarregar o bundle atualizado.

Validação do reforço: build shared/API, typecheck do app e lint passaram; 41 testes específicos cobrem os seis tipos e os três caminhos do serviço, a preservação das notas e arquivos novos no celular, inclusive downloads no mesmo milissegundo. O teste do visualizador usa mocks de sistema de arquivos/compartilhamento; não houve verificação em aparelho físico nem publicação na VPS.

Dois testes de integração também passaram com banco isolado e Chromium real. O download de um relatório finalizado gerou outro PDF, preservou o arquivo histórico e manteve texto e desenho das observações disponíveis na consulta do relatório pelo app.
