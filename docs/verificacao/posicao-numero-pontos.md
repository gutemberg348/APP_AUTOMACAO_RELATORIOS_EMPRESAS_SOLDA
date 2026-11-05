# Posição do número no desenho

Alteração de 05/11/2026.

- Com **Selecionar**, arraste o número para mudar somente sua posição. Arrastar pela bolinha continua movendo o ponto junto com o número.
- Nas demais ferramentas que oferecem seleção por pressão, é necessário segurar por 2,5 segundos antes de mover. Começar um traço sobre outro objeto continua desenhando normalmente.
- Na chave junto do ponto selecionado, **Posição do número** oferece uma prévia para tocar/arrastar e os atalhos **Acima**, **Abaixo**, **Esquerda** e **Direita**. **Posição automática** restaura a disposição anterior.
- O deslocamento fica limitado a uma área de 72 unidades do desenho ao redor da bolinha. Essa medida acompanha o zoom. O número continua ligado ao mesmo ponto de inspeção, fotos e resultados.
- Os ajustes participam de desfazer/refazer e são gravados em `labelX`, `labelY` e `labelPosition: 'custom'`. Desenhos antigos conservam a apresentação anterior até o ajuste explícito.
- O SVG compartilhado do app e do PDF respeita a posição. A guia circular é uma opção exclusiva da seleção no editor e não entra na exportação.
- Ao manter uma marcação no desenho depois de remover seu ponto da inspeção, a posição personalizada do número é preservada.

Verificação: testes de geometria, seleção, renderização e persistência; TypeScript, lint e builds de API e aplicativo web. Interface testada em Chrome com viewport móvel e API simulada: arrastar número sem mover ponto, mover ponto preservando deslocamento, quatro atalhos, prévia interativa, desfazer/refazer e salvar. O teste também confere o SVG destinado ao PDF sem a guia. Não houve teste em aparelho físico nem geração de APK nesta alteração.

É necessário atualizar a API para aceitar e renderizar a posição personalizada e gerar um novo APK. Este ajuste não exige uma migração adicional de banco; usa o JSON do desenho já existente.
