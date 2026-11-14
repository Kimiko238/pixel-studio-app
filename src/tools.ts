/**
 * ツールID（処理で使う値）と、ボタンに表示する名前・アイコンの対応表。
 * Toolの文字列型を共用することで、存在しないツール名の指定をTypeScriptが検出できる。
 */
import {
  Brush,
  Eraser,
  PaintBucket,
  Pipette,
  Minus,
  Square,
  RectangleHorizontal,
  MousePointer2,
  Hand,
  RotateCw,
  type LucideIcon,
} from 'lucide-react';
export type Tool =
  | 'pencil'
  | 'eraser'
  | 'bucket'
  | 'picker'
  | 'line'
  | 'rect'
  | 'fillrect'
  | 'ellipse'
  | 'select'
  | 'pan';
export type Selection = { x: number; y: number; w: number; h: number };
export const toolItems: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: 'pencil', label: 'ペン', icon: Brush },
  { id: 'eraser', label: '消しゴム', icon: Eraser },
  { id: 'bucket', label: '塗りつぶし', icon: PaintBucket },
  { id: 'picker', label: 'スポイト', icon: Pipette },
  { id: 'line', label: '直線', icon: Minus },
  { id: 'rect', label: '四角', icon: Square },
  { id: 'fillrect', label: '塗り四角', icon: RectangleHorizontal },
  { id: 'ellipse', label: '楕円', icon: RotateCw },
  { id: 'select', label: '選択', icon: MousePointer2 },
  { id: 'pan', label: '移動表示', icon: Hand },
];
