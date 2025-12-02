# テストベストプラクティス

テストを効果的に書くためのベストプラクティスと実例を紹介します。

## 目次

1. [テスト構造](#テスト構造)
2. [命名規則](#命名規則)
3. [セットアップとクリーンアップ](#セットアップとクリーンアップ)
4. [アサーション](#アサーション)
5. [非同期処理](#非同期処理)
6. [モック戦略](#モック戦略)
7. [ユーザーインタラクション](#ユーザーインタラクション)
8. [よくある間違い](#よくある間違い)

---

## テスト構造

### AAA パターン（Arrange-Act-Assert）

```typescript
it('ユーザーがログインボタンをクリックしたときにログイン処理が実行される', async () => {
  // Arrange: テスト環境の準備
  const user = userEvent.setup();
  vi.mocked(signIn).mockResolvedValue({ ok: true } as any);

  render(
    <Provider store={store}>
      <LoginFormContainer />
    </Provider>
  );

  const emailInput = screen.getByLabelText('メールアドレス');
  const passwordInput = screen.getByLabelText('パスワード');
  const submitButton = screen.getByRole('button', { name: 'ログイン' });

  // Act: 実際の処理を実行
  await user.type(emailInput, 'admin@example.com');
  await user.type(passwordInput, 'password123');
  await user.click(submitButton);

  // Assert: 結果を検証
  await waitFor(() => {
    expect(signIn).toHaveBeenCalledWith('credentials', {
      redirect: false,
      email: 'admin@example.com',
      password: 'password123',
    });
  });
});
```

### テスト構成のコツ

- **1 つのテストで 1 つのことのみテストする**
  ```typescript
  // ❌ 悪い例: 複数のことをテストしている
  it('フォームが動作する', () => {
    // ログインできるかテスト
    // エラーメッセージが表示されるかテスト
    // フォーム入力ができるかテスト
  });

  // ✅ 良い例: 1 つのことのみテスト
  it('正しい認証情報でログインできる', () => {
    // ログイン処理のみテスト
  });
  ```

- **テストは独立している**
  ```typescript
  // ❌ 悪い例: テスト間に依存関係がある
  let user;
  it('ユーザーを作成', () => {
    user = createUser();
  });
  it('ユーザーを削除', () => {
    deleteUser(user); // user が定義されていないかもしれない
  });

  // ✅ 良い例: 各テストが独立している
  it('ユーザーを作成できる', () => {
    const user = createUser();
    expect(user).toBeDefined();
  });
  it('ユーザーを削除できる', () => {
    const user = createUser();
    deleteUser(user);
    expect(user.isDeleted).toBe(true);
  });
  ```

---

## 命名規則

### テストスイートの命名

```typescript
describe('LoginFormContainer', () => {
  describe('レンダリング', () => {
    // ...
  });

  describe('ログイン処理', () => {
    // ...
  });

  describe('エラーハンドリング', () => {
    // ...
  });
});
```

### テストケースの命名

**良い命名:**
- `should render login form when component mounts`
- `should call signIn with correct credentials when submit button is clicked`
- `should display error message when login fails`

**悪い命名:**
- `test login` (何をテストしているかが不明)
- `it works` (テストの意図が不明)
- `test123` (意味がない)

---

## セットアップとクリーンアップ

### beforeEach での準備

```typescript
describe('TestGroupListContainer', () => {
  beforeEach(() => {
    // 各テスト前に実行
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    // 各テスト後にクリーンアップ（必要に応じて）
    vi.restoreAllMocks();
  });

  it('テスト 1', () => {
    // ...
  });

  it('テスト 2', () => {
    // ...
  });
});
```

### 共通のレンダリングロジック

```typescript
const renderComponent = (props = {}) => {
  return render(
    <Provider store={store}>
      <LoginFormContainer {...props} />
    </Provider>
  );
};

describe('LoginFormContainer', () => {
  it('should render login form', () => {
    renderComponent();
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
  });
});
```

---

## アサーション

### 推奨されるアサーション

```typescript
// ✅ DOM 要素の確認
expect(screen.getByLabelText('Email')).toBeInTheDocument();
expect(screen.getByRole('button')).toBeVisible();
expect(input).toHaveValue('test@example.com');
expect(input).toBeDisabled();

// ✅ テキスト内容
expect(screen.getByText('Welcome')).toBeInTheDocument();
expect(element).toHaveTextContent('Error: Invalid email');

// ✅ 属性値
expect(element).toHaveAttribute('href', '/page');
expect(input).toHaveAttribute('type', 'password');

// ✅ CSS クラス
expect(element).toHaveClass('active');
expect(element).toHaveClass('active', 'primary');

// ✅ スタイル
expect(element).toHaveStyle('color: red');

// ✅ 関数呼び出し
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenCalledTimes(2);

// ✅ 非同期状態
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### 避けるべきアサーション

```typescript
// ❌ DOM 構造に依存する
expect(element.children[0].children[1].textContent).toBe('Text');

// ❌ 実装に依存する
expect(element).toHaveAttribute('data-test-id', 'myId');
// (要素の取得に使う以外)

// ❌ 正確でない比較
expect(element).toEqual(anotherElement);
// 代わりに expect(element).toBeInTheDocument();
```

---

## 非同期処理

### waitFor を使用

```typescript
// ✅ 好ましい
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});

// ❌ 非推奨（タイミング依存）
setTimeout(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
}, 1000);
```

### findBy クエリ

```typescript
// ✅ findBy は内部的に waitFor を使用
const element = await screen.findByText('Loaded');
expect(element).toBeInTheDocument();

// ❌ getBy は同期的（非同期データには使えない）
const element = screen.getByText('Loaded'); // タイムアウトする可能性
```

### API mocking

```typescript
// ✅ 全テストで統一
beforeEach(() => {
  (global.fetch as any).mockClear();
});

it('should fetch data', async () => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: 'test' }),
  });

  // テスト処理
});
```

---

## モック戦略

### next-auth のモック

```typescript
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  useSession: vi.fn(),
  SessionProvider: ({ children }: any) => children,
}));

