import { useMemo, useRef, useState, type TouchEvent } from 'react';
import { navigate } from '../../app/router';
import { BLOCK_COUNT, blockRanks } from '../../core/blocks';
import { isLocked } from '../../core/scheduler';
import { blockCounts, currentBlock } from '../../core/stats';
import { wordByRank } from '../../data/words';
import { readLocal, writeLocal } from '../../lib/format';
import { useHotkeys } from '../../lib/hotkeys';
import { pluralN, WORD_FORMS } from '../../core/plural';
import { appStore, useApp } from '../../store/store';
import { Button } from '../../ui/Button';
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons';
import { StatusBar } from '../../ui/StatusBar';
import { STATUS_BG, STATUS_LABEL } from '../../ui/status';
import { showToast } from '../../ui/toast';
import { Toggle } from '../../ui/Toggle';

const SHOW_TR_KEY = 'ngsl-sort-translation';

export function SortPage({ block: param }: { block: number | null }) {
  const words = useApp((s) => s.app.words);
  const block = Math.min(Math.max(param ?? currentBlock(words) ?? 1, 1), BLOCK_COUNT);
  const ranks = useMemo(() => blockRanks(block), [block]);
  const [drafts, setDrafts] = useState<Record<number, number[]>>({});
  const [showTr, setShowTr] = useState(() => readLocal(SHOW_TR_KEY) === '1');
  const touch = useRef<{ x: number; y: number } | null>(null);

  const marked = new Set(drafts[block] ?? ranks.filter((r) => words[r]?.s === 'queued'));
  const alreadySorted = ranks.every((r) => words[r]);
  const counts = blockCounts(words, block);

  const go = (b: number) => {
    if (b >= 1 && b <= BLOCK_COUNT) navigate(`/sort/${b}`);
  };

  const toggle = (rank: number) => {
    if (isLocked(words[rank])) return;
    const next = new Set(marked);
    if (next.has(rank)) next.delete(rank);
    else next.add(rank);
    setDrafts({ ...drafts, [block]: [...next] });
  };

  const save = () => {
    appStore.getState().saveBlock(block, marked);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[block];
      return next;
    });
    const queued = ranks.filter((r) => marked.has(r) && !isLocked(words[r])).length;
    showToast(`Блок ${block} збережено: ${pluralN(queued, WORD_FORMS)} у черзі`);
    const next = currentBlock(appStore.getState().app.words);
    if (next) navigate(`/sort/${next}`);
    else {
      showToast('Усі 56 блоків відсортовано!');
      navigate('/');
    }
  };

  useHotkeys({ ArrowLeft: () => go(block - 1), ArrowRight: () => go(block + 1) });

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) go(dx < 0 ? block + 1 : block - 1);
  };

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          aria-label="Попередній блок"
          disabled={block === 1}
          onClick={() => go(block - 1)}
          className="px-2"
        >
          <ChevronLeftIcon />
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-semibold">
            Блок {block} <span className="font-normal text-muted">з {BLOCK_COUNT}</span>
          </h1>
          <p className="font-mono text-sm text-muted">
            {ranks[0]}–{ranks.at(-1)}
          </p>
        </div>
        <Button
          variant="ghost"
          aria-label="Наступний блок"
          disabled={block === BLOCK_COUNT}
          onClick={() => go(block + 1)}
          className="px-2"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="mt-3">
        <StatusBar counts={counts} thin />
      </div>

      <p className="mt-4 text-sm text-muted">
        {alreadySorted
          ? 'Блок уже збережено — можна змінити вибір. Слова, які ти вчиш, заблоковані.'
          : 'Тапни слова, яких не знаєш. Решта стануть «знаю».'}
      </p>

      <div className="mt-2">
        <Toggle
          label="Показати переклад"
          checked={showTr}
          onChange={(v) => {
            setShowTr(v);
            writeLocal(SHOW_TR_KEY, v ? '1' : '0');
          }}
        />
      </div>

      <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Слова блоку ${block}`}>
        {ranks.map((rank) => {
          const w = wordByRank(rank);
          const ws = words[rank];
          const locked = isLocked(ws);
          const on = marked.has(rank) && !locked;
          return (
            <li key={rank} className="max-w-full">
              <button
                type="button"
                aria-pressed={on}
                disabled={locked}
                title={locked && ws ? STATUS_LABEL[ws.s] : undefined}
                onClick={() => toggle(rank)}
                className={`min-h-11 max-w-full rounded-xl border px-3 py-1.5 text-left transition active:scale-[0.97] ${
                  on ? 'border-queued bg-queued/15' : 'border-line bg-surface hover:border-muted/50'
                } ${locked ? 'cursor-default opacity-55' : ''}`}
              >
                <span className="font-serif text-[17px] leading-tight">{w.word}</span>
                {locked && ws && (
                  <span
                    className={`ml-1.5 inline-block size-2 rounded-full align-middle ${STATUS_BG[ws.s]}`}
                  />
                )}
                {showTr && (
                  <span className="block max-w-56 text-xs leading-snug text-muted">
                    {w.translation}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] mt-5 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-2 pl-4 shadow-lg backdrop-blur md:bottom-4">
        <span className="flex-1 text-sm">
          Не знаю: <span className="font-mono font-semibold">{marked.size}</span>
        </span>
        <Button variant="primary" onClick={save}>
          Зберегти блок
        </Button>
      </div>
    </div>
  );
}
