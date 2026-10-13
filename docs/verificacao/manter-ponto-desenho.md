# Remover da lista mantendo no desenho

Excluir um ponto da lista de soldas/medições oferece três escolhas quando há marcações vinculadas: **Manter no desenho**, **Remover também do desenho** e **Cancelar**. A confirmação explica que os dados e as fotos do ponto serão removidos ao salvar.

Manter converte cada marcação vinculada em uma marcação independente (`marker` no JSON do desenho). O número, coordenadas, posição da etiqueta e aparência ficam preservados, sem referência ao ponto excluído. O desenho não depende de manter um cadastro oculto na lista. A marcação pode ser selecionada, movida, renumerada e removida no editor; limpar traços preserva as marcações. Ela permanece na mesma posição e numerada no PDF.

O schema compartilhado aceita o elemento independente. A API mantém as verificações de referências dos pontos vinculados e salva o desenho atualizado junto da exclusão do ponto e das fotos confirmadas. Não há migração de banco ou alteração automática de relatórios existentes.

Verificações: 85 testes unitários e 23 de integração passaram. A integração cobre ponto e foto removidos, marcação independente preservada no salvamento/reabertura, permissões e PDF. `scripts/verify-drawing-points.ts` verifica um número independente e um ponto ainda vinculado nos cinco modelos de relatório. Typecheck e lint passaram. A interação nativa em aparelhos físicos ainda precisa de conferência.

O navegador com API simulada conferiu as três escolhas, preservação após salvar/reabrir, edição do número independente, limpeza de traços preservando marcações, exclusão dos dois locais, edição em tela cheia e larguras de 320 a 1440 pixels. Exports Expo web/iOS/Android passaram. A API Docker foi atualizada preservando os volumes; nenhum relatório real foi alterado durante os testes.