// テスト内で使用
vi.mocked(useSession).mockReturnValue({
  data: null,
  status: 'unauthenticated',
  update: vi.fn(),
} as any);
```

### next/navigation のモック

```typescript
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn((key: string) => {
      if (key === 'page') return '1';
      return null;
    }),
  }),
}));
```

### 局所的なモック

```typescript
it('should handle API error', async () => {
  const mockFetch = vi.spyOn(global, 'fetch');
  mockFetch.mockRejectedValueOnce(new Error('API Error'));

  // テスト処理

  mockFetch.mockRestore();
});
```

---

## ユーザーインタラクション

### userEvent の使用

```typescript
const user = userEvent.setup();

// ✅ テキスト入力
await user.type(screen.getByLabelText('Email'), 'test@example.com');

// ✅ クリック
await user.click(screen.getByRole('button', { name: 'Submit' }));

// ✅ ホバー
await user.hover(screen.getByRole('button'));

// ✅ 選択解除
await user.clear(screen.getByDisplayValue('text'));

// ✅ フォーカス
await user.tab();

// ✅ キーボード入力
await user.keyboard('{Enter}');
```

### ユーザーイベント vs fireEvent

```typescript
// ❌ fireEvent（推奨されない）
fireEvent.change(input, { target: { value: 'test' } });

// ✅ userEvent（推奨）
const user = userEvent.setup();
await user.type(input, 'test');
```

---

## よくある間違い

### 1. 非同期処理の待機忘れ

```typescript
// ❌ エラー: テストが非同期を待たない
it('should load data', () => {
  render(<Component />);
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});

