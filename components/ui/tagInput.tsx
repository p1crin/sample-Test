import { useState } from 'react';

interface TagInputProps {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string | undefined;
}

const TAG_INPUT_STYLE = "w-67/100 flex flex-col";

const TagInput: React.FC<TagInputProps> = ({ name, value, onChange, className }) => {
  const [tags, setTags] = useState<string[]>(value ? value.split(',') : []);
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim() !== '') {
      const newTags = [...tags, inputValue.trim()];
      setTags(newTags);
      setInputValue('');
      onChange({ target: { name, value: newTags.join(',') } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleRemoveTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index);
    setTags(newTags);
    onChange({ target: { name, value: newTags.join(',') } } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={TAG_INPUT_STYLE}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        placeholder="タグを入力してEnterを押してください"
        className={className}
      />
      <div className="flex flex-wrap mt-2">
        {tags.map((tag, index) => (
          <div key={index} className="inline-block bg-gray-200 text-gray-800 text-sm px-2 py-1 m-1">
            <span>{tag}</span>
            <button
              onClick={() => handleRemoveTag(index)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div >
  );
};

export default TagInput;