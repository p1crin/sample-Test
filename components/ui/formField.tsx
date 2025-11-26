import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

/**
 * フォームフィールドのプロパティを定義するインターフェース
 * @interface
 */
export interface FormFieldProps {
  /** ラベルのテキスト */
  label: string;
  /** 入力フィールドのタイプ (例: 'text', 'select', 'textarea', 'tag', 'date', 'file') */
  type: string;
  /** 入力フィールドの名前 */
  name: string;
  /** 入力フィールドの値 */
  value: string | string[];
  /** 入力フィールドの値が変更されたときに呼び出される関数 */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => void;
  /** プレースホルダーのテキスト (オプション) */
  placeholder?: string;
  /** セレクトボックスのオプション (オプション) */
  options?: { value: string; label: string }[];
}

const FORM_FIELD_STYLE = "flex flex-cols space-x-4 justify-end";
const LABLE_STYLE = "flex items-center text-sm";
const INPUT_FORM_STYLE = "flex h-10 w-67/100 rounded border border-[#cccccc] bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#2684ff]";
const INPUT_TEXTARER_FORM_STYLE = "flex h-32 w-67/100 rounded border border-[#cccccc] bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#2684ff]";
const INPUT_SLECT_FORM_STYLE = "h-10 w-67/100 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#2684ff] disabled:cursor-not-allowed disabled:opacity-50";
const INPUT_TAG_FORM_STYLE = "h-10 w-67/100 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#2684ff] disabled:cursor-not-allowed disabled:opacity-50";
const DATE_FOMR_STYLE = "flex w-2/3 flex-row items-center";
const INPUT_DATE_FORM_STYLE = "h-10 w-67/100 rounded border border-[#cccccc] bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#2684ff]";

/**
 * フォームフィールドコンポーネント
 * @param {FormFieldProps} props - フォームフィールドのプロパティ
 * @returns {JSX.Element} フォームフィールドのJSX要素
 */
export default function FormField({ label, type, name, value, onChange, placeholder, options }: FormFieldProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const controlledValue = value ?? '';

  if (!isClient) {
    return null;
  }

  const customCreateLabel = (inputValue: string) => `新しいタグ"${inputValue}" を作成`;

  // valueを{label:"XXXXX",value:"XXXXX"}の形式に変換
  const formattedValue = Array.isArray(value)
    ? value.map(v => ({ label: v, value: v }))
    : null;

  return (
    <div className={FORM_FIELD_STYLE}>
      <label className={LABLE_STYLE}>{label}</label>
      {type === 'select' ? (
        <Select
          isClearable={true}
          options={options}
          value={options?.find(option => option.value === value)}
          onChange={(selectedOption) => onChange({ target: { name, value: selectedOption?.value || '' } } as unknown as React.ChangeEvent<HTMLInputElement>)}
          className={INPUT_SLECT_FORM_STYLE}
          classNamePrefix="select"
          menuPosition="fixed"
          placeholder={placeholder}
        />
      ) : type === 'textarea' ? (
        <textarea
          name={name}
          value={controlledValue}
          onChange={onChange}
          placeholder={placeholder}
          className={INPUT_TEXTARER_FORM_STYLE}
        />
      ) : type === 'tag' ? (
        <Select
          closeMenuOnSelect={false}
          options={options}
          isMulti
          value={formattedValue}
          onChange={(selectedOptions) => {
            const newValue = selectedOptions ? selectedOptions.map(option => option.value) : [];
            onChange({ target: { name, value: newValue } });
          }}
          className={INPUT_SLECT_FORM_STYLE}
          classNamePrefix="select"
          menuPosition="fixed"
          placeholder={placeholder}
        />
      ) : type === 'addableTag' ? (
        <CreatableSelect
          closeMenuOnSelect={false}
          className={INPUT_TAG_FORM_STYLE}
          isMulti
          options={options}
          value={formattedValue}
          onChange={(selectedOptions) => {
            const newValue = selectedOptions ? selectedOptions.map(option => option.value) : [];
            onChange({ target: { name, value: newValue } });
          }}
          menuPosition="fixed"
          classNamePrefix="select"
          placeholder={placeholder}
          formatCreateLabel={customCreateLabel}
        />
      ) : type === 'date' ? (
        <input
          type="date"
          name={name}
          value={typeof controlledValue === 'string' ? controlledValue : ''}
          onChange={(e) => {
            onChange({
              target: {
                name,
                value: e.target.value
              }
            } as React.ChangeEvent<HTMLInputElement>);
          }}
          placeholder={placeholder}
          className={INPUT_DATE_FORM_STYLE}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={controlledValue}
          onChange={type === 'file' ? (e) => onChange(e as React.ChangeEvent<HTMLInputElement>) : (e) => onChange(e as React.ChangeEvent<HTMLInputElement>)}
          placeholder={placeholder}
          className={INPUT_FORM_STYLE}
          autoComplete='new-password'
        />
      )}
    </div>
  );
}