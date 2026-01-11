import React from 'react';

interface TagProps {
  label: string;
}

const Tag: React.FC<TagProps> = ({ label }) => {
  // カンマで分割して配列にする
  const labels = label.split(',');

  return (
    <div>
      {labels.map((item, index) => (
        item.trim() !== "" && (
          <span key={index} className="inline-block bg-gray-200 text-gray-800 text-sm px-2 py-1 m-1">
            {item.trim()}
          </span>
        )
      ))}
    </div>
  );
};

export default Tag;