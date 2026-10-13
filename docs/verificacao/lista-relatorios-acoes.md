# Lista de relatórios: status e exclusão

O seletor de status está sempre visível e oferece Todos os status, Rascunho, Em revisão, Aprovado e Finalizado. Selecionar uma situação mantém os filtros de empresa, obra, tipo, datas e busca e reinicia a paginação.

Cada cartão do app e cada linha da tabela no painel oferece **Excluir relatório** para quem possui `reports.delete`. O botão é separado do link de abertura. A confirmação mostra a identificação e a situação do documento. A API faz exclusão lógica em qualquer situação, com verificação da versão, sem remover coleções ou arquivos; a auditoria registra a situação anterior. Usuários sem permissão não recebem o botão e a API rejeita a requisição.

Após excluir, a lista e os resumos são atualizados. Excluir o único item da página volta à anterior. Em conflito de versão, a confirmação fecha, a lista é atualizada e o usuário vê o erro antes de tentar novamente.

Verificação no navegador com API simulada e sessão de teste: filtro de aprovados mantendo a obra, cancelamento sem requisição, exclusão de aprovado e finalizado, envio da versão correta, recuperação da última página, conflito, usuário sem permissão e larguras de 320, 390, 768 e 1440 pixels. Sem erros de JavaScript ou transbordamento horizontal.

O teste de integração `soft deletes every report status with permission, version and preserved document history` usa banco temporário e verifica todas as situações, negação de permissão, conflito, retirada da listagem, preservação de pontos/desenhos/assinaturas/PDFs e auditoria. Nenhum relatório real foi excluído durante a verificação.

Typecheck, lint e exports Expo web/iOS/Android verificados. A interação em aparelho físico continua pendente de conferência.

Os 21 testes de integração passaram, incluindo os cinco PDFs. A primeira execução simultânea à compilação atingiu o limite de tempo do teste de PDF; a repetição após a compilação passou. A API Docker foi atualizada preservando os volumes existentes e sem excluir relatórios reais.
