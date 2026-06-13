'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Point = { day: string; cost: number; calls: number };

export function CostChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
        />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          labelFormatter={(label: string) => `Day ${label}`}
          formatter={(value: number, _name, item) => {
            const calls = (item?.payload as Point | undefined)?.calls ?? 0;
            return [`$${Number(value).toFixed(4)} · ${calls} call${calls === 1 ? '' : 's'}`, 'AI spend'];
          }}
        />
        <Area
          type="monotone"
          dataKey="cost"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#costFill)"
          isAnimationActive
          animationDuration={500}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
