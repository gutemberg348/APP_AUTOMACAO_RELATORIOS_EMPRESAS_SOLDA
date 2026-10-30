# Imagem na folha, recorte e detalhes das fotos - 30/10/2026

## Comportamento

- Segurar uma imagem mostra o atalho de recorte ao lado da chave de ajustes. Recortar também aparece nas opções contextuais e nas propriedades da imagem.
- O recorte tem quatro cantos para arrastar, área central móvel, cancelamento e restauração da imagem inteira. O arquivo original e seu vínculo de mídia são preservados; somente coordenadas de recorte são salvas no JSON do desenho. Desfazer também restaura o enquadramento anterior.
- Preencher folha muda o desenho para a mesma proporção vertical da área de impressão e leva a imagem até suas bordas, preservando a proporção e recortando o excedente. A imagem é enviada para trás dos pontos e dos demais elementos. O editor e o PDF usam o mesmo enquadramento.
- Formato da folha permite alternar entre a área horizontal anterior e a vertical do PDF. Elementos fora da área vertical continuam salvos e podem ser consultados ao retornar à horizontal. Desenhos antigos mantêm o formato anterior até a escolha de outro formato.
- O RDO usa uma página própria de desenho para uma folha vertical, em vez de reduzi-la ao quadro horizontal do resumo diário.
- Fotos dos pontos continuam inteiras em quadros 4:3 iguais, com margens quando a proporção da foto exigir. Não foi aplicado recorte automático nessas fotos.
- Na medição de espessura, as cinco linhas de leitura fixas foram substituídas pelas linhas dos pontos existentes. Campo de espessura vazio e espaço de segunda foto inexistente deixam de aparecer. Informações preenchidas, leituras zero, resultados negativos, notas e descontinuidades diferentes de cada ponto permanecem no PDF.
- Dados gerais dos modelos com página de identificação usam 22 px, espaçamento natural a partir do topo e continuação para textos extensos. Conteúdo curto não é distribuído até o rodapé.

## Verificação

- Build shared/API, typecheck do app, lint e exportação web aprovados.
- Suíte unitária de 236 testes aprovada durante a implementação; após a revisão dos detalhes de medição, os 23 testes dos cinco arquivos relevantes passaram, incluindo um novo caso para descontinuidades diferentes de pontos do mesmo lado.
- PostgreSQL 17 isolado: dois testes de integração aprovados. Cobrem LP com grupos e o salvamento/reabertura de recorte vertical, imagem original e pontos vinculados nos seis modelos. A geração real de PDF foi exercitada em cada um.
- Interface Chromium de celular: segurar imagem, mover cantos, cancelar, aplicar, desfazer, preencher folha, marcar ponto por cima da imagem, salvar/reabrir, restaurar imagem e conferir largura de 320 px. API simulada nesse roteiro.
- PDFs reais dos seis modelos: proporção da folha igual à área de desenho impressa, imagem até a borda, todas as fotos preservadas, quadros 4:3 e nenhuma invasão de página. Testados também conteúdos extensos, registros de EVD e descontinuidades de LP.
- Renderizações rasterizadas inspecionadas: desenho com imagem preenchida, identificação e fotos de medição. Evidências em `artifacts/drawing-crop-pdf/`, `artifacts/drawing-crop-long/` e `artifacts/drawing-image-crop-mobile.png`.
- Não houve teste em aparelho físico nem geração de APK, push ou deploy.

## Publicação

Atualizar API/web na VPS e o aplicativo (novo APK ou recarregar Expo). Os campos novos ficam no JSON do desenho, sem migração adicional de banco nesta etapa. A API deve estar atualizada antes de salvar recortes pelo app novo. Gerar outra prévia para conferir; PDFs já baixados não são modificados.

Depois de enviar os arquivos ao Git:

```bash
cd /var/www/solda/APP_AUTOMACAO_RELATORIOS_EMPRESAS_SOLDA
git pull origin master &&
npm run docker:production:check &&
npm run docker:production
```

No computador: `npm run apk`.
