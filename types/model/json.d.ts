// モジュール宣言
declare module '*.json' {
  const value: any;
  export default value;
}

// 環境変数の型定義
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_APP_ENV: 'development' | 'staging' | 'production';
  }
}
