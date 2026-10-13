# Pessoas e assinaturas — 11/10/2026

O cadastro fica em **Pessoas e assinaturas** no painel lateral e no menu do perfil do app. Também pode ser criado em **Concluir → Responsáveis → Escolher pessoa cadastrada → Cadastrar nova pessoa**.

- Nome, função padrão, registro profissional, empresa/organização, telefone e e-mail.
- Assinatura desenhada com dedo/mouse ou enviada da galeria, câmera ou arquivos (JPG, PNG, WebP até 5 MB).
- Selecionar copia nome, função, registro e assinatura para o relatório. A data sugerida é a data do relatório e pode ser alterada. Sem assinatura, é possível preencher os dados e assinar depois.
- Repetir os responsáveis do último relatório da mesma obra/tipo preenche todas as pessoas, sem copiar a data antiga.
- Dados e assinatura são editáveis por relatório. Alterar/inativar um cadastro preserva relatórios existentes. Inativos saem do seletor, mas continuam acessíveis na lista de inativos.
- EVS, LP, TH, ME e RDO incorporam as imagens ao PDF.

## Persistência e acesso

A migration `20261011100000_people_signatures` cria `people`, `signature_assets` e o vínculo opcional em `report_signatures`. Assinaturas são arquivos PNG imutáveis no storage do servidor; os relatórios guardam uma cópia dos dados e a referência da imagem usada. Uma assinatura nova não substitui o arquivo antigo. Os arquivos exigem autenticação e têm `Cache-Control: private, no-store`.

O cadastro usa as permissões existentes: `reports.view` para consultar, `reports.edit` para cadastrar/editar e enviar assinatura. As restrições de campos e estado do relatório continuam verificadas ao salvar. Atualizações de pessoas usam controle de versão e auditoria. O endpoint de desenho aceita apenas coordenadas numéricas limitadas, não SVG fornecido pelo cliente.

Os arquivos estão no servidor configurado e no volume persistente `report_storage` quando usado Docker. Isso não implanta um serviço de nuvem pública; uma implantação remota deve manter o banco e o storage persistentes.

## Verificação

- 79 testes unitários e 20 de integração passaram. Integração usa PostgreSQL/storage temporários: autenticação, permissões, arquivo inválido, assinatura desenhada, busca, edição concorrente, inativação, histórico imutável, assinatura inexistente com rollback, retirada da assinatura e prévia real em PDF.
- Navegador: cadastro, desenho real com mouse, envio por arquivos, preenchimento dos responsáveis, edição sem alterar cadastro, repetição do relatório anterior, data atualizada e retirada. Sem erro JavaScript ou rolagem horizontal em 360, 390, 768 e 1440 px. API simulada nesse teste visual.
- `scripts/verify-signatures.ts` gera cinco PDFs com dados/traços fictícios, verifica três assinaturas carregadas por modelo, paginação e encaixe das imagens. Artefatos: `assinaturas-{EVS,LP,TH,ME,RDO}.pdf` e capturas da última página nesta pasta.
- TypeScript, ESLint e exportação Expo para web, Android e iOS passaram.
- A imagem Docker da API foi atualizada e a migration aplicada. Verificação autenticada na API em execução: `/people` e `/reports?limit=1` retornaram 200; desenho vazio retornou 400. Nenhuma pessoa ou assinatura de teste foi cadastrada nesse banco.
- Uso em aparelho iOS/Android físico ainda depende de conferência no dispositivo.
