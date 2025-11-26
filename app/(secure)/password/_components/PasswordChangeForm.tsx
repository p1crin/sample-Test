import ButtonGroup from '@/components/ui/buttonGroup';
import { VerticalForm } from '@/components/ui/verticalForm';

type PasswordChangeFormProps = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  setCurrentPassword: (value: string) => void;
  setNewPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  handlePasswordChange: () => void;
};

export function PasswordChangeForm({
  currentPassword,
  newPassword,

  handlePasswordChange,
}: PasswordChangeFormProps) {
  const fields = [
    {
      label: '現在のパスワード',
      type: 'password',
      name: 'currentPassword',
      value: currentPassword,
      onChange: () => { },
      placeholder: '現在のパスワード',
    },
    {
      label: '新しいパスワード',
      type: 'password',
      name: 'newPassword',
      value: newPassword,
      onChange: () => { },
      placeholder: '新しいパスワード',
    },
    {
      label: '新しいパスワード(再確認)',
      type: 'password',
      name: 'confirmNewPassword',
      value: newPassword,
      onChange: () => { },
      placeholder: '新しいパスワード(再確認)',
    },
  ];

  const buttons = [
    {
      label: 'パスワード変更',
      onClick: handlePasswordChange,
    },
  ];

  return (
    <div>
      <VerticalForm fields={fields} />
      <ButtonGroup buttons={buttons} />
    </div>
  );
}