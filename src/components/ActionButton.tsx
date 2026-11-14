/**
 * ラベルと任意のアイコンを表示する共通ボタン。onClickは親から渡された操作。
 */
import type { ReactNode } from 'react';

type Props = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  selected?: boolean;
};

export function ActionButton({ label, onClick, icon, selected = false }: Props) {
  return (
    <button className={'button ' + (selected ? 'selected' : '')} title={label} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
