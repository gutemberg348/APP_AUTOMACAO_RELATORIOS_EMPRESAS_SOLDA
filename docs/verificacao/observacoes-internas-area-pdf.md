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

Atualizar os containers na VPS para aplicar aos PDFs gerados pelo servidor. Os PDFs já baixados/finalizados permanecem como foram gerados: criar uma nova prévia para conferir o novo layout. Atualizar o app/Expo para receber os textos novos de orientação. Nenhuma migração de banco adicional nesta alteração.