// ✅ 正しい
it('should load data', async () => {
  render(<Component />);
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

### 2. アクションのための await 忘れ

```typescript
// ❌ エラー: await なし
it('should handle click', () => {
  const user = userEvent.setup();
  user.click(button); // await がない
  expect(spy).toHaveBeenCalled();
});

// ✅ 正しい
it('should handle click', async () => {
  const user = userEvent.setup();
  await user.click(button);
  expect(spy).toHaveBeenCalled();
});
```

### 3. getBy と findBy の混同

```typescript
// ❌ 非同期データに getBy を使用
it('should load async data', async () => {
  render(<Component />);
  const element = screen.getByText('Loaded'); // 即座に失敗
});

// ✅ 非同期データには findBy を使用
it('should load async data', async () => {
  render(<Component />);
  const element = await screen.findByText('Loaded');
});
```

### 4. モックのスコープミス

```typescript
// ❌ グローバルスコープで複数テストに影響
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

it('test 1', () => {
  // useRouter のモックを使用
});

it('test 2', () => {
  // 同じモックが使われてしまう
});

// ✅ 各テストで独立したモック
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 5. React の act() 警告

```typescript
// ❌ 状態更新が act() でラップされていない
it('should update state', () => {
  const { rerender } = render(<Component />);
  setState('value'); // act() の外
  rerender(<Component />);
});

// ✅ userEvent や waitFor は自動的に act() でラップ
it('should update state', async () => {
  const user = userEvent.setup();
  render(<Component />);
  await user.click(button); // 自動的に act() でラップ
  expect(element).toHaveValue('value');
});
```

### 6. Redux Provider の忘れ

```typescript
// ❌ Redux を使用するコンポーネントなのに Provider がない
it('should render', () => {
  render(<ComponentUsingRedux />);
});

// ✅ Redux を使用するコンポーネントには Provider が必要
it('should render', () => {
  render(
    <Provider store={store}>
      <ComponentUsingRedux />
    </Provider>
  );
});
```

### 7. スナップショットテストの過度な使用

```typescript
// ❌ スナップショットテストに頼りすぎ
it('matches snapshot', () => {
  const { container } = render(<Component />);
  expect(container).toMatchSnapshot();
});

// ✅ 具体的なアサーションを使用
it('renders the component correctly', () => {
  render(<Component />);
  expect(screen.getByText('Title')).toBeInTheDocument();
  expect(screen.getByRole('button')).toBeEnabled();
});
```

---

## テストの実行と保守

### テスト実行の最適化

```bash
# 特定のテストのみ実行
npm test -- -t "ログイン処理"

# ウォッチモードで開発しながらテスト
npm test -- --watch

# カバレッジレポート付きで実行
npm test -- --coverage

# UI モードで確認
npm run test:ui
```

### テスト保守のコツ

1. **テストも本体コードと同様に保守する**
   - リファクタリング時にテストも更新
   - 古いテストを削除

2. **テストの命名を更新する**
   - コンポーネントの動作が変わったら、テスト名も変更

3. **DRY 原則（Don't Repeat Yourself）を適用**
   - 共通のセットアップロジックを関数化
   - 複数回使用される値を定数化

4. **テストの可読性を優先**
   - テストを読むだけで動作が理解できるように
   - コメントは不要（テスト名が説明していれば）

---

## デバッグのコツ

### screen デバッグ

```typescript
it('should display user info', () => {
  render(<Component />);

  // DOM 構造を確認
  screen.debug();

  // 特定の要素をデバッグ
  screen.debug(screen.getByRole('button'));
});
```

### ログ出力

```typescript
it('should handle async data', async () => {
  render(<Component />);

  console.log('Initial render');
  console.log(screen.queryByText('Loading'));

  await waitFor(() => {
    console.log('After load');
    console.log(screen.getByText('Loaded'));
  });
});
```

### テストの一時的なスキップ

```typescript
// このテストを一時的にスキップ
it.skip('should skip this test', () => {
  // テスト内容
});

// このテストのみ実行
it.only('should run this test only', () => {
  // テスト内容
});
```

---

## 参考リソース

- [React Testing Library Best Practices](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
