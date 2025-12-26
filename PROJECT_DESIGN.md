# 風量測定アプリ 設計ドキュメント

## 目的と概要
- 空調機器の風量測定をモバイル/Web（React＋Vite）で行い、Supabase に測定データと画像を保存するシングルページアプリ。
- ユーザーは案件（プロジェクト）単位で測定箇所を登録し、箇所ごとに複数点の測定値と撮影画像をアップロードする。

## 技術スタック
- フロントエンド: React 18, TypeScript, Vite, Tailwind CSS, lucide-react
- 認証・DB・ストレージ: Supabase (`@supabase/supabase-js`)
- 状態管理: React Context (`AppContext`)

## プロジェクト構成
- `src/` アプリ本体
  - `context/AppContext.tsx`: ユーザー・画面遷移・選択中プロジェクト/測定箇所/撮影データなどの集中管理
  - `lib/`: Supabase クライアントと型
  - `screens/`: 画面群（ログイン、案件一覧、測定箇所登録・撮影・結果表示など）
  - `types/index.ts`: ドメイン型、画面識別子、プリセット名
- `supabase/migrations/`: DB スキーマとストレージポリシーのマイグレーション

## データモデル（Supabase）
- `projects`  
  - `user_id`, `serial_number`, `model_type`, `model_number`, `measurement_date`
- `measurement_points`  
  - `project_id`, `name`, `location_group_name`, `location_number`（グループ内の通し番号）  
  - 形状: `shape_type` (`rectangular`/`circular`)、寸法: `vertical_mm`, `horizontal_mm?`, `diameter_mm?`  
  - `target_point_count`（測定点予定数）, `is_completed`
- `measurement_readings`  
  - `measurement_point_id`, `point_number`, `image_url`, `ave_wind_speed`
- ストレージ: `measurement-images` バケット  
  - 認証ユーザーの insert/select/delete を許可（RLS ポリシー）。画像は測定点ID配下に `timestamp.jpg` で保存。

## 画面フローと主要ロジック
- 認証: `LoginScreen` / `SignupScreen` で Supabase Auth を利用。セッション検出により `currentScreen` を `login` or `home` 初期化。
- 案件一覧: `HomeScreen`  
  - `projects` をユーザーIDで取得し表示。削除は確認ダイアログ後に実施。
- 新規案件: `NewProjectScreen`  
  - シリアル/型式/番号を入力し `projects` に挿入後、測定箇所一覧へ遷移。
- 測定箇所一覧: `MeasurementLocationsScreen`  
  - `measurement_points` を取得し、同一 `location_group_name` ごとに表示。  
  - 既存測定値から平均風速を計算し、面積（形状別）×60で概算風量を算出して表示。完了済みは結果画面へ、未完了は撮影へ遷移。
- グループ名→個数→詳細入力:  
  - `LocationGroupNameScreen` で名称を決定（プリセットあり）。  
  - `LocationCountScreen` で同グループ内の箇所数を指定。  
  - `LocationDetailScreen` で各箇所の形状・寸法・測定点数を登録し、指定数に達するまで繰り返し `measurement_points` に挿入。
- 追加ショートカット: `NewLocationScreen`  
  - プリセット/カスタム名で単独の測定箇所を追加し、ユニーク名を自動採番。
- 撮影〜測定値入力: `ShootingScreen` → `OCRConfirmScreen`  
  - 端末カメラから画像を DataURL で保持し、確認後ストレージへアップロード。  
  - AVE風速入力を `measurement_readings` に保存。測定点数に達したら `measurement_points.is_completed=true` に更新。
- 結果表示: `ResultsScreen`  
  - 測定値一覧を表示し、平均風速・面積・風量 (avg × area × 60) をサマリ表示。

## 状態管理（AppContext）
- グローバル状態: `user`, `currentScreen`, `currentProject`, `currentMeasurementPoint`, `measurementSession`（進行中測定）、撮影画像 `currentPhotoData`、グループ名/箇所数/進行インデックス。
- 画面遷移は `currentScreen` を直接更新する簡易ルーター方式。サインアウト時に関連状態をリセット。

## 風量計算ロジック
- 面積算出  
  - 矩形: `(vertical_mm * horizontal_mm) / 1,000,000` (m²)  
  - 円形: `π * (diameter_mm / 2)² / 1,000,000` (m²)
- 風量: `average_wind_speed * area * 60` → m³/min

## マイグレーション要点
- `measurement-images` バケット作成と RLS ポリシー付与。
- `measurement_points` の削除ポリシー緩和（完了・未完了問わず削除可、所有者チェックあり）。
- 形状拡張: `shape_type`, `diameter_mm` 追加、`horizontal_mm` を nullable にし形状に応じて整合性チェック。
- グルーピング: `location_group_name`, `location_number` 追加し既存データを移行。

## 想定ユースケース
1. ユーザー登録・ログイン。
2. 案件を作成（機器情報入力）。
3. 測定箇所をグループ単位で登録、形状と測定点数を設定。
4. 各測定点で撮影→風速入力→自動でストレージ/DBへ保存。
5. 測定完了後、結果サマリと画像リンクを確認。

## 改善候補（メモ）
- ルーター未使用のため URL 共有不可。`react-router` 等導入で画面遷移を安定化。 
- OCR 自動抽出は未実装（手入力のみ）。将来の OCR サービス連携ポイントとして `OCRConfirmScreen` を拡張可能。
- エラーハンドリング・トースト通知の共通化、ローディング状態の統一管理。
- 計測中断/再開用のセッション復元や、測定データの編集機能強化。

