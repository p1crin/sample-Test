import React from 'react';
import { useRouter } from 'next/navigation';

const NavigateToRegistration: React.FC = () => {
  const router = useRouter();

  const handleNavigate = () => {
    router.push('userResistrantion');
  };

  return (
    <div className="flex justify-end mt-4">
      <button
        type="button"
        className="py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-stnly hover:bg-stnly-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        onClick={handleNavigate}
      >
        ユーザ追加
      </button>
    </div>
  );
};

export default NavigateToRegistration;