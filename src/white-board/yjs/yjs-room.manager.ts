import { Injectable } from '@nestjs/common'
import * as Y from 'yjs'

/**
 * ルームごとのY.Docをメモリ上で管理するマネージャー
 *
 * 責務:
 *   - ルームIDに対応するY.Docの作成・取得・削除
 *   - Y.Docの初期構造のセットアップ
 */
@Injectable()
export class YjsRoomManager {
  private docs: Map<string, Y.Doc> = new Map()

  /**
   * ルームのY.Docを取得。存在しなければ新規作成
   */
  getOrCreateDoc(roomId: string): Y.Doc {
    let doc = this.docs.get(roomId)
    if (!doc) {
      doc = new Y.Doc()
      this.initializeDocStructure(doc, roomId)
      this.docs.set(roomId, doc)
    }
    return doc
  }

  /**
   * ルームのY.Docを取得（存在しない場合はundefined）
   */
  getDoc(roomId: string): Y.Doc | undefined {
    return this.docs.get(roomId)
  }

  /**
   * ルームのY.Docを設定（復元時に使用）
   */
  setDoc(roomId: string, doc: Y.Doc): void {
    this.docs.set(roomId, doc)
  }

  /**
   * ルームのY.Docを削除（ルームが空になった時）
   */
  deleteDoc(roomId: string): boolean {
    return this.docs.delete(roomId)
  }

  /**
   * ルームが存在するか確認
   */
  hasDoc(roomId: string): boolean {
    return this.docs.has(roomId)
  }

  /**
   * 全ルームIDを取得
   */
  getAllRoomIds(): string[] {
    return Array.from(this.docs.keys())
  }

  /**
   * Y.Docの初期構造をセットアップ
   *
   * 構造:
   *   drawings: Y.Map<Y.Map> - 描画オブジェクト
   *   drawingOrder: Y.Array<string> - Z-index順序
   *   deletedDrawings: Y.Map<boolean> - 論理削除フラグ
   *   meta: Y.Map - ルームメタデータ
   */
  private initializeDocStructure(doc: Y.Doc, roomId: string): void {
    // 各共有型を初期化（getすると自動的に作成される）
    doc.getMap('drawings')
    doc.getArray('drawingOrder')
    doc.getMap('deletedDrawings')

    // メタデータを設定
    const meta = doc.getMap('meta')
    meta.set('roomId', roomId)
    meta.set('createdAt', new Date().toISOString())
    meta.set('lastModifiedAt', new Date().toISOString())
  }
}
