# Verificação do editor técnico — 08/10/2026

Conferência posterior da correção de arraste e do fluxo em três etapas: [formulário simplificado](./formulario-simplificado.md).

- Referências EVS/LP conferidas: malha isométrica de tubulações e desenho ortogonal de estrutura, com números compartilhados pelas evidências fotográficas.
- 28 testes unitários: schemas, workflow, storage e geometria do desenho; eixos, malha, movimentação limitada à prancha, seleção, próxima numeração e escape de texto em SVG.
- 13 testes de integração em PostgreSQL/storage temporários: cinco tipos de PDF, persistência atômica de pranchas/pontos, IDs estrangeiros, números ambíguos, versão concorrente, permissões, bloqueio após finalização e edição dos vínculos/legendas das imagens.
- Fluxo via navegador: duas pranchas criadas pela interface, tubulação isométrica, estrutura ortogonal, válvula, cota, identificação textual, criação automática de pontos e marcação de ponto existente; desfazer/refazer, numeração manual, fotos associadas, revisão, aprovação e PDF final.
- Tela cheia conferida em desktop e 390px, incluindo inserção por toque emulado, seleção/arraste de texto e controles de zoom dentro da largura disponível. O gesto permanece estável durante as atualizações da tela.
- Reabertura e duas alterações de numeração após salvar passaram. A etapa atual foi mantida e o histórico de desfazer foi reiniciado após a gravação. A edição de legenda e a troca do ponto vinculado à foto foram confirmadas no banco temporário.
- A ordem das pranchas foi gravada, invertida e conferida novamente pela API. A migration de ordem foi aplicada no PostgreSQL local pelo Docker, preservando registros existentes.
- O PDF da conferência contém 7 páginas. Extração de texto confirmou os títulos dos desenhos, cota de 1.500 mm, identificação da linha, ponto S-01, descontinuidade e referência às duas pranchas. Desenhos renderizados foram inspecionados visualmente.
- A tela final mobile passou na análise axe dos critérios WCAG 2 A/AA e 2.1 AA, sem violações detectadas. A verificação automática é pontual.
- Build, TypeScript e ESLint passaram. O Chromium do container gerou um PDF vetorial de conferência em memória, sem gravar registros ou arquivos no ambiente principal.
- A exportação Expo para web, Android e iOS passou após a correção dos gestos de seleção e arraste.

Capturas e documentos em `docs/verificacao/report-pdf-drawing-*.png` e `report-drawing-*-pdf-page.png` são artefatos locais ignorados pelo Git. Os testes não inserem registros fictícios no banco principal.

Execução em aparelho físico e importação de arquivos DWG/DXF não fazem parte desta verificação. O editor registra croquis sem escala; as cotas são valores informados pelo usuário.
