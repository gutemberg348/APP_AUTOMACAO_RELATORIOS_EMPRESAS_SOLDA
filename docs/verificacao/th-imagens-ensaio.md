# Teste Hidrostático: comparação e galeria

Verificação de 13/11/2026, usando o PDF de referência `REL 005 - TH - TESTE HIDROSTATICO (1).pdf` e a prévia enviada pelo usuário.

## Comparação

| Parte | Resultado |
| --- | --- |
| Capa e identificação | Campos de cliente, obra, projeto, referência do desenho, material, procedimento, ART e norma já disponíveis. |
| Dados técnicos | Fluido, manômetro, certificado, aferição, série, temperatura, duração, equipamento, material, espessura e dimensão já disponíveis. |
| Pressões | Mantidas pressão de trabalho e pressão do teste separadas. O fabricante do equipamento também foi preservado. |
| Desenho | Removida a etapa do formulário TH e a página no PDF. A referência textual do desenho continua na identificação. |
| Imagens do ensaio | Galeria com seleção múltipla, duas imagens por linha e três linhas por página. Fotos consecutivas, sem reservar espaço para pontos vazios. |
| Laudo final | Mantidos conclusão, resultado e responsáveis. Observações internas do desenho não são impressas. |

Não foi identificado outro campo funcional ausente na comparação das cinco páginas do modelo. Os dados, datas e assinaturas do exemplo não foram copiados para os relatórios.

## Comportamento e compatibilidade

- Apenas TH mudou para a galeria. Os outros tipos mantêm suas próprias etapas e modelos.
- Nenhuma imagem: não gera página de imagens. De uma a seis: uma página. A sétima inicia outra página.
- Uma quantidade ímpar deixa apenas a última célula direita vazia; o espaço restante fica abaixo.
- Fotos antigas vinculadas aos pontos e fotos gerais aparecem na mesma galeria. Imagens usadas exclusivamente em desenhos ficam fora dela.
- Os desenhos e pontos antigos continuam armazenados; somente a cópia usada para gerar o PDF os omite.
- Prévia, PDF final e geração a partir de relatórios antigos usam o mesmo modelo atualizado.
- Legendas e anotações das fotos foram preservadas. A galeria reutiliza o envio e a fila local existentes.
- Não há alteração de banco de dados nesta entrega.

## Validação executada

- TypeScript de API, app e pacote compartilhado: aprovado.
- ESLint dos arquivos TypeScript alterados: aprovado.
- 46 testes focados: aprovados, incluindo ausência de observações internas, isolamento do TH, fotos antigas, paginação e layout em Chromium.
- Layout em Chromium com 0, 1, 3, 6, 7 e 13 fotos, incluindo imagens verticais e horizontais: seis por folha, sem transbordamento e espaço restante embaixo. Conferência visual das páginas com seis fotos e com uma foto.
- Integração em PostgreSQL isolado: criação do TH, envio de sete fotos (uma vinculada a ponto antigo), edição de legenda, exclusão e passagem de duas páginas para uma, preservando os pontos antigos: aprovado.
- Não foi instalado/testado APK em dispositivo físico nesta revisão. O funcionamento offline usa o fluxo existente e não foi testado em modo avião nesta revisão.

## Atualização

Após enviar o código ao repositório, na VPS:

```bash
cd /var/www/solda/APP_AUTOMACAO_RELATORIOS_EMPRESAS_SOLDA
git pull origin master
npm run docker:production
```

No computador, para atualizar a tela do aplicativo instalado:

```bash
npm run apk
```

Instale o novo APK. Após atualizar a API, gere novamente o PDF dos relatórios existentes; arquivos PDF já baixados não são modificados automaticamente.
