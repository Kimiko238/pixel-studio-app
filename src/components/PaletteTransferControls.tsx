/** パレットの持ち出し・持ち込み画面。ファイル内容の検証と保存はフックに任せる。 */
import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { StudioController } from '../hooks/usePixelStudio';
import { download } from '../model';
import { serializePaletteTransfer } from '../paletteTransfer';

type Props = Pick<StudioController, 'project' | 'paletteLibrary' | 'importPalettes'>;

export function PaletteTransferControls({ project, paletteLibrary, importPalettes }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const importFile = async (file: File) => {
    setLoading(true);
    setMessage('');
    setError(false);
    try {
      const result = importPalettes(await file.text());
      if (!result) {
        setError(true);
        setMessage(
          'パレットを追加できませんでした。上の保存欄に表示されたエラーを確認してください。',
        );
        return;
      }
      setMessage(
        `${result.added}件追加しました。${result.skipped ? `同じパレット${result.skipped}件は追加を省きました。` : ''}上の一覧から選んで使えます。`,
      );
    } catch {
      setError(true);
      setMessage('ファイルを読み込めませんでした。もう一度選択してください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <details className="palette-transfer">
      <summary>ファイルでバックアップ</summary>
      <p className="hint">
        名前付きパレットと使用中の色をJSONにまとめます。別のスマホやPCにファイルを渡して読み込めます。
      </p>
      <div className="button-row">
        <button
          className="button"
          onClick={() => {
            try {
              const json = serializePaletteTransfer(paletteLibrary, project.palette);
              download(
                new Blob([json], { type: 'application/json' }),
                'pixel-studio-palettes.json',
              );
              setError(false);
              setMessage('ファイルを別の端末へ渡し、「他の端末から読み込む」で選んでください。');
            } catch {
              setError(true);
              setMessage('書き出せませんでした。もう一度お試しください。');
            }
          }}
        >
          <Download size={15} /> 別の端末へ書き出す
        </button>
        <button className="button" disabled={loading} onClick={() => inputRef.current?.click()}>
          <Upload size={15} /> {loading ? '読み込み中…' : '他の端末から読み込む'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        aria-label="持ち込み用パレットJSON"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void importFile(file);
        }}
      />
      {message && (
        <p className={'palette-feedback' + (error ? ' palette-feedback-error' : '')} role="status">
          {message}
        </p>
      )}
      <p className="hint">
        既存パレットはそのまま残します。同名で色が違う場合は連番を付けて追加します。
      </p>
    </details>
  );
}
