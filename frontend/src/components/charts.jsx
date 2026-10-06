import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, num } from '../utils/format';

// Categorical slots in fixed order (validated palette). Color follows the entity, never rank.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
export const TYPE_COLORS = { food: SERIES[0], household: SERIES[1], utility: SERIES[2], other: SERIES[3] };
const AXIS = { fontSize: 11, fill: '#64748b' };
const GRID = '#eef2f6';
const compact = (v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

function TooltipBox({ active, payload, label, formatter = money, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-medium text-slate-800">{labelFormatter ? labelFormatter(label) : label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey || p.name} className="flex items-center gap-2 text-slate-600">
          <span className="size-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: <span className="num font-medium text-slate-900">{formatter(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function ExpenseDonut({ data, height = 220 }) {
  const rows = data.filter((d) => d.value > 0);
  const total = rows.reduce((s, d) => s + d.value, 0);
  if (!rows.length) return <p className="py-16 text-center text-sm text-slate-400">No expenses yet</p>;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative w-full max-w-[220px]" style={{ height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="94%" paddingAngle={1.5} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {rows.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<TooltipBox />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xs text-slate-500">Total</p>
            <p className="num text-base font-semibold text-slate-900">{money(total)}</p>
          </div>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-2">
        {rows.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-slate-600">{d.label}</span>
            <span className="num ml-auto font-medium text-slate-900">{money(d.value)}</span>
            <span className="num w-11 text-right text-xs text-slate-500">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SimpleBars({ data, dataKey, nameKey = 'name', name, color = SERIES[0], height = 240, formatter = money, horizontal = false }) {
  if (!data.length) return <p className="py-16 text-center text-sm text-slate-400">No data yet</p>;
  if (horizontal) {
    return (
      <div style={{ height: Math.max(height, data.length * 34 + 20) }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatter === money ? compact : undefined} />
            <YAxis type="category" dataKey={nameKey} tick={AXIS} axisLine={false} tickLine={false} width={84} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} content={<TooltipBox formatter={formatter} />} />
            <Bar dataKey={dataKey} name={name} fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -8, right: 4, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={nameKey} tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatter === money ? compact : undefined} width={44} />
          <Tooltip cursor={{ fill: '#f1f5f9' }} content={<TooltipBox formatter={formatter} />} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two or more series side by side (e.g. paid vs used). Always has a legend. */
export function GroupedBars({ data, series, nameKey = 'name', height = 260 }) {
  if (!data.length) return <p className="py-16 text-center text-sm text-slate-400">No data yet</p>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -8, right: 4, top: 8, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={nameKey} tick={AXIS} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
          <Tooltip cursor={{ fill: '#f1f5f9' }} content={<TooltipBox />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#475569' }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { num };
