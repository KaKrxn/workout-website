"use client";
import { useState } from "react";

export function DataChart({ title, kicker, rows, unit = "", target }: { title: string; kicker?: string; rows: { label: string; value: number }[]; unit?: string; target?: number }) {
  const [table, setTable] = useState(false);
  const max = Math.max(1, target ?? 0, ...rows.map(r => r.value)) * 1.1;
  const points = rows.map((r,i) => `${45 + i * 500 / Math.max(1,rows.length-1)},${190-r.value/max*160}`).join(" ");
  return <section className="ft-card">
    <div className="flex items-start justify-between gap-3"><div><p className="ft-kicker">{kicker}</p><h2 className="text-[17px] font-extrabold">{title}</h2></div><button className="text-sm text-good-text" type="button" onClick={()=>setTable(!table)}>{table ? "Chart" : "Table"}</button></div>
    {!rows.length ? <p className="ft-muted py-10">ยังไม่มีข้อมูล / No data yet</p> : table ? <div className="ft-table-wrap mt-4"><table className="ft-table"><thead><tr><th>Date</th><th>{unit || "Value"}</th></tr></thead><tbody>{rows.map(r=><tr key={r.label}><td>{r.label}</td><td>{r.value.toLocaleString(undefined,{maximumFractionDigits:3})} {unit}</td></tr>)}</tbody></table></div> : <svg viewBox="0 0 580 230" className="mt-4 w-full" role="img" aria-label={title}>
      {[0,1,2,3,4].map(i=><g key={i}><line x1="45" x2="550" y1={190-i*40} y2={190-i*40} stroke="var(--ft-line)"/><text x="38" y={194-i*40} textAnchor="end" fill="var(--ft-muted)" fontSize="10">{(max*i/4).toFixed(max<5?2:0)}</text></g>)}
      {target != null && <line x1="45" x2="550" y1={190-target/max*160} y2={190-target/max*160} stroke="var(--ft-accent-dash)" strokeDasharray="5 5"/>}
      <polyline points={points} fill="none" stroke="var(--ft-accent-strong)" strokeWidth="2.5" strokeLinejoin="round"/>
      {rows.map((r,i)=><circle key={r.label} cx={45+i*500/Math.max(1,rows.length-1)} cy={190-r.value/max*160} r="3" fill="var(--ft-accent-strong)"><title>{r.label}: {r.value} {unit}</title></circle>)}
      <text x="45" y="218" fill="var(--ft-muted)" fontSize="11">{rows[0].label}</text><text x="550" y="218" textAnchor="end" fill="var(--ft-muted)" fontSize="11">{rows.at(-1)?.label}</text>
    </svg>}
  </section>;
}
