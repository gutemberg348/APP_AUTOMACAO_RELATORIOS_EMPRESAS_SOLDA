# Medidas nas reduções do desenho — 11/11/2026

Ao selecionar uma redução, os ajustes junto ao objeto e o painel completo oferecem **Medida 1** e **Medida 2**. Os campos aceitam valores digitados, inclusive frações e unidades, com até 20 caracteres cada. Ao preencher os dois, o símbolo exibe o texto `2 × 4`, por exemplo. O texto aparece abaixo por padrão, com tamanho ajustável de 10 a 40, botões para as quatro direções, retorno à posição automática e uma prévia para arrastar a posição ao redor da redução. Também é possível arrastar o texto diretamente na área de desenho após selecionar o objeto.

As medidas são armazenadas no próprio símbolo (`reduction`), com deslocamento local e tamanho. Acompanham movimento, rotação e escala. Cor e impressão usam o mesmo renderizador vetorial do componente. A seleção e o laço incluem a área do texto. O recurso atende a redução original e às oito variantes isométricas. Símbolos antigos continuam válidos; campos parcialmente preenchidos não impedem salvar rascunhos. Não há migração de banco.

Validação:

- 114 testes de medidas, símbolos, seleção e desenhos passaram, incluindo salvamento/reabertura em JSON, valores incompletos após limpeza do rascunho, arraste em símbolo girado/ampliado, limites da posição, texto escapado, cor e renderização SVG usada pelo PDF.
- TypeScript dos três workspaces, ESLint e exportação web passaram.
- Navegador com API simulada: seleção pela lista, entrada `2` e `4`, aumento do texto para 20, arraste da posição na prévia e salvamento passaram no painel normal e em tela cheia, sem erros JavaScript. Captura em `artifacts/symbol-references/reduction-controls.png`.

Não foi validado em aparelho físico. Atualizar API/web e gerar/instalar outro APK para utilizar os novos dados e controles.
