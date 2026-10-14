import { useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { Company, Paginated } from '@weldcosta/shared';
import { api } from '../../services/api';
import { useTheme } from '../../utils/theme';
import {
  Card,
  PanelHeader,
  SearchField,
  Notice,
  Loading,
  Pager,
  Button,
} from '../../components/ui';
import { Icon } from '../../components/icon';

export function CompanyAccessField({
  value,
  onChange,
  disabled,
  initial = [],
}: {
  value: string[];
  onChange(ids: string[]): void;
  disabled?: boolean;
  initial?: { id: string; name: string; status: 'ACTIVE' | 'ARCHIVED' }[];
}) {
  const { tokens: t, styles } = useTheme();
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['companies', 'user-access', search, page],
    queryFn: () =>
      api<Paginated<Company>>(
        `/companies?limit=20&page=${page}&search=${encodeURIComponent(search)}`,
      ),
  });
  const [known, setKnown] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map((company) => [company.id, company.name])),
  );
  const names = {
    ...known,
    ...Object.fromEntries((query.data?.items ?? []).map((company) => [company.id, company.name])),
  };
  const toggle = (company: Company) => {
    setKnown((old) => ({ ...old, [company.id]: company.name }));
    onChange(
      value.includes(company.id) ? value.filter((id) => id !== company.id) : [...value, company.id],
    );
  };
  return (
    <Card style={{ padding: 18 }}>
      <PanelHeader
        title="Empresas liberadas"
        subtitle="O acesso às obras e aos relatórios acompanha estas empresas."
        icon="building"
      />
      <Text style={styles.muted}>
        {value.length
          ? `${value.length} empresa(s) selecionada(s).`
          : 'Nenhuma empresa liberada. Esta pessoa não poderá acessar empresas, obras ou relatórios até você liberar uma.'}
      </Text>
      {!!value.length && (
        <View style={{ gap: 8 }}>
          {value.map((id) => (
            <Button
              key={id}
              title={'Remover acesso: ' + (names[id] ?? 'Empresa selecionada')}
              icon="close"
              secondary
              small
              disabled={disabled}
              onPress={() => onChange(value.filter((item) => item !== id))}
            />
          ))}
        </View>
      )}
      <SearchField
        label="Buscar empresas para liberar"
        placeholder="Buscar pelo nome da empresa"
        value={search}
        onChangeText={(next) => {
          setSearch(next);
          setPage(1);
        }}
      />
      <Notice error={query.error} />
      {query.isError && (
        <Button
          title="Carregar empresas novamente"
          secondary
          onPress={() => void query.refetch()}
        />
      )}
      {query.isPending && <Loading />}
      {query.data?.items.map((company) => (
        <Pressable
          key={company.id}
          accessibilityRole="checkbox"
          aria-checked={value.includes(company.id)}
          accessibilityLabel={'Liberar empresa ' + company.name}
          accessibilityState={{ checked: value.includes(company.id), disabled }}
          disabled={disabled}
          onPress={() => toggle(company)}
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
            padding: 12,
            borderWidth: 1,
            borderColor: value.includes(company.id) ? t.colors.blue : t.colors.line,
            backgroundColor: value.includes(company.id) ? t.colors.blueSoft : t.colors.surface,
            borderRadius: 10,
            minHeight: 48,
          }}
        >
          <Icon
            name={value.includes(company.id) ? 'check' : 'plus'}
            color={t.colors.blue}
            size={18}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{company.name}</Text>
            {company.status === 'ARCHIVED' && <Text style={styles.muted}>Empresa arquivada</Text>}
          </View>
        </Pressable>
      ))}
      {query.data?.total === 0 && (
        <Text style={styles.muted}>
          Nenhuma empresa encontrada. Cadastre a empresa primeiro ou ajuste a busca.
        </Text>
      )}
      {!!query.data && query.data.pages > 1 && (
        <Pager page={page} pages={query.data.pages} onChange={setPage} />
      )}
    </Card>
  );
}
