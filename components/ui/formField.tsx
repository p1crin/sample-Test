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
  /** 入力フィールドのタイプ (例: 'text', 'select', 'textarea', 'tag', 'date') */
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
  /** 最小値(オプション)*/
  min?: number;
  /** 最大値(オプション)*/
  max?: number;
  /** エラーメッセージ (オプション) */
  error?: string;
  /** 必須フラグ (オプション) */
  required?: boolean;
  /** フィールドがフォーカスを失ったときに呼び出される関数 (オプション) */
  onBlur?: () => void;
  /** フィールドを無効化するフラグ (オプション) */
  disabled?: boolean;
}

const FORM_FIELD_STYLE = "flex flex-cols space-x-4 justify-end";
const LABLE_STYLE = "flex items-center text-sm";
const INPUT_FORM_STYLE = "flex h-10 w-67/100 rounded border border-[#cccccc] bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#2684ff]";
const INPUT_TEXTARER_FORM_STYLE = "flex h-32 w-67/100 rounded border border-[#cccccc] bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#2684ff]";
const INPUT_SLECT_FORM_STYLE = "h-10 w-67/100 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#2684ff] disabled:cursor-not-allowed disabled:opacity-50";
const INPUT_TAG_FORM_STYLE = "h-10 w-67/100 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#2684ff] disabled:cursor-not-allowed disabled:opacity-50";
const INPUT_DATE_FORM_STYLE = "h-10 w-67/100 rounded border border-[#cccccc] bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#2684ff]";

/**
 * フォームフィールドコンポーネント
 * @param {FormFieldProps} props - フォームフィールドのプロパティ
 * @returns {JSX.Element} フォームフィールドのJSX要素
 */
export default function FormField({
  label,
  type,
  name,
  value,
  onChange,
  placeholder,
  options,
  error,
  onBlur,
  disabled,
  min,
  max
}: FormFieldProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const controlledValue = value ?? '';

  const customCreateLabel = (inputValue: string) => `新しいタグ"${inputValue}" を作成`;

  // valueを{label:"XXXXX",value:"XXXXX"}の形式に変換
  const formattedValue = Array.isArray(value)
    ? value.map(v => ({ label: v, value: v }))
    : null;

  // react-select を使う場合、クライアント側でのみレンダリング
  if (!isClient && (type === 'select' || type === 'tag' || type === 'addableTag')) {
    return (
      <div className={FORM_FIELD_STYLE}>
        <label className={LABLE_STYLE}>{label}</label>
        <div className={INPUT_SLECT_FORM_STYLE} />
      </div>
    );
  }

  return (
    <div>
      <div className={FORM_FIELD_STYLE}>
        <label className={LABLE_STYLE}>{label}</label>
        {type === 'select' ? (
          <Select
            isClearable={true}
            options={options}
            value={options?.find(option => option.value === value)}
            onChange={(selectedOption) =>
              onChange({ target: { name, value: selectedOption?.value || '' } } as unknown as React.ChangeEvent<HTMLInputElement>)
            }
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
            onChange={(e) => onChange(e as React.ChangeEvent<HTMLInputElement>)}
            onBlur={onBlur}
            placeholder={placeholder}
            className={INPUT_FORM_STYLE}
            autoComplete='new-password'
            disabled={disabled}
            {...(type === 'number' && min !== undefined && { min })}
            {...(type === 'number' && max !== undefined && { max })}
          />
        )}
      </div>
      {error && <p className="text-red-600 text-xs mt-1 ml-auto mr-0 w-67/100">{error}</p>}
    </div>
  );
}