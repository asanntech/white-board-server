# タスク 001: Yjs パッケージのインストール

## 概要

Yjs ライブラリをプロジェクトに追加する。

## 作業内容

### 1. パッケージインストール

```bash
pnpm add yjs
```

### 2. インストール確認

`package.json` に `yjs` が追加されていることを確認する。

## 完了条件

- [x] `yjs` パッケージがインストールされている
- [x] `pnpm build` が正常に完了する

## 関連ファイル

- `package.json`

## 備考

- Yjs は CRDT (Conflict-free Replicated Data Type) ライブラリ
- サーバーでは初期同期時のみ Y.Doc を一時的に構築するために使用

