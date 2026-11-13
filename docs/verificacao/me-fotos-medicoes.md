# Medição de espessura: fotos e leituras

Revisão de 13/11/2026 baseada nas quatro páginas do modelo REL-004 enviado e nas cinco páginas da prévia do aplicativo.

## Comparação e implementação

- Capa, identificação técnica e laudo final mantidos. Os campos de proprietário, obra, projeto, referência textual do desenho, ensaio, espessura de projeto, metal de base e norma já estavam disponíveis. Valores e assinaturas do modelo não são valores padrão.
- Removidos o editor de desenho e sua página no PDF do ME. Os dados antigos continuam armazenados.
- A etapa “Fotos e pontos de medição” permite selecionar várias fotos, visualizar e editar cada uma. As fotos ficam em duas colunas.
- Cada foto tem lado/parte, descontinuidade, aceitável e espessura de projeto editáveis. Toques na foto criam círculos numerados; cada círculo tem número, posição e leitura em mm editáveis.
- O PDF mostra os dados acima da foto e as leituras preenchidas abaixo, em linhas. Valores zero e resultados negativos são preservados. Pontos sem leitura não criam linhas de leitura vazias.
- Fotos de apoio sem informações ficam somente com a imagem, sem tabela inferior. Com dois registros principais e duas fotos de apoio, a composição ocupa uma folha de imagens, como no modelo.
- Cada trecho de tabela recebe até cinco leituras para manter o texto legível. Listas maiores continuam com a foto e a identificação, sem descartar medições. Há até dois pares de fotos por folha; o espaço restante fica embaixo.
- Fotografias preenchem o quadro, inclusive as verticais. Os círculos e as anotações são aplicados à cópia exportada; o original continua disponível.
- Fotos antigas dos pontos entram na galeria; seus resultados, leituras e notas continuam no PDF. Quando já existem leituras antigas e novas leituras na foto, as antigas são identificadas como “Leituras do cadastro”. Fotografias usadas exclusivamente pelo desenho ficam fora da galeria.
- As observações internas do desenho não aparecem no PDF. A atualização também vale ao gerar novamente relatórios antigos.
- Os novos detalhes ficam no JSON de anotações da foto; não há migração de banco.

## Verificação

- Typecheck dos três workspaces e ESLint dos arquivos alterados aprovados.
- 101 testes focados aprovados, incluindo regressão de TH/EVS, schema, preservação de dados e paginação em Chromium.
- Chromium: cenários com 0, 1, 4, 7 e 12 fotos; pares alinhados, texto legível, fotos sem transbordamento e nenhuma tabela de leitura para fotos de apoio. Conferida visualmente a folha com duas fotos numeradas, cinco/quatro leituras e duas fotos de apoio.
- PostgreSQL isolado: três testes aprovados. Envio em galeria sem pontos de cadastro, edição de dados/leituras, reabertura, geração de PDF e exclusão; compatibilidade com mídia antiga e download de relatório finalizado sem sobrescrever o arquivo histórico.
- Persistência local verificada com simulação de reinício: detalhes da foto, círculos, leituras e referência ao arquivo local são recuperados.
- Não houve instalação de APK nem teste físico em modo avião nesta revisão.

## Atualização

Depois de enviar o código ao repositório, na VPS:

```bash
cd /var/www/solda/APP_AUTOMACAO_RELATORIOS_EMPRESAS_SOLDA
git pull origin master
npm run docker:production
```

No computador, gere e instale o aplicativo atualizado:

```bash
npm run apk
```

Gere novamente os PDFs existentes após atualizar a API. Arquivos já baixados não se modificam sozinhos.
