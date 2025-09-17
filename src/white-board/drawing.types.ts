// 描画データの型定義
export interface Drawing {
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
}

// DynamoDBに保存するための型定義
export interface DrawingRecord {
  room_id: string
  drawing_id: string
  type: string
  points: number[]
  stroke: string
  stroke_width: number
  x?: number
  y?: number
  rotation?: number
  scale_x?: number
  scale_y?: number
  skew_x?: number
  skew_y?: number
  created_at: string
  updated_at: string
  deleted_at?: string
  is_deleted: boolean
}
