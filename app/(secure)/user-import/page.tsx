import { Metadata } from 'next';
import UserImportContainer from './_components/UserImportContainer';

export const metadata: Metadata = {
  title: 'ユーザインポート',
  description: 'CSVファイルからユーザをインポート',
};

export default function UserImportPage() {
  return <UserImportContainer />;
}
