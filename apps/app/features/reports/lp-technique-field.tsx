import { useState } from 'react';
import { View } from 'react-native';
import { lpChoiceValue, lpPenetrantOptions, lpRemovalOptions } from '@weldcosta/shared';
import { Field } from '../../components/ui';
import { SelectField } from '../../components/select-field';

export function LpTechniqueField({
  kind,
  value,
  onChange,
  editable,
  error,
}: {
  kind: 'penetrant' | 'removal';
  value: string;
  onChange(value: string): void;
  editable: boolean;
  error?: string;
}) {
  const [custom, setCustom] = useState(false);
  const selected = lpChoiceValue(kind, value);
  const other = custom || (!!value && !selected);
  const label = kind === 'penetrant' ? 'Tipo de penetrante' : 'Técnica de remoção';
  return (
    <View style={{ gap: 10 }}>
      <SelectField
        label={label}
        value={other ? 'CUSTOM' : selected}
        disabled={!editable}
        error={error}
        options={[
          { value: '', label: 'Não informado' },
          ...(kind === 'penetrant' ? lpPenetrantOptions : lpRemovalOptions),
          { value: 'CUSTOM', label: 'Outro / descrição personalizada' },
        ]}
        onChange={(next) => {
          setCustom(next === 'CUSTOM');
          if (next !== 'CUSTOM') onChange(next);
          else if (selected) onChange('');
        }}
      />
      {other && (
        <Field
          label={'Descrição · ' + label.toLowerCase()}
          value={value}
          onChangeText={onChange}
          editable={editable}
          hint="O texto informado será mantido no PDF."
        />
      )}
    </View>
  );
}
