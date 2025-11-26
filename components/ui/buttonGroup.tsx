import * as React from 'react';
import { Button } from './button';

interface ButtonGroupProps {
  buttons: { label: string; onClick: () => void; isCancel?: boolean }[];
}

const ButtonGroup: React.FC<ButtonGroupProps> = ({ buttons }) => {
  return (
    <div className="flex justify-center space-x-4">
      {buttons.map((button, index) => (
        <Button
          key={index}
          onClick={button.onClick}
          className={button.isCancel ? "bg-gray-500 hover:bg-gray-400" : ""}
        >
          {button.label}
        </Button>
      ))}
    </div>
  );
};

export default ButtonGroup;