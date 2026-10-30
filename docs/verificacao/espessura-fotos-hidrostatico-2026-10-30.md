# Medições nas fotos e legibilidade do Teste Hidrostático

## Comportamento

- ME: em cada foto do ponto, “Marcar pontos / valores na foto” abre a imagem inteira. Toques adicionam círculos numerados; cada círculo tem número editável e espessura em mm. Aceita vírgula decimal, zero e valor vazio. Números repetidos na mesma foto são rejeitados.
- “Mover ponto” volta à foto para reposicionar; excluir remove apenas aquela marca/medição. Pintar/anotar continua disponível e preserva os valores ao voltar. Salvar pontos prepara as alterações; salvar o relatório grava na API.
- Dados armazenados em `ReportMedia.annotations.measurements`, com coordenadas relativas à foto. Original preservado; SVG e PDF compõem os círculos na exportação. Nenhuma migração adicional nesta alteração.
- PDF ME: cada foto recebe suas próprias leituras preenchidas; valores vazios não criam linhas. Fotos adicionais sem leituras aparecem sem tabela abaixo. Fotos continuam completas, com quadros iguais em 4:3 e possíveis faixas para preservar a proporção. Até seis leituras por bloco; listas maiores continuam em outro bloco com a foto de referência.
- Dados antigos de leitura e observações continuam sendo apresentados quando não há lista de medições na foto. Campos realmente preenchidos de espessura/dimensão/descontinuidade são preservados.
- PDF ME: leituras 15 px, metadados 14 px, laudo 20 px e assinaturas 14 px.
- TH: layout técnico com rótulo/valor na mesma célula, alinhamento à esquerda, valores pretos 16 px, rótulos em negrito 14 px, títulos 22 px. Pressão do teste é um novo campo opcional separado de pressão de trabalho. Fabricante anterior permanece disponível e é impresso quando preenchido. Textos longos têm continuação integral.

## Verificação

- Build shared/API, typecheck do app, lint e export web passaram.
- Suíte de 240 testes unitários passou; depois, 10 testes direcionados (incluindo novo teste TH) passaram.
- Integração isolada: upload, alteração e reabertura de medições da foto, validação de duplicidade sem alteração dos dados, original preservado e PDF real passaram.
- Navegador com API simulada: marcar, mover, vírgula decimal, zero, vazio, mensagem de erro, ida/volta da pintura, 320 px, salvar/reabrir e excluir passaram.
- PDFs gerados em Chromium e renderizados para inspeção visual: ME com nove leituras e duas fotos de apoio; teste de paginação com cem leituras; TH com dados técnicos numa página e valores longos em continuação. Sem conteúdo além da área de impressão.
- Não testado em aparelho físico iOS/Android. APK e implantação não executados.

## Atualização

Há alteração no app e na API. Depois de publicar o código, reconstruir os containers da VPS e gerar novo APK. PDFs já baixados precisam ser gerados novamente.

```bash
cd /var/www/solda/APP_AUTOMACAO_RELATORIOS_EMPRESAS_SOLDA
git pull origin master &&
npm run docker:production:check &&
npm run docker:production
```

No PC: `npm run apk`.
