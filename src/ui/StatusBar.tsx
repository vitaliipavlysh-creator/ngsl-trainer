import type { StatusCounts } from '../core/stats';
import { STATUS_BG, STATUS_LABEL, STATUS_ORDER } from './status';

/** Смуга статусів; з `legend` — підписи з кількістю. */
export function StatusBar({
  counts,
  legend = false,
  thin = false,
}: {
  counts: StatusCounts;
  legend?: boolean;
  thin?: boolean;
}) {
  const total = STATUS_ORDER.reduce((n, s) => n + counts[s], 0) || 1;
  const label = STATUS_ORDER.map((s) => `${STATUS_LABEL[s]}: ${counts[s]}`).join(', ');
  return (
    <div>
      <div
        className={`flex w-full overflow-hidden rounded-full bg-new ${thin ? 'h-1.5' : 'h-3'}`}
        role="img"
        aria-label={label}
      >
        {STATUS_ORDER.map((s) =>
          counts[s] > 0 ? (
            <div
              key={s}
              className={`${STATUS_BG[s]} h-full`}
              style={{ width: `${(counts[s] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      {legend && (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {STATUS_ORDER.map((s) => (
            <li key={s} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className={`size-2.5 shrink-0 rounded-full ${STATUS_BG[s]}`} />
              <span className="text-muted">{STATUS_LABEL[s]}</span>
              <span className="font-mono tabular-nums">{counts[s]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
