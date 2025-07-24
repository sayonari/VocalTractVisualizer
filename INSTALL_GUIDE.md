# VocalTractWeb インストールガイド

## 前提条件

- Node.js 16以上
- npm 7以上
- モダンブラウザ（Chrome 90+, Firefox 88+, Safari 14+, Edge 90+）

## インストール手順

1. プロジェクトディレクトリに移動
```bash
cd VocalTractWeb
```

2. npmキャッシュの権限問題を解決（必要な場合）
```bash
sudo chown -R $(whoami) ~/.npm
```

3. 依存関係のインストール
```bash
npm install
```

もしインストールに失敗する場合は、以下を試してください：
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## 開発サーバーの起動

```bash
npm run dev
```

ブラウザが自動的に開き、`http://localhost:3000` でアプリケーションが表示されます。

## ビルド

プロダクション用ビルド：
```bash
npm run build
```

ビルド結果は `dist/` ディレクトリに出力されます。

## プレビュー

ビルドしたアプリケーションのプレビュー：
```bash
npm run preview
```

## 開発ツール

- 型チェック: `npm run typecheck`
- Lintチェック: `npm run lint`
- テスト実行: `npm test`

## トラブルシューティング

### マイクアクセスが機能しない場合
- HTTPSまたはlocalhostでアクセスしているか確認
- ブラウザの設定でマイクへのアクセスが許可されているか確認

### Three.jsの表示が遅い場合
- WebGLがサポートされているか確認
- ブラウザのハードウェアアクセラレーションが有効か確認

### 依存関係のインストールエラー
```bash
# node_modulesとpackage-lock.jsonを削除
rm -rf node_modules package-lock.json

# キャッシュをクリア
npm cache clean --force

# 再インストール
npm install
```