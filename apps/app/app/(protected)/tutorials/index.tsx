import { useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { tutorialKind, type Tutorial, type Paginated } from '@weldcosta/shared';
import { api } from '../../../services/api';
import { usePermission } from '../../../hooks/use-permission';
import { useTheme } from '../../../utils/theme';
import {
  Page,
  Card,
  Button,
  SearchField,
  Choice,
  Empty,
  Loading,
  Notice,
  Pager,
  Badge,
  IconTile,
} from '../../../components/ui';

export default function Tutorials() {
  const { styles } = useTheme();
  const canView = usePermission('training.view'),
    canManage = usePermission('training.manage');
  const [search, setSearch] = useState(''),
    [kind, setKind] = useState('all'),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['tutorials', search, kind, page],
    queryFn: () =>
      api<Paginated<Tutorial>>(
        '/tutorials?search=' + encodeURIComponent(search) + '&kind=' + kind + '&page=' + page,
      ),
    enabled: canView,
  });
  return (
    <Page
      title="Tutoriais"
      back={{ label: 'Voltar para início', href: '/dashboard' }}
      eyebrow="Conhecimento da equipe"
      subtitle="Orientações, fotos, documentos e vídeos para consultar durante o trabalho."
      action={
        canManage ? (
          <Button title="Novo tutorial" icon="plus" onPress={() => router.push('/tutorials/new')} />
        ) : undefined
      }
    >
      {!canView ? (
        <Empty title="Acesso restrito" text="Você não possui acesso aos tutoriais." icon="lock" />
      ) : (
        <>
          <Card>
            <SearchField
              label="Buscar tutoriais"
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Buscar tutorial…"
            />
            <View style={styles.row}>
              {[
                ['all', 'Todos'],
                ['image', 'Fotos'],
                ['document', 'Documentos'],
                ['video', 'Vídeos'],
              ].map(([value, label]) => (
                <Choice
                  key={value}
                  label={label!}
                  selected={kind === value}
                  onPress={() => {
                    setKind(value!);
                    setPage(1);
                  }}
                />
              ))}
            </View>
          </Card>
          <Notice error={query.error} />
          {query.isError && (
            <Button title="Tentar novamente" secondary onPress={() => void query.refetch()} />
          )}
          {query.isPending && <Loading />}
          {query.data && (
            <>
              <Text style={styles.muted}>
                {query.data.total}{' '}
                {query.data.total === 1 ? 'material disponível' : 'materiais disponíveis'}
              </Text>
              {!query.data.items.length && (
                <Empty
                  title={
                    search || kind !== 'all'
                      ? 'Nenhum material encontrado'
                      : 'Os tutoriais aparecerão aqui'
                  }
                  text={
                    search || kind !== 'all'
                      ? 'Tente outra busca ou categoria.'
                      : canManage
                        ? 'Publique o primeiro material para orientar a equipe.'
                        : 'Consulte esta aba quando a empresa publicar novos materiais.'
                  }
                  icon="book"
                />
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                {query.data.items.map((item) => {
                  const type = tutorialKind(item.mimeType);
                  return (
                    <Card key={item.id} style={{ flexGrow: 1, flexBasis: 280, maxWidth: 600 }}>
                      <View style={[styles.row, { justifyContent: 'space-between' }]}>
                        <IconTile
                          name={type === 'video' ? 'play' : type === 'image' ? 'image' : 'report'}
                        />
                        <Badge
                          label={
                            type === 'video' ? 'Vídeo' : type === 'image' ? 'Foto' : 'Documento'
                          }
                          tone="blue"
                          dot={false}
                        />
                      </View>
                      <Text
                        accessibilityRole="header"
                        style={[styles.text, { fontWeight: '700', fontSize: 17 }]}
                      >
                        {item.title}
                      </Text>
                      {!!item.description && (
                        <Text numberOfLines={3} style={styles.muted}>
                          {item.description}
                        </Text>
                      )}
                      <Text style={[styles.muted, { fontSize: 11 }]}>
                        {item.fileSize
                          ? (item.fileSize < 1024 * 1024
                              ? Math.max(1, Math.round(item.fileSize / 1024)) + ' KB'
                              : (item.fileSize / 1024 / 1024).toFixed(1) + ' MB') + ' · '
                          : ''}
                        {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                      </Text>
                      <Button
                        title="Abrir tutorial"
                        secondary
                        iconRight="arrow-right"
                        onPress={() => router.push('/tutorials/' + item.id)}
                      />
                    </Card>
                  );
                })}
              </View>
              <Pager page={page} pages={query.data.pages} onChange={setPage} />
            </>
          )}
        </>
      )}
    </Page>
  );
}
