# Desenho centralizado e cabeçalho — 11/11/2026

Na geração do PDF, os templates EVS/EVD e o layout compartilhado por LP/TH/ME/RDO identificam o grupo de elementos do desenho. O Chromium mede o conteúdo real, incluindo símbolos, textos e números dos pontos, e centraliza o grupo dentro da área do desenho. O fundo e a malha continuam alinhados à folha. O desenho salvo não é alterado; as posições relativas, a numeração e os vínculos permanecem iguais. O tamanho é mantido quando o conteúdo cabe, com redução proporcional apenas se ultrapassar a área disponível. Imagens que preenchem a página mantêm o tamanho até as bordas.

O número do relatório fica em um elemento posicionado dentro da célula do cabeçalho. O tamanho da fonte é ajustado à altura real, evitando que números longos aumentem a primeira linha e empurrem página/data para fora do cabeçalho. Todo o texto é preservado.

Validação: 26 testes em quatro arquivos passaram, incluindo sete testes com Chromium real. EVS e LP foram conferidos com desenho deslocado, número de ponto em posição personalizada, texto e número de relatório `LINHA DEGUSTAÇÃO`. O centro do conteúdo coincide com o centro da área do desenho; as células do cabeçalho contêm o texto, inclusive com 100 caracteres. Também passaram os casos de desenho vazio, imagem ocupando toda a folha e três duplas de fotos por página em EVS/EVD. A renderização foi inspecionada em `artifacts/evs-photo-pagination/centered-drawing-header.png`. TypeScript dos três workspaces e ESLint passaram.

Atualizar a API aplica esses ajustes aos PDFs gerados novamente, incluindo relatórios antigos. Esses dois ajustes isolados não exigem novo APK.
