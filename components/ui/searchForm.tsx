import * as React from 'react';
import FormField, { FormFieldProps } from "./formField";
import { Button } from './button';

/**
 * 検索フォームのプロパティを定義するインターフェース
 * @interface
 */
interface SearchFormProps {
  /** フォームフィールドのプロパティの配列 */
  fields: FormFieldProps[];
  /** フォームの初期値 (オプション) */
  values?: Record<string, string>;
  /** 検索ボタンがクリックされたときに呼び出される関数 */
  onClick: () => void;
  /** 検索フォームの値が変更されたときに呼び出される関数 */
  onFormDataChange?: (formData: Record<string, string>) => void;
}

const SEARCH_FORM_STYLE = "flex";
const SEARCH_FORM_GRID_STYLE = "pb-2 grid gap-2 grid-cols-3 flex-grow";
const SEARCH_BUTTON_STYLE = "text-right pb-2 ml-4";

/**
 * 検索フォームコンポーネント
 * @param {SearchFormProps} props - 検索フォームのプロパティ
 * @returns {JSX.Element} 検索フォームのJSX要素
 */
export default function SeachForm({ fields, values, onClick, onFormDataChange }: SearchFormProps) {
  const [formData, setFormData] = React.useState<Record<string, string>>(
    values || fields.reduce((acc, field) => ({ ...acc, [field.name]: field.value ?? '' }), {})
  );

  // values プロップが変更されたときに formData を更新
  React.useEffect(() => {
    if (values) {
      setFormData(values);
    }
  }, [values]);

  /**
   * 入力フィールドの値が変更されたときに呼び出される関数
   * @param {FormFieldProps} field - フォームフィールドのプロパティ
   * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }} e - 入力イベント
   */
  const handleInputChange = (field: FormFieldProps, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | { name: string; value: string | string[] };
    const { name, value } = target;
    const stringValue = typeof value === 'string' ? value : Array.isArray(value) ? value.join(',') : '';
    const updatedFormData = {
      ...formData,
      [name]: stringValue
    };
    setFormData(updatedFormData);
    // フォーム値が変更されたときに親コンポーネントに通知
    if (onFormDataChange) {
      onFormDataChange(updatedFormData);
    }
  };

  return (
    <div className={SEARCH_FORM_STYLE}>
      <div className={SEARCH_FORM_GRID_STYLE}>
        {fields.map((field, index) => (
          <FormField
            key={index}
            {...field}
            value={formData[field.name] || ''}
            onChange={(e) => handleInputChange(field, e)} />
        ))}
      </div>
      <div className={SEARCH_BUTTON_STYLE}>
        <Button onClick={onClick} variant="default">
          検索
        </Button>
      </div>
    </div>
  );
}