import * as React from 'react';
import FormField, { FormFieldProps } from './formField';

/**
 * バーティカルフォームのプロパティを定義するタイプ
 * @typedef {Object} VerticalFormProps
 * @property {React.HTMLAttributes<HTMLDivElement>} props - HTML属性
 */
export type VerticalFormProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * バーティカルフォームコンポーネントのプロパティを定義するインターフェース
 * @interface
 */
interface VerticalFormComponentProps {
  /** フォームフィールドのプロパティの配列 */
  fields: FormFieldProps[];
}

const VERTICAL_FORM_STYLE = "pb-2 w-4/5 grid gap-4 grid-cols-1";

/**
 * バーティカルフォームコンポーネント
 * @param {VerticalFormComponentProps} props - バーティカルフォームのプロパティ
 * @returns {JSX.Element} バーティカルフォームのJSX要素
 */
const VerticalForm: React.FC<VerticalFormComponentProps> = ({ fields }) => {
  return (
    <div className={VERTICAL_FORM_STYLE}>
      {fields.map((field, index) => (
        <FormField
          key={index}
          {...field}
        />
      ))}
    </div>
  );
};

export { VerticalForm };