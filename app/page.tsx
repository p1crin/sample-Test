import Link from 'next/link';
import LoginPage from './login/page';

export default function Page() {
  return (
    <>
      <div className="flex items-center justify-center min-h-screen">
        <LoginPage/>
      </div>
    </>
  );
}
