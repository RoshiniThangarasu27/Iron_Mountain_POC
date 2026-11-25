import { AUTO_MATCH_THRESHOLD, REVIEW_THRESHOLD } from "@/lib/api";

const TONES = {
  high: "[&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500",
  mid: "[&::-webkit-progress-value]:bg-amber-500 [&::-moz-progress-bar]:bg-amber-500",
  low: "[&::-webkit-progress-value]:bg-rose-500 [&::-moz-progress-bar]:bg-rose-500",
};

export function ScoreBar({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, score));
  const tone = value >= AUTO_MATCH_THRESHOLD ? TONES.high : value >= REVIEW_THRESHOLD ? TONES.mid : TONES.low;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-500">Match score</span>
        <span className="font-semibold tabular-nums text-slate-900">{value.toFixed(1)} / 100</span>
      </div>
      <div className="relative">
        <progress
          value={value}
          max={100}
          aria-label="Match score"
          className={`block h-2 w-full appearance-none overflow-hidden rounded-full bg-slate-100 [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full ${tone}`}
        />
        <span className="absolute -inset-y-1 left-[60%] w-px bg-slate-400" title="Review threshold (60)" />
        <span className="absolute -inset-y-1 left-[85%] w-px bg-slate-700" title="Auto-match threshold (85)" />
      </div>
      <div className="relative h-3 text-[10px] text-slate-400">
        <span className="absolute left-[60%] -translate-x-1/2">review 60</span>
        <span className="absolute left-[85%] -translate-x-1/2">auto 85</span>
      </div>
    </div>
  );
}
