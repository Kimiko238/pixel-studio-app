import { useState } from 'react';
import { download, fileName, type Project } from '../model';
import { serializePyxelPalette } from '../utils/palette';

export function PyxelPaletteExport({ project }: { project: Project }) {
  const [error, setError] = useState('');

  const exportPalette = () => {
    try {
      const palette = serializePyxelPalette(project);
      const name = fileName(project.name.trim() || 'palette');
      download(new Blob([palette], { type: 'text/plain' }), name + '.pyxpal');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'パレットを書き出せませんでした。');
    }
  };

  return (
    <>
      <button type="button" onClick={exportPalette}>
        Pyxelパレット
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
