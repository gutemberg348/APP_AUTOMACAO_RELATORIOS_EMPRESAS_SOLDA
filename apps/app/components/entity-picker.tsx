import { useTheme } from '../utils/theme';
import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@weldcosta/shared';
import { api } from '../services/api';
import { SearchField, Loading, Notice, Pager, Button } from './ui';
import { SelectTrigger, SelectOptionRow } from './select-field';
import { PickerSheet } from './picker-sheet';
import { formatInputMask } from '../utils/input-masks';

interface Entity {
  id: string;
  name: string;
  corporateName?: string | null;
  cnpj?: string | null;
  code?: string | null;
  location?: string | null;
  company?: { name: string };
}

export function EntityPicker({
  endpoint,
  label,
  value,
  onChange,
  error,
  required,
  disabled,
  clearable = true,
}: {
  endpoint: string;
  label: string;
  value: string;
  onChange(id: string): void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  clearable?: boolean;
}) {
  const { tokens: t, styles } = useTheme();
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [open, setOpen] = useState(false);
  const client = useQueryClient();
  const base = endpoint.split('?')[0]!,
    company = base === '/companies';
  const icon = company ? ('building' as const) : ('folder' as const);
  const separator = endpoint.includes('?') ? '&' : '?';
  const query = useQuery({
    queryKey: ['picker', endpoint, page, search],
    queryFn: () =>
      api<Paginated<Entity>>(
        endpoint +
          separator +
          'page=' +
          page +
          '&limit=10&sortBy=name&sortOrder=asc&search=' +
          encodeURIComponent(search),
      ),
    enabled: open,
  });
  const selected = useQuery({
    queryKey: ['picker-selection', base, value],
    queryFn: () => api<Entity>(base + '/' + value),
    enabled: !!value,
    staleTime: 60000,
  });
  const current = query.data?.items.find((item) => item.id === value) ?? selected.data;
  return (
    <>
      <SelectTrigger
        label={label}
        icon={icon}
        displayValue={
          current?.name ??
          (value ? (selected.isError ? 'Seleção indisponível' : 'Carregando seleção…') : undefined)
        }
        placeholder={'Selecione ' + label.toLowerCase()}
        error={error}
        required={required}
        disabled={disabled}
        expanded={open}
        clearable={clearable && !!value}
        onClear={() => onChange('')}
        onPress={() => {
          setSearch('');
          setPage(1);
          setOpen(true);
        }}
      />
      <Notice error={selected.error} />
      {selected.isError && (
        <Button
          title={'Recarregar ' + label.toLowerCase()}
          secondary
          small
          busy={selected.isFetching}
          onPress={() => void selected.refetch()}
        />
      )}
      <PickerSheet
        visible={open}
        title={'Selecionar ' + label.toLowerCase()}
        subtitle={
          company
            ? 'Encontre o cliente pelo nome ou razão social.'
            : 'Encontre a obra vinculada ao cliente.'
        }
        icon={icon}
        onClose={() => setOpen(false)}
        footer={
          query.data ? (
            query.data.pages > 1 ? (
              <Pager
                page={page}
                pages={query.data.pages}
                total={query.data.total}
                onChange={setPage}
              />
            ) : (
              <Text style={[styles.muted, { fontSize: 11 }]}>
                {query.data.total}{' '}
                {query.data.total === 1 ? 'registro disponível' : 'registros disponíveis'}
              </Text>
            )
          ) : undefined
        }
      >
        <SearchField
          label={'Buscar ' + label.toLowerCase()}
          value={search}
          onChangeText={(text) => {
            setSearch(text);
            setPage(1);
          }}
        />
        {!!current && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 11,
              paddingVertical: 9,
              backgroundColor: t.colors.blueSoft,
              borderRadius: 9,
            }}
          >
            <Text style={{ fontFamily: t.fonts.bold, fontSize: 10, color: t.colors.blue }}>
              ATUAL
            </Text>
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: 12, fontFamily: t.fonts.medium, color: t.colors.blue }}
            >
              {current.name}
            </Text>
          </View>
        )}
        <Notice error={query.error} />
        {query.isError && (
          <Button
            title="Tentar novamente"
            secondary
            small
            onPress={() => {
              void query.refetch();
            }}
          />
        )}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 360, flexGrow: 0 }}
          contentContainerStyle={{ gap: 4 }}
        >
          {query.isPending && <Loading />}
          {query.data?.items.map((item) => (
            <SelectOptionRow
              key={item.id}
              selected={value === item.id}
              option={{
                value: item.id,
                label: item.name,
                icon,
                description: company
                  ? [item.corporateName, item.cnpj ? formatInputMask('cnpj', item.cnpj) : '']
                      .filter(Boolean)
                      .join(' · ')
                  : [item.company?.name, item.location].filter(Boolean).join(' · '),
                badge: item.code ?? undefined,
              }}
              onPress={() => {
                client.setQueryData(['picker-selection', base, item.id], item);
                onChange(item.id);
                setOpen(false);
              }}
            />
          ))}
          {query.data && !query.data.total && (
            <View style={{ alignItems: 'center', padding: 24, gap: 4 }}>
              <Text style={{ fontFamily: t.fonts.bold, fontSize: 13, color: t.colors.text }}>
                Nenhum registro encontrado
              </Text>
              <Text style={[styles.muted, { textAlign: 'center', fontSize: 12 }]}>
                {search
                  ? 'Tente outro nome ou limpe a busca.'
                  : company
                    ? 'Cadastre uma empresa ativa na aba Empresas e volte para selecioná-la.'
                    : 'Cadastre uma obra ativa para esta empresa na aba Obras e volte para selecioná-la.'}
              </Text>
            </View>
          )}
        </ScrollView>
      </PickerSheet>
    </>
  );
}
