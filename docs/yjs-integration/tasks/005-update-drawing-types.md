# タスク 005: Drawing 型定義の更新

## 概要

Drawing 型の `lineCap` と `lineJoin` プロパティをより厳密な型に更新する。

## 作業内容

### 1. 型定義の更新

`src/white-board/drawing.types.ts` の `Drawing` 型を更新：

```typescript
// 変更前
export type Drawing = {
  id: string
  type: string
  points: number[]
  stroke: string
  strokeWidth: number
  x?: number
  y?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  skewX?: number
  skewY?: number
  lineCap?: string
  lineJoin?: string
  opacity?: number
}

// 変更後
export type Drawing = {
  id: string
  type: string
  points: number[]
  stroke: string
  strokeWidth: number
  x?: number
  y?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  skewX?: number
  skewY?: number
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'round' | 'bevel' | 'miter'
  opacity?: number
}
```

### 2. 不要な型の削除検討

Yjs 導入後は以下の型が不要になる可能性がある：

```typescript
// UndoRedoの結果の型定義（削除候補）
export type UndoRedoResult = {
  action: 'delete' | 'restore' | 'transform'
  objects: Drawing[]
}
```

※ 他で参照されていないか確認してから削除する

## 完了条件

- [ ] `lineCap` の型が `'butt' | 'round' | 'square'` に更新されている
- [ ] `lineJoin` の型が `'round' | 'bevel' | 'miter'` に更新されている
- [ ] `pnpm build` が正常に完了する
- [ ] 型エラーが発生していないこと

## 関連ファイル

- `src/white-board/drawing.types.ts`

## 備考

- これらの値は HTML Canvas の CanvasRenderingContext2D API の標準値
- より厳密な型にすることで、不正な値の混入を防げる
- `DrawingRecord` 型の `line_cap` / `line_join` も同様に更新を検討
