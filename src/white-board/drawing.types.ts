// 描画データの型定義
export interface DrawingData {
  id: string
  type: string
  points: number[]
  stroke: string
  strokeWidth: number
  lineCap: string
  lineJoin: string
  x?: number
  y?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  skewX?: number
  skewY?: number
}
