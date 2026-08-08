# Filament Keeper

3Dプリンター用フィラメントの **残量・状態・コスト** を一元管理する、個人用のオフラインアプリです。
[要件定義書 v1.0](#要件定義書との対応) の Phase 1〜3（F-01〜F-13）を実装しています。

- 対象プリンター: Bambu Lab A1 mini（他機種も登録可）
- 想定利用者: 個人（単一ユーザー・認証なし）
- データは端末内の SQLite にのみ保存され、**全機能がネットワーク接続なしで動作します**

---

## セットアップ

```bash
npm install
npx expo install --fix      # Expo SDK に合わせて依存バージョンを揃える
npx expo start --ios        # iOS シミュレータ / Expo Go で起動
```

`expo-sqlite` と `expo-notifications` はネイティブモジュールを含むため、Expo Go ではなく
開発ビルドでの動作確認を推奨します。

```bash
npx expo run:ios                       # ローカルに開発ビルドを作る
eas build --profile development --platform ios   # EAS で作る場合
```

### 検証コマンド

```bash
npm test          # ドメイン計算ロジックのテスト（Node 標準の test runner）
npm run typecheck # アプリと tests の両方を tsc でチェック
```

`npm test` は React Native を起動せずに走ります。`src/domain/calc.ts` が実行時 import を
持たない純粋関数だけで構成されており、Node の型ストリッピングでそのまま実行できるためです。

型チェックは 2 つの tsconfig に分かれています。tests は Node の test runner で直接実行する都合上、
相対 import に `.ts` 拡張子が必要で node の型定義も要るため、`tests/tsconfig.json` で別に見ています。

---

## 機能

| ID | 機能 | 実装場所 |
|---|---|---|
| F-01 | フィラメント登録・編集・**論理**削除、「同じ製品をもう1本登録」 | `app/filament/edit.tsx` |
| F-02 | 一覧（検索・素材/保管場所/ステータスのフィルタ・3種のソート） | `app/(tabs)/filaments.tsx` |
| F-03 | 残量の更新（方式A: 使用量を引く / 方式B: 実測総重量から算出） | `app/filament/[id].tsx`, `src/db/repo/adjustments.ts` |
| F-04 | 印刷ログの記録（残量減算・材料費の自動算出と同時実行） | `app/print-log/new.tsx`, `src/db/repo/printLogs.ts` |
| F-05 | ホームダッシュボード（アラート・サマリー・直近5件・クイックアクション） | `app/(tabs)/index.tsx` |
| F-06 | 保管場所マスタと乾燥剤の交換管理 | `app/storage-locations.tsx` |
| F-07 | 乾燥ログと素材別の乾燥推奨判定 | `app/filament/[id].tsx`, `src/domain/calc.ts` |
| F-08 | 残量アラート（%またはgで閾値を設定） | `src/domain/calc.ts`, `app/(tabs)/settings.tsx` |
| F-09 | コスト集計・統計（月別棒グラフ、素材別円グラフ、ロス、資産額） | `app/(tabs)/stats.tsx` |
| F-10 | 買い直しリスト（購入先が URL ならそのまま開ける） | `app/shopping-list.tsx` |
| F-11 | 印刷設定メモ（ノズル/ベッド温度・速度・ファン） | `app/filament/[id].tsx` |
| F-12 | JSON でのエクスポート / インポート | `src/db/backup.ts`, `app/(tabs)/settings.tsx` |
| F-13 | ローカル通知（毎日の指定時刻にアラートをまとめて） | `src/notifications.ts` |

### 画面

下部タブ（ホーム / フィラメント / 統計 / 設定）+ 印刷ログ登録のフローティングボタン。

| ID | 画面 | ファイル |
|---|---|---|
| S-01 | ホーム | `app/(tabs)/index.tsx` |
| S-02 | フィラメント一覧 | `app/(tabs)/filaments.tsx` |
| S-03 | フィラメント詳細 | `app/filament/[id].tsx` |
| S-04 | フィラメント登録 / 編集 | `app/filament/edit.tsx` |
| S-05 | 印刷ログ登録 | `app/print-log/new.tsx` |
| S-06 | 統計 | `app/(tabs)/stats.tsx` |
| S-07 | 保管場所管理 | `app/storage-locations.tsx` |
| S-08 | 設定 | `app/(tabs)/settings.tsx` |

---

## 構成

```
app/                    expo-router の画面（ファイル = ルート）
src/
  domain/
    types.ts            ドメイン型
    calc.ts             計算ロジック（純粋関数のみ・テスト対象）
    materials.ts        素材・色・スプール自重のマスタデータ
    settings.ts         設定の既定値と key-value 変換
  db/
    client.ts           SQLite の接続と PRAGMA user_version マイグレーション
    rows.ts             行(snake_case) ↔ ドメイン型(camelCase) の変換
    repo/               テーブルごとの読み書き
    backup.ts           JSON エクスポート / インポート
  state/
    AppProvider.tsx     全データの読み込みと算出値の組み立て
    useTheme.ts         テーマ解決
  ui/                   共通コンポーネント・フォーム部品・グラフ
  utils/                日付と数値のフォーマット
  notifications.ts      ローカル通知
tests/calc.test.ts      ドメインロジックのテスト
```

### 算出値は DB に持たない

要件定義書 6. のとおり、次の値はテーブルに保存せず読み出し時に計算します
（`src/state/AppProvider.tsx` の `buildViews`）。

- 1gあたり単価 = `price_yen / initial_weight_g`
- 残量% = `current_weight_g / initial_weight_g * 100`
- 要乾燥判定 = 素材別閾値と `最終乾燥日 ?? 開封日` の比較
- 残りわずか判定 = 設定した % または g の閾値との比較

### データ整合性

印刷ログの登録は「ログの挿入」「残量の減算」「更新履歴の記録」を **1トランザクション**で
行います（`src/db/repo/printLogs.ts`）。途中で失敗しても、残量だけ減ってログが残らない、
といった食い違いは起きません。

フィラメントの削除は論理削除（`deleted_at`）です。過去の印刷ログとコスト集計は残り続けます。

---

## 要件定義書からの意図的な差分

| 項目 | 要件定義書の推奨 | 実装 | 理由 |
|---|---|---|---|
| ORM | Drizzle ORM | expo-sqlite を素の SQL で使用 | drizzle-kit の生成ステップと依存が増える。テーブル7つ・単一ユーザーの規模では素の SQL で読める |
| 状態管理 | Zustand または React Context | React Context | 要件定義書が許容する選択肢のうち依存の少ない方。全件をメモリに載せる規模 |
| グラフ | react-native-gifted-charts | 自前実装（棒 = View、円 = react-native-svg） | 必要なのは棒1種・円1種のみ。追加の peer 依存を持ち込まずに済む |
| 日付入力 | （指定なし） | `YYYY-MM-DD` のテキスト入力 + 「今日」ボタン | ネイティブ DatePicker の依存を避けた。印刷日時は既定が現在時刻なので通常は触らない |
| F-10 の購入先URL | 専用フィールド | 既存の `purchased_from` を利用 | `http(s)://` で始まる場合だけリンクとして開く。スキーマを増やさずに要件を満たせる |

---

## 既知の制約

- **依存関係のインストールと実機動作確認は行えていません。** 作成環境から npm registry への通信が
  組織のポリシーで遮断されている（`registry.npmjs.org` が 403）ためです。手元で
  `npm install && npx expo install --fix && npm run typecheck` を実行してから起動してください。
- 作成環境で確認できた範囲は次のとおりです。
  - `npm test` — 28件パス
  - `src/domain` と `src/utils` の厳密な型チェック（`strict` + `noUncheckedIndexedAccess`）— エラーなし
  - 全ファイルの構文チェックと import 解決 — 問題なし
  - React Native / Expo の型に依存する部分（`app/`・`src/ui/`・`src/db/`）は未検証です
- スライサー / プリンターとの自動連携、QR・バーコード入力、複数ユーザー、スケール自動計測は
  要件定義書のスコープ外のため未実装です。
- AMS 等のマルチマテリアル運用は v1 の想定に含めていません。

---

## 要件定義書との対応

素材別の再乾燥推奨日数の既定値（`src/domain/settings.ts`）:

| 素材 | 既定値 |
|---|---|
| PLA / PLA+ | 90日 |
| PETG | 45日 |
| ABS / ASA | 45日 |
| TPU | 21日 |
| その他 | 60日 |

いずれも設定画面から素材ごとに変更できます。環境湿度に強く依存するため、既定値はあくまで初期値です。
