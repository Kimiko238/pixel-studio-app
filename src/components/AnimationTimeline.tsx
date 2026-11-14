/**
 * アニメーションとコマの選択、再生、コマの追加・複製・並べ替えを行う画面。
 * コマの画像はpixelsからcanvasを作り、その画像URLをサムネイルに使う。
 */
import type { StudioController } from '../hooks/usePixelStudio';
import { Pause, Play, Plus, Trash2 } from 'lucide-react';
import { currentAnimation, canvasFromPixels, type Animation } from '../model';
import { ActionButton } from './ActionButton';
type Props = Pick<
  StudioController,
  | 'anim'
  | 'chooseAnimation'
  | 'project'
  | 'addAnimation'
  | 'commit'
  | 'setFrameIndex'
  | 'setPlaying'
  | 'playing'
  | 'active'
  | 'frameRef'
  | 'frameIndex'
  | 'addFrame'
  | 'duplicateFrame'
  | 'moveFrame'
  | 'removeFrame'
>;
export function AnimationTimeline({
  anim,
  chooseAnimation,
  project,
  addAnimation,
  commit,
  setFrameIndex,
  setPlaying,
  playing,
  active,
  frameRef,
  frameIndex,
  addFrame,
  duplicateFrame,
  moveFrame,
  removeFrame,
}: Props) {
  return (
    <div className="timeline">
      <div className="timelinehead">
        <b>アニメーション</b>
        <select value={anim.id} onChange={(e) => chooseAnimation(e.target.value)}>
          {project.animations.map((a) => (
            <option value={a.id} key={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button onClick={addAnimation}>＋ アニメーション</button>
        <button
          onClick={() => {
            const name = prompt('アニメーション名', anim.name);
            if (name)
              commit((p) => {
                currentAnimation(p).name = name;
                return p;
              });
          }}
        >
          名前変更
        </button>
        <button
          onClick={() => {
            if (project.animations.length > 1 && confirm('このアニメーションを削除しますか？')) {
              commit((p) => {
                p.animations = p.animations.filter((a) => a.id !== p.activeAnimation);
                p.activeAnimation = p.animations[0].id;
                return p;
              });
              setFrameIndex(0);
            }
          }}
        >
          削除
        </button>
      </div>
      <div className="playbar">
        <button onClick={() => setPlaying(!playing)}>
          {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? '停止' : '再生'}
        </button>
        <label>
          FPS{' '}
          <input
            type="number"
            min="1"
            max="60"
            value={anim.fps}
            onChange={(e) =>
              commit((p) => {
                currentAnimation(p).fps = Math.max(1, Math.min(60, Number(e.target.value) || 1));
                return p;
              })
            }
          />
        </label>
        <select
          value={anim.mode}
          onChange={(e) =>
            commit((p) => {
              currentAnimation(p).mode = e.target.value as Animation['mode'];
              return p;
            })
          }
        >
          <option value="loop">ループ</option>
          <option value="once">1回再生</option>
          <option value="pingpong">往復</option>
        </select>
        <label>
          コマ時間(ms){' '}
          <input
            type="number"
            min="30"
            max="10000"
            value={active.duration}
            onChange={(e) =>
              commit((p) => {
                currentAnimation(p).frames[frameRef.current].duration = Math.max(
                  30,
                  Number(e.target.value) || 125,
                );
                return p;
              })
            }
          />
        </label>
      </div>
      <div className="frames">
        {anim.frames.map((f, i) => (
          <button
            key={f.id}
            className={'frame ' + (frameIndex === i ? 'active' : '')}
            onClick={() => setFrameIndex(i)}
          >
            <img
              src={canvasFromPixels(f.pixels, project.width, project.height).toDataURL()}
              alt={`コマ ${i + 1}`}
            />
            <span>
              {i + 1}
              {f.link ? ' 🔗' : ''}
            </span>
          </button>
        ))}
        <button className="addframe" onClick={addFrame}>
          <Plus /> コマ追加
        </button>
      </div>
      <div className="button-row frameactions">
        <ActionButton label="複製" onClick={() => duplicateFrame(false)} />
        <ActionButton label="リンク複製" onClick={() => duplicateFrame(true)} />
        <ActionButton
          label="リンク解除"
          onClick={() =>
            commit((p) => {
              delete currentAnimation(p).frames[frameRef.current].link;
              return p;
            })
          }
        />
        <ActionButton label="前へ" onClick={() => moveFrame(-1)} />
        <ActionButton label="次へ" onClick={() => moveFrame(1)} />
        <ActionButton label="コマ削除" onClick={removeFrame} icon={<Trash2 size={15} />} />
      </div>
    </div>
  );
}
