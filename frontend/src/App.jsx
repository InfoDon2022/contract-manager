import { useState, useEffect, useCallback } from "react";
import api from "./lib/api";

// ─── Helpers ───
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const fmtShort = (n) => { const a = Math.abs(n||0); if(a>=1e6) return `$${(n/1e6).toFixed(1)}M`; if(a>=1e3) return `$${(n/1e3).toFixed(1)}K`; return fmt(n); };
const today = () => new Date().toISOString().slice(0, 10);
const monthLabel = (m) => { const [y, mo] = m.split("-"); return new Date(y, mo - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }); };
const daysDiff = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
const sum = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);
const currentMonth = () => new Date().toISOString().slice(0, 7);

const MONO = `'JetBrains Mono', 'Fira Code', monospace`;
const FONT = `'DM Sans', 'Segoe UI', system-ui, sans-serif`;
const C = {
  bg: "#0f1117", surface: "#181b23", surface2: "#1e222d", border: "#2a2f3c",
  text: "#e8eaf0", textMuted: "#8b91a3", textDim: "#5a6078",
  accent: "#4f8cff", accentSoft: "rgba(79,140,255,.12)",
  green: "#34d399", greenSoft: "rgba(52,211,153,.12)",
  red: "#f87171", redSoft: "rgba(248,113,113,.12)",
  amber: "#fbbf24", amberSoft: "rgba(251,191,36,.12)",
  purple: "#a78bfa",
};
const STATUS_COLORS = {
  draft: "#6b7280", sent: "#3b82f6", received: "#3b82f6", approved: "#8b5cf6",
  partially_paid: "#f59e0b", paid: "#10b981", active: "#10b981", planned: "#6b7280",
  incurred: "#f59e0b", overdue: "#ef4444",
};

const TASK_CODES = [
  { value: "A", label: "A: Implementation Workplan" },
  { value: "B", label: "B: Quarterly Reports" },
  { value: "C", label: "C: Community Network Engagement Meetings" },
  { value: "D", label: "D: Training & Education" },
  { value: "E", label: "E: Lethal Means Safety and Secure Storage" },
  { value: "F", label: "F: Community Response" },
  { value: "G", label: "G: Strategic Plan Project Management" },
  { value: "H", label: "H: Evaluation Dashboard" },
  { value: "OH", label: "OH: Overhead" },
];

const PERSON_NAMES = [
  { value: "Ben", label: "Ben" },
  { value: "Garra", label: "Garra" },
  { value: "Joelle", label: "Joelle" },
  { value: "Meagan", label: "Meagan" },
  { value: "VT Consultant", label: "VT Consultant" },
  { value: "COST", label: "COST (Direct Cost)" },
  { value: "Owner", label: "Owner" },
];

const ENTRY_TYPES = [
  { value: "hourly_labor", label: "Hourly Labor" },
  { value: "flat_fee", label: "Flat Fee" },
  { value: "direct_cost", label: "Direct Cost" },
  { value: "travel_stipend", label: "Travel Stipend" },
];

// ─── Shared Components ───
const Card = ({ children, style }) => <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, ...style }}>{children}</div>;
const StatCard = ({ label, value, sub, color, icon }) => (
  <Card style={{ flex: "1 1 180px", minWidth: 180, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 12, right: 14, fontSize: 22, opacity: 0.25 }}>{icon}</div>
    <div style={{ fontSize: 12, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, color: color || C.text, fontFamily: MONO }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
  </Card>
);
const Badge = ({ status }) => { const col = STATUS_COLORS[status] || C.textMuted; return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, background: col + "20", color: col }}>{status?.replace(/_/g, " ")}</span>; };
const Btn = ({ children, onClick, variant = "primary", style, disabled }) => {
  const styles = { primary: { background: C.accent, color: "#fff", border: "none" }, secondary: { background: C.surface2, color: C.text, border: `1px solid ${C.border}` }, danger: { background: C.redSoft, color: C.red, border: `1px solid ${C.red}30` }, ghost: { background: "transparent", color: C.textMuted, border: "none" } };
  return <button disabled={disabled} onClick={onClick} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: FONT, opacity: disabled ? 0.4 : 1, ...styles[variant], ...style }}>{children}</button>;
};
const Input = ({ label, ...props }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
    {label && <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{label}</label>}
    <input {...props} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, fontFamily: FONT, outline: "none", ...props.style }} />
  </div>
);
const Select = ({ label, options, ...props }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
    {label && <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{label}</label>}
    <select {...props} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 14, fontFamily: FONT, outline: "none" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
const Table = ({ columns, data, onRowClick }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr>{columns.map((c, i) => <th key={i} style={{ textAlign: c.align || "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</th>)}</tr></thead>
      <tbody>
        {data.length === 0 && <tr><td colSpan={columns.length} style={{ padding: 30, textAlign: "center", color: C.textDim }}>No records yet</td></tr>}
        {data.map((row, ri) => (
          <tr key={ri} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? "pointer" : "default" }} onMouseEnter={e => e.currentTarget.style.background = C.surface2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {columns.map((c, ci) => <td key={ci} style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}20`, textAlign: c.align || "left", color: C.text, fontFamily: c.mono ? MONO : FONT }}>{c.render ? c.render(row) : row[c.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
const Modal = ({ title, children, onClose, width }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: width || 520, maxWidth: "95vw", maxHeight: "85vh", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
        <Btn variant="ghost" onClick={onClose} style={{ fontSize: 18, padding: 4 }}>✕</Btn>
      </div>
      {children}
    </div>
  </div>
);
const FormRow = ({ children }) => <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>{children}</div>;
const MiniBar = ({ data, height = 180 }) => {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => Math.abs(d.value)), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, padding: "0 4px" }}>
      {data.map((d, i) => {
        const h = (Math.abs(d.value) / max) * (height - 30);
        const col = d.value >= 0 ? C.green : C.red;
        return (<div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: MONO }}>{fmtShort(d.value)}</div>
          <div style={{ width: "100%", maxWidth: 40, height: h, background: col + "30", borderRadius: 4, border: `1px solid ${col}50` }} />
          <div style={{ fontSize: 10, color: C.textDim }}>{d.label}</div>
        </div>);
      })}
    </div>
  );
};

// ─── Income vs Expenses Chart (pure SVG, no dependencies) ───
function IncomeExpenseChart({ data, height = 200 }) {
  if (!data || data.length === 0) {
    return <div style={{ color: C.textDim, padding: 30, textAlign: "center" }}>Enter weekly cost data to see chart</div>;
  }
  const W = 600;
  const H = height;
  const PAD = { top: 20, right: 20, bottom: 36, left: 64 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expenses]), 1);
  const barGroupW = chartW / data.length;
  const barW = Math.min(barGroupW * 0.32, 28);
  const gap = 3;

  const yTicks = 4;
  const yStep = maxVal / yTicks;

  const toY = (v) => PAD.top + chartH - (v / maxVal) * chartH;
  const profitPoints = data.map((d, i) => {
    const cx = PAD.left + i * barGroupW + barGroupW / 2;
    const cy = toY(Math.max(d.owner_profit, 0));
    return `${cx},${cy}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      {/* Y axis gridlines + labels */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = yStep * i;
        const y = toY(v);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y} stroke={C.border} strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill={C.textDim} fontFamily={MONO}>
              {fmtShort(v)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const groupX = PAD.left + i * barGroupW;
        const centerX = groupX + barGroupW / 2;
        const incomeX = centerX - barW - gap / 2;
        const expenseX = centerX + gap / 2;
        const incomeH = (d.income / maxVal) * chartH;
        const expenseH = (d.expenses / maxVal) * chartH;
        return (
          <g key={i}>
            {/* Income bar */}
            <rect
              x={incomeX} y={toY(d.income)} width={barW} height={incomeH}
              fill={C.accent} fillOpacity={0.7} rx={2}
            />
            {/* Expense bar */}
            <rect
              x={expenseX} y={toY(d.expenses)} width={barW} height={expenseH}
              fill={C.amber} fillOpacity={0.7} rx={2}
            />
            {/* X label */}
            <text x={centerX} y={H - 4} textAnchor="middle" fontSize={9} fill={C.textDim} fontFamily={MONO}>
              {d.month.slice(5)}
            </text>
          </g>
        );
      })}

      {/* Owner profit line */}
      {data.length > 1 && (
        <polyline
          points={profitPoints}
          fill="none"
          stroke={C.green}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}
      {data.map((d, i) => {
        const cx = PAD.left + i * barGroupW + barGroupW / 2;
        const cy = toY(Math.max(d.owner_profit, 0));
        return <circle key={i} cx={cx} cy={cy} r={3} fill={C.green} />;
      })}

      {/* Legend */}
      <rect x={PAD.left} y={4} width={10} height={10} fill={C.accent} fillOpacity={0.7} rx={2} />
      <text x={PAD.left + 14} y={13} fontSize={9} fill={C.textMuted} fontFamily={FONT}>Billable Income</text>
      <rect x={PAD.left + 100} y={4} width={10} height={10} fill={C.amber} fillOpacity={0.7} rx={2} />
      <text x={PAD.left + 114} y={13} fontSize={9} fill={C.textMuted} fontFamily={FONT}>Expenses</text>
      <circle cx={PAD.left + 204} cy={9} r={4} fill={C.green} />
      <text x={PAD.left + 212} y={13} fontSize={9} fill={C.textMuted} fontFamily={FONT}>Owner Profit</text>
    </svg>
  );
}

// ─── Contract Burn Bar ───
function BurnBar({ totalValue, totalBillable }) {
  const pct = totalValue > 0 ? Math.min((totalBillable / totalValue) * 100, 100) : 0;
  const remaining = totalValue - totalBillable;
  const color = pct > 90 ? C.red : pct > 70 ? C.amber : C.green;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
        <span>Contract Burn: {fmt(totalBillable)} of {fmt(totalValue)}</span>
        <span style={{ color }}>{pct.toFixed(1)}% used — {fmt(remaining)} remaining</span>
      </div>
      <div style={{ height: 10, borderRadius: 99, background: C.surface2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${C.accent}, ${color})`, borderRadius: 99, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ─── Dashboard ───
function Dashboard({ contractId }) {
  const [d, setD] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [billing, setBilling] = useState(null);

  const load = useCallback(async () => {
    const [dash, chart] = await Promise.all([
      api.getDashboard(),
      contractId ? api.getDashboardMonthlyChart(contractId) : Promise.resolve([]),
    ]);
    setD(dash);
    setChartData(chart);
    if (contractId) {
      api.getMonthlyBilling(contractId).then(setBilling).catch(() => {});
    }
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  if (!d) return <div style={{ color: C.textDim, padding: 40, textAlign: "center" }}>Loading dashboard...</div>;

  const plData = (d.monthly_pl || []).map(r => ({ label: monthLabel(r.month), value: r.net }));
  const margin = d.margin_pct;
  const totalWeeklyBillable = chartData.reduce((s, m) => s + m.income, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <StatCard label="Cash on Hand" value={fmt(d.cash_on_hand)} icon="💵" color={d.cash_on_hand >= 0 ? C.green : C.red} />
        <StatCard label="Billed to Date" value={fmt(d.total_billed)} sub={`of ${fmt(d.contract_value)}`} icon="📄" color={C.accent} />
        <StatCard label="Collected" value={fmt(d.total_collected)} sub={`AR: ${fmt(d.outstanding_ar)}`} icon="🏦" color={C.green} />
        <StatCard label="Total Costs" value={fmt(d.total_costs)} sub={`AP: ${fmt(d.unpaid_ap)}`} icon="📊" color={C.amber} />
        <StatCard label="Projected Margin" value={`${margin.toFixed(1)}%`} icon="📈" color={margin >= 20 ? C.green : margin >= 0 ? C.amber : C.red} />
      </div>

      {/* Contract burn bar */}
      {d.contract_value > 0 && (
        <Card>
          <BurnBar totalValue={Number(d.contract_value)} totalBillable={totalWeeklyBillable || Number(d.total_billed)} />
        </Card>
      )}

      {/* Income vs Expenses chart */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>INCOME vs EXPENSES (from Weekly Cost Entries)</div>
        <IncomeExpenseChart data={chartData} />
      </Card>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {/* Monthly billing summary */}
        {billing && billing.length > 0 && (
          <Card style={{ flex: "2 1 300px", overflowX: "auto" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>MONTHLY BILLING SUMMARY</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: MONO }}>
              <thead><tr>
                {["Month", "Ops Cost", "+ Margin", "= Billable", "Hours @$145"].map(h => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{billing.map(r => (
                <tr key={r.month_year}>
                  <td style={{ padding: "7px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}20`, fontFamily: FONT }}>{monthLabel(r.month_year)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20` }}>{fmt(r.ops_cost)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.green }}>{fmt(r.allocated_margin)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, fontWeight: 700, color: C.accent }}>{fmt(r.billable)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.textMuted }}>{Number(r.hours_at_145).toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        )}

        <Card style={{ flex: "1 1 240px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>FORECAST CASH FLOW</div>
          {[{days:30,val:d.forecast_30},{days:60,val:d.forecast_60},{days:90,val:d.forecast_90}].map(fw => (
            <div key={fw.days} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}20` }}>
              <span style={{ color: C.textMuted }}>Next {fw.days} days</span>
              <span style={{ fontFamily: MONO, fontWeight: 600, color: fw.val >= 0 ? C.green : C.red }}>{fw.val !== 0 ? fmtShort(fw.val) : "—"}</span>
            </div>
          ))}
        </Card>
      </div>

      {d.action_items.length > 0 && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>ACTION ITEMS</div>
          {d.action_items.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < d.action_items.length - 1 ? `1px solid ${C.border}20` : "none" }}>
              <span style={{ fontSize: 18 }}>{a.icon}</span>
              <span style={{ flex: 1 }}>{a.text}</span>
              <Badge status={a.priority} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Weekly Costs ───
function WeeklyCosts({ contractId }) {
  const [summary, setSummary] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!contractId) return;
    const s = await api.getWeeklySummary(contractId);
    setSummary(s);
    if (!selectedWeek && s.weeks?.length > 0) {
      setSelectedWeek(s.weeks[s.weeks.length - 1].week_number);
    }
  }, [contractId, selectedWeek]);

  useEffect(() => { load(); }, [load]);

  const selectedWeekData = summary?.weeks?.find(w => w.week_number === selectedWeek);

  const openNew = () => {
    const ws = selectedWeekData;
    setForm({
      contract_id: contractId,
      week_number: selectedWeek || 1,
      week_start: ws?.week_start || today(),
      week_end: ws?.week_end || today(),
      person_name: "Ben",
      major_task: "",
      task_code: "A",
      subtask_description: "",
      entry_type: "hourly_labor",
      hourly_rate: "125",
      hours: "",
      flat_amount: "",
    });
    setModal("new");
  };

  const openEdit = (entry) => {
    setForm({ ...entry });
    setModal("edit");
  };

  const save = async () => {
    setSaving(true);
    try {
      const isHourly = form.entry_type === "hourly_labor";
      const f = {
        ...form,
        week_number: Number(form.week_number),
        hourly_rate: isHourly ? (Number(form.hourly_rate) || null) : null,
        hours: isHourly ? (Number(form.hours) || null) : null,
        flat_amount: !isHourly ? (Number(form.flat_amount) || null) : null,
      };
      if (modal === "new") await api.createWeeklyEntry(f);
      else await api.updateWeeklyEntry(f.id, f);
      setModal(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await api.deleteWeeklyEntry(form.id);
    setModal(null);
    setSelectedWeek(null);
    await load();
  };

  const isHourly = form.entry_type === "hourly_labor";

  const columns = [
    { label: "Person", render: r => <span style={{ fontWeight: 600 }}>{r.person_name}</span> },
    { label: "Task", render: r => <span style={{ color: C.accent }}>{r.task_code}</span> },
    { label: "Major Task", render: r => r.major_task || "—" },
    { label: "Subtask", render: r => <span style={{ color: C.textMuted, fontSize: 12 }}>{r.subtask_description || "—"}</span> },
    { label: "Type", render: r => <Badge status={r.entry_type} /> },
    { label: "Hours", align: "right", mono: true, render: r => r.hours != null ? Number(r.hours).toFixed(2) : "—" },
    { label: "Rate", align: "right", mono: true, render: r => r.hourly_rate != null ? fmt(r.hourly_rate) : "—" },
    { label: "Cost", align: "right", mono: true, render: r => <span style={{ fontWeight: 600, color: C.amber }}>{fmt(r.line_cost)}</span> },
  ];

  if (!summary) return <div style={{ color: C.textDim, padding: 40, textAlign: "center" }}>Loading...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Contract totals */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <StatCard label="Total Ops Cost" value={fmtShort(summary.total_ops)} icon="💼" color={C.amber} />
        <StatCard label="Owner Draw" value={fmtShort(summary.owner_draw)} sub="Contract Value − Ops" icon="👤" color={C.green} />
        <StatCard label="Contract Value" value={fmtShort(summary.contract_value)} icon="📋" color={C.accent} />
        <StatCard label="Total Weeks" value={summary.weeks?.length || 0} sub="with entries" icon="📅" />
      </div>

      {/* Week picker + weekly summary table */}
      <Card style={{ overflowX: "auto" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>WEEKLY SUMMARY — all margins reflect entries to date</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: MONO }}>
          <thead><tr>
            {["Week", "Dates", "Ops Cost", "Margin", "Billable", "Hours @$145"].map(h => (
              <th key={h} style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(summary.weeks || []).map(w => (
              <tr
                key={w.week_number}
                onClick={() => setSelectedWeek(w.week_number)}
                style={{ cursor: "pointer", background: selectedWeek === w.week_number ? C.accentSoft : "transparent" }}
                onMouseEnter={e => { if (selectedWeek !== w.week_number) e.currentTarget.style.background = C.surface2; }}
                onMouseLeave={e => { e.currentTarget.style.background = selectedWeek === w.week_number ? C.accentSoft : "transparent"; }}
              >
                <td style={{ padding: "7px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}20`, fontFamily: FONT, fontWeight: 600, color: selectedWeek === w.week_number ? C.accent : C.text }}>Week {w.week_number}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.textMuted }}>{w.week_start} – {w.week_end}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20` }}>{fmt(w.ops_cost)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.green }}>{fmt(w.allocated_margin)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, fontWeight: 700, color: C.accent }}>{fmt(w.billable)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.textMuted }}>{(w.billable / 145).toFixed(2)}</td>
              </tr>
            ))}
            {!summary.weeks?.length && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: C.textDim }}>No entries yet — add your first week below</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Selected week entries */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {selectedWeekData
              ? `Week ${selectedWeekData.week_number} — ${selectedWeekData.week_start} to ${selectedWeekData.week_end}`
              : "Select a week above, or add a new entry"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selectedWeekData && (
              <div style={{ fontSize: 13, color: C.textMuted, alignSelf: "center" }}>
                {selectedWeekData.entries.length} entries · {fmt(selectedWeekData.ops_cost)} ops · {fmt(selectedWeekData.billable)} billable
              </div>
            )}
            <Btn onClick={openNew}>+ Add Entry</Btn>
          </div>
        </div>
        {selectedWeekData && (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <Table columns={columns} data={selectedWeekData.entries} onRowClick={openEdit} />
          </Card>
        )}
      </div>

      {/* Add/Edit modal */}
      {modal && (
        <Modal title={modal === "new" ? "Add Weekly Entry" : "Edit Entry"} onClose={() => setModal(null)} width={580}>
          <FormRow>
            <Select label="Person" value={form.person_name || "Ben"} onChange={e => setForm({ ...form, person_name: e.target.value })} options={PERSON_NAMES} />
            <Select label="Task Code" value={form.task_code || "A"} onChange={e => setForm({ ...form, task_code: e.target.value })} options={TASK_CODES} />
          </FormRow>
          <FormRow>
            <Input label="Major Task" value={form.major_task || ""} onChange={e => setForm({ ...form, major_task: e.target.value })} placeholder="e.g. Network Mtg #1 (May)" />
            <Select label="Entry Type" value={form.entry_type || "hourly_labor"} onChange={e => setForm({ ...form, entry_type: e.target.value })} options={ENTRY_TYPES} />
          </FormRow>
          <FormRow>
            <Input label="Subtask Description" value={form.subtask_description || ""} onChange={e => setForm({ ...form, subtask_description: e.target.value })} placeholder="e.g. Pre-meeting planning" />
          </FormRow>
          {isHourly ? (
            <FormRow>
              <Input label="Hours" type="number" step="0.25" value={form.hours || ""} onChange={e => setForm({ ...form, hours: e.target.value })} placeholder="0.00" />
              <Input label="Hourly Rate ($)" type="number" value={form.hourly_rate || ""} onChange={e => setForm({ ...form, hourly_rate: e.target.value })} placeholder="125" />
            </FormRow>
          ) : (
            <FormRow>
              <Input label="Flat Amount ($)" type="number" value={form.flat_amount || ""} onChange={e => setForm({ ...form, flat_amount: e.target.value })} placeholder="0.00" />
            </FormRow>
          )}
          <FormRow>
            <Input label="Week Number" type="number" value={form.week_number || ""} onChange={e => setForm({ ...form, week_number: e.target.value })} />
            <Input label="Week Start" type="date" value={form.week_start || ""} onChange={e => setForm({ ...form, week_start: e.target.value })} />
            <Input label="Week End" type="date" value={form.week_end || ""} onChange={e => setForm({ ...form, week_end: e.target.value })} />
          </FormRow>
          {isHourly && form.hours && form.hourly_rate && (
            <div style={{ background: C.greenSoft, border: `1px solid ${C.green}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontFamily: MONO, fontSize: 13 }}>
              Line cost: {fmt(Number(form.hours) * Number(form.hourly_rate))}
            </div>
          )}
          {!isHourly && form.flat_amount && (
            <div style={{ background: C.amberSoft, border: `1px solid ${C.amber}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontFamily: MONO, fontSize: 13 }}>
              Flat amount: {fmt(Number(form.flat_amount))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            {modal === "edit" && <Btn variant="danger" onClick={remove}>Delete</Btn>}
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving || !form.week_number || !form.week_start}>
              {saving ? "Saving..." : "Save"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Task Allocations ───
function TaskAllocations({ contractId }) {
  const [allocations, setAllocations] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [filterMonth, setFilterMonth] = useState(currentMonth());
  const [filterVendor, setFilterVendor] = useState("");
  const [payout, setPayout] = useState(null);
  const [payoutMonth, setPayoutMonth] = useState(currentMonth());

  const load = useCallback(async () => {
    const [a, v] = await Promise.all([
      api.listTaskAllocations(contractId, filterVendor || null, filterMonth || null),
      api.listVendors(),
    ]);
    setAllocations(a);
    setVendors(v.filter(v => v.vendor_type === "subcontractor"));
  }, [contractId, filterMonth, filterVendor]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({
      contract_id: contractId,
      vendor_id: vendors[0]?.id || "",
      major_task_name: "",
      total_task_payment: "",
      month_year: currentMonth(),
      month_amount: "",
      percent_of_task: "",
    });
    setModal("new");
  };
  const openEdit = (r) => { setForm({ ...r }); setModal("edit"); };
  const save = async () => {
    const f = {
      ...form,
      total_task_payment: Number(form.total_task_payment) || 0,
      month_amount: Number(form.month_amount) || 0,
      percent_of_task: Number(form.percent_of_task) || 0,
    };
    if (modal === "new") await api.createTaskAllocation(f);
    else await api.updateTaskAllocation(f.id, f);
    setModal(null);
    load();
  };
  const remove = async () => { await api.deleteTaskAllocation(form.id); setModal(null); load(); };

  const runPayout = async () => {
    const result = await api.getPayoutReport(contractId, payoutMonth);
    setPayout(result);
  };

  const vName = (vid) => vendors.find(v => v.id === vid)?.display_name || vid;

  const columns = [
    { label: "Vendor", render: r => <span style={{ fontWeight: 600 }}>{vName(r.vendor_id)}</span> },
    { label: "Major Task", render: r => r.major_task_name },
    { label: "Month", render: r => monthLabel(r.month_year) },
    { label: "Task Total", align: "right", mono: true, render: r => fmt(r.total_task_payment) },
    { label: "% of Task", align: "right", mono: true, render: r => `${(Number(r.percent_of_task) * 100).toFixed(1)}%` },
    { label: "Month Amount", align: "right", mono: true, render: r => <span style={{ fontWeight: 700, color: C.accent }}>{fmt(r.month_amount)}</span> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Payout report */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>SUBCONTRACTOR PAYOUT REPORT</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Input label="Month" type="month" value={payoutMonth} onChange={e => setPayoutMonth(e.target.value)} style={{ maxWidth: 200 }} />
          <Btn onClick={runPayout}>Generate Payout</Btn>
        </div>
        {payout && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Payouts for {monthLabel(payout.month_year)}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: MONO }}>
              <thead><tr>
                {["Vendor", "Task", "% of Task", "Amount Due"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {payout.lines.map((l, i) => (
                  <tr key={i}>
                    <td style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}20`, fontFamily: FONT, fontWeight: 600 }}>{l.vendor_name}</td>
                    <td style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}20`, fontFamily: FONT }}>{l.major_task_name}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20` }}>{(l.percent_of_task * 100).toFixed(1)}%</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, fontWeight: 700, color: C.accent }}>{fmt(l.month_amount)}</td>
                  </tr>
                ))}
                {payout.lines.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: C.textDim }}>No allocations for this month</td></tr>
                )}
              </tbody>
              {Object.keys(payout.vendor_totals).length > 0 && (
                <tfoot>
                  {Object.entries(payout.vendor_totals).map(([name, total]) => (
                    <tr key={name}>
                      <td style={{ padding: "8px 10px", fontFamily: FONT, fontWeight: 700, color: C.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }} colSpan={3}>{name} Total</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: C.green }}>{fmt(total)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${C.border}` }}>
                    <td style={{ padding: "10px 10px", fontFamily: FONT, fontWeight: 700, fontSize: 13 }} colSpan={3}>Grand Total</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: MONO, fontWeight: 700, fontSize: 15, color: C.accent }}>{fmt(payout.grand_total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>

      {/* Allocation list */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Input label="Filter Month" type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ maxWidth: 160 }} />
            <Select label="Filter Vendor" value={filterVendor} onChange={e => setFilterVendor(e.target.value)} options={[{ value: "", label: "All Vendors" }, ...vendors.map(v => ({ value: v.id, label: v.display_name }))]} />
          </div>
          <Btn onClick={openNew} disabled={!vendors.length}>+ Add Allocation</Btn>
        </div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Table columns={columns} data={allocations} onRowClick={openEdit} />
        </Card>
      </div>

      {modal && (
        <Modal title={modal === "new" ? "Add Task Allocation" : "Edit Allocation"} onClose={() => setModal(null)} width={560}>
          <FormRow>
            <Select label="Vendor" value={form.vendor_id || ""} onChange={e => setForm({ ...form, vendor_id: e.target.value })} options={vendors.map(v => ({ value: v.id, label: v.display_name }))} />
            <Input label="Month" type="month" value={form.month_year || ""} onChange={e => setForm({ ...form, month_year: e.target.value })} />
          </FormRow>
          <FormRow>
            <Input label="Major Task Name" value={form.major_task_name || ""} onChange={e => setForm({ ...form, major_task_name: e.target.value })} placeholder="e.g. Network Mtg #1 (May)" />
          </FormRow>
          <FormRow>
            <Input label="Total Task Payment ($)" type="number" value={form.total_task_payment || ""} onChange={e => setForm({ ...form, total_task_payment: e.target.value })} />
            <Input label="Month Amount ($)" type="number" value={form.month_amount || ""} onChange={e => setForm({ ...form, month_amount: e.target.value })} />
          </FormRow>
          <FormRow>
            <Input label="% of Task (0–1)" type="number" step="0.0001" value={form.percent_of_task || ""} onChange={e => setForm({ ...form, percent_of_task: e.target.value })} placeholder="e.g. 0.25 for 25%" />
          </FormRow>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            {modal === "edit" && <Btn variant="danger" onClick={remove}>Delete</Btn>}
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.vendor_id || !form.major_task_name}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Owner Profit ───
function OwnerProfit({ contractId }) {
  const [records, setRecords] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [computing, setComputing] = useState(false);

  const load = useCallback(async () => {
    if (!contractId) return;
    setRecords(await api.listOwnerProfit(contractId));
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({
      contract_id: contractId,
      month_year: currentMonth(),
      gross_income: "",
      subcontractor_costs: "",
      direct_expenses: "",
      indirect_expenses: "0",
      tax_rate: "0.40",
    });
    setModal("new");
  };
  const openEdit = (r) => { setForm({ ...r, tax_rate: Number(r.tax_rate).toFixed(2) }); setModal("edit"); };

  const autoCompute = async () => {
    if (!form.month_year) return;
    setComputing(true);
    try {
      const result = await api.autoComputeProfit(contractId, form.month_year);
      setForm(f => ({
        ...f,
        gross_income: result.gross_income,
        subcontractor_costs: result.subcontractor_costs,
        direct_expenses: result.direct_expenses,
        indirect_expenses: result.indirect_expenses,
        tax_rate: result.tax_rate,
      }));
    } finally {
      setComputing(false);
    }
  };

  const save = async () => {
    const f = {
      ...form,
      gross_income: Number(form.gross_income) || 0,
      subcontractor_costs: Number(form.subcontractor_costs) || 0,
      direct_expenses: Number(form.direct_expenses) || 0,
      indirect_expenses: Number(form.indirect_expenses) || 0,
      tax_rate: Number(form.tax_rate) || 0.40,
    };
    if (modal === "new") await api.createOwnerProfit(f);
    else await api.updateOwnerProfit(f.id, f);
    setModal(null);
    load();
  };
  const remove = async () => { await api.deleteOwnerProfit(form.id); setModal(null); load(); };

  // Local preview calculation
  const gi = Number(form.gross_income) || 0;
  const sc = Number(form.subcontractor_costs) || 0;
  const de = Number(form.direct_expenses) || 0;
  const ie = Number(form.indirect_expenses) || 0;
  const tr = Number(form.tax_rate) || 0.40;
  const op = gi - sc - de - ie;
  const ts = op * tr;
  const np = op - ts;

  const columns = [
    { label: "Month", render: r => <span style={{ fontWeight: 600 }}>{monthLabel(r.month_year)}</span> },
    { label: "Gross Income", align: "right", mono: true, render: r => <span style={{ color: C.green }}>{fmt(r.gross_income)}</span> },
    { label: "Sub Costs", align: "right", mono: true, render: r => fmt(r.subcontractor_costs) },
    { label: "Direct Exp", align: "right", mono: true, render: r => fmt(r.direct_expenses) },
    { label: "Indirect Exp", align: "right", mono: true, render: r => fmt(r.indirect_expenses) },
    { label: "Owner Profit", align: "right", mono: true, render: r => <span style={{ fontWeight: 700, color: Number(r.owner_profit) >= 0 ? C.green : C.red }}>{fmt(r.owner_profit)}</span> },
    { label: "Tax Set-Aside (40%)", align: "right", mono: true, render: r => <span style={{ color: C.amber }}>{fmt(r.tax_set_aside)}</span> },
    { label: "Net Profit", align: "right", mono: true, render: r => <span style={{ fontWeight: 700, color: Number(r.net_profit) >= 0 ? C.accent : C.red }}>{fmt(r.net_profit)}</span> },
  ];

  const totals = records.reduce((acc, r) => ({
    gi: acc.gi + Number(r.gross_income),
    sc: acc.sc + Number(r.subcontractor_costs),
    de: acc.de + Number(r.direct_expenses),
    ie: acc.ie + Number(r.indirect_expenses),
    op: acc.op + Number(r.owner_profit),
    ts: acc.ts + Number(r.tax_set_aside),
    np: acc.np + Number(r.net_profit),
  }), { gi: 0, sc: 0, de: 0, ie: 0, op: 0, ts: 0, np: 0 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary totals */}
      {records.length > 0 && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <StatCard label="Total Income" value={fmtShort(totals.gi)} icon="📥" color={C.green} />
          <StatCard label="Total Expenses" value={fmtShort(totals.sc + totals.de + totals.ie)} icon="📤" color={C.amber} />
          <StatCard label="Owner Profit" value={fmtShort(totals.op)} icon="👤" color={totals.op >= 0 ? C.green : C.red} />
          <StatCard label="Tax Set-Aside" value={fmtShort(totals.ts)} sub="40% of profit" icon="🏛" color={C.amber} />
          <StatCard label="Net After Tax" value={fmtShort(totals.np)} icon="💰" color={totals.np >= 0 ? C.accent : C.red} />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 13, color: C.textMuted }}>{records.length} month(s) tracked</div>
        <Btn onClick={openNew}>+ Add Month</Btn>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Table columns={columns} data={records} onRowClick={openEdit} />
      </Card>

      {modal && (
        <Modal title={modal === "new" ? "Add Profit Record" : "Edit Profit Record"} onClose={() => setModal(null)} width={540}>
          <FormRow>
            <Input label="Month" type="month" value={form.month_year || ""} onChange={e => setForm({ ...form, month_year: e.target.value })} />
            <Btn variant="secondary" onClick={autoCompute} disabled={computing || !form.month_year} style={{ alignSelf: "flex-end" }}>
              {computing ? "Computing..." : "⚡ Auto-Compute"}
            </Btn>
          </FormRow>
          <div style={{ background: C.surface2, borderRadius: 8, padding: "8px 14px", marginBottom: 14, fontSize: 12, color: C.textMuted }}>
            Auto-Compute pulls gross income from client invoices and costs from weekly entries for the selected month.
          </div>
          <FormRow>
            <Input label="Gross Income ($)" type="number" value={form.gross_income || ""} onChange={e => setForm({ ...form, gross_income: e.target.value })} />
          </FormRow>
          <FormRow>
            <Input label="Subcontractor Costs ($)" type="number" value={form.subcontractor_costs || ""} onChange={e => setForm({ ...form, subcontractor_costs: e.target.value })} />
            <Input label="Direct Expenses ($)" type="number" value={form.direct_expenses || ""} onChange={e => setForm({ ...form, direct_expenses: e.target.value })} />
          </FormRow>
          <FormRow>
            <Input label="Indirect Expenses ($)" type="number" value={form.indirect_expenses || ""} onChange={e => setForm({ ...form, indirect_expenses: e.target.value })} />
            <Input label="Tax Rate (e.g. 0.40)" type="number" step="0.01" value={form.tax_rate || ""} onChange={e => setForm({ ...form, tax_rate: e.target.value })} />
          </FormRow>
          {/* Live preview */}
          <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Preview</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 0", fontFamily: MONO, fontSize: 13 }}>
              <span style={{ color: C.textMuted }}>Owner Profit</span>
              <span style={{ textAlign: "right", color: op >= 0 ? C.green : C.red, fontWeight: 700 }}>{fmt(op)}</span>
              <span style={{ color: C.textMuted }}>Tax Set-Aside ({(tr * 100).toFixed(0)}%)</span>
              <span style={{ textAlign: "right", color: C.amber }}>{fmt(ts)}</span>
              <span style={{ color: C.textMuted, fontWeight: 600 }}>Net After Tax</span>
              <span style={{ textAlign: "right", color: np >= 0 ? C.accent : C.red, fontWeight: 700 }}>{fmt(np)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            {modal === "edit" && <Btn variant="danger" onClick={remove}>Delete</Btn>}
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.month_year}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Vendors ───
function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [bills, setBills] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const load = useCallback(async () => {
    const [v, b] = await Promise.all([api.listVendors(), api.listVendorBills()]);
    setVendors(v); setBills(b);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ vendor_type: "subcontractor", display_name: "", legal_name: "", email: "", phone: "", w9_received: false, active: true, notes: "" }); setModal("new"); };
  const openEdit = (v) => { setForm({ ...v }); setModal("edit"); };
  const save = async () => {
    if (modal === "new") await api.createVendor(form);
    else await api.updateVendor(form.id, form);
    setModal(null); load();
  };
  const remove = async () => { await api.deleteVendor(form.id); setModal(null); load(); };

  const openBillCount = (vid) => bills.filter(b => b.vendor_id === vid && b.status !== "paid").length;

  const columns = [
    { label: "Name", render: r => <span style={{ fontWeight: 600 }}>{r.display_name}</span> },
    { label: "Type", render: r => <Badge status={r.vendor_type} /> },
    { label: "W-9", render: r => r.w9_received ? <span style={{ color: C.green }}>✓ Received</span> : <span style={{ color: C.red }}>✗ Missing</span> },
    { label: "Open Bills", align: "center", render: r => openBillCount(r.id) },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.textMuted }}>{vendors.length} vendor(s)</div>
        <Btn onClick={openNew}>+ Add Vendor</Btn>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}><Table columns={columns} data={vendors} onRowClick={openEdit} /></Card>
      {modal && (
        <Modal title={modal === "new" ? "Add Vendor" : "Edit Vendor"} onClose={() => setModal(null)}>
          <FormRow><Input label="Display Name" value={form.display_name||""} onChange={e => setForm({...form, display_name: e.target.value})} /><Select label="Type" value={form.vendor_type||"subcontractor"} onChange={e => setForm({...form, vendor_type: e.target.value})} options={[{value:"subcontractor",label:"Subcontractor"},{value:"venue",label:"Venue"},{value:"tech",label:"Technology"},{value:"other",label:"Other"}]} /></FormRow>
          <FormRow><Input label="Legal Name" value={form.legal_name||""} onChange={e => setForm({...form, legal_name: e.target.value})} /><Input label="Email" value={form.email||""} onChange={e => setForm({...form, email: e.target.value})} /></FormRow>
          <FormRow><Input label="Phone" value={form.phone||""} onChange={e => setForm({...form, phone: e.target.value})} /></FormRow>
          <FormRow><label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={form.w9_received||false} onChange={e => setForm({...form, w9_received: e.target.checked})} style={{ width: 18, height: 18, accentColor: C.accent }} /><span style={{ fontSize: 13 }}>W-9 Received</span></label></FormRow>
          <FormRow><Input label="Notes" value={form.notes||""} onChange={e => setForm({...form, notes: e.target.value})} /></FormRow>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            {modal === "edit" && <Btn variant="danger" onClick={remove}>Delete</Btn>}
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.display_name}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Client Invoices ───
function ClientInvoices({ contractId }) {
  const [invoices, setInvoices] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [payForm, setPayForm] = useState({});
  const [payModal, setPayModal] = useState(null);
  const [invoiceGen, setInvoiceGen] = useState(null);
  const [genMonth, setGenMonth] = useState(currentMonth());

  const load = useCallback(async () => { setInvoices(await api.listClientInvoices(contractId)); }, [contractId]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ contract_id: contractId, invoice_number: "", invoice_date: today(), due_date: "", billing_period_start: "", billing_period_end: "", amount: "", status: "draft", notes: "" }); setModal("new"); };
  const openEdit = (r) => { setForm({ ...r }); setModal("edit"); };
  const save = async () => {
    const f = { ...form, amount: Number(form.amount) || 0 };
    if (modal === "new") await api.createClientInvoice(f);
    else await api.updateClientInvoice(f.id, f);
    setModal(null); load();
  };
  const remove = async () => { await api.deleteClientInvoice(form.id); setModal(null); load(); };

  const openPay = (inv) => { setPayForm({ client_invoice_id: inv.id, payment_date: today(), amount: inv.amount, payment_method: "check", reference: "", deposited_to_account: "" }); setPayModal("pay"); };
  const savePay = async () => {
    await api.createClientPayment(payForm.client_invoice_id, { ...payForm, amount: Number(payForm.amount) || 0 });
    setPayModal(null); load();
  };

  const runGenerate = async () => {
    const result = await api.generateInvoice(contractId, genMonth);
    setInvoiceGen(result);
  };

  const useGeneratedAmount = () => {
    if (!invoiceGen) return;
    const mn = invoiceGen.month_year;
    const [yr, mo] = mn.split("-");
    const lastDay = new Date(yr, mo, 0).getDate();
    setForm({
      contract_id: contractId,
      invoice_number: "",
      invoice_date: today(),
      due_date: "",
      billing_period_start: `${mn}-01`,
      billing_period_end: `${mn}-${lastDay}`,
      amount: invoiceGen.total_amount.toFixed(2),
      status: "draft",
      notes: `Auto-generated from weekly entries. ${invoiceGen.total_hours.toFixed(2)} hrs @ $145/hr.`,
    });
    setModal("new");
  };

  const columns = [
    { label: "Invoice #", render: r => <span style={{ fontWeight: 600 }}>{r.invoice_number || "—"}</span> },
    { label: "Date", key: "invoice_date" },
    { label: "Amount", align: "right", mono: true, render: r => fmt(r.amount) },
    { label: "Status", render: r => <Badge status={r.status} /> },
    { label: "", render: r => r.status !== "paid" && <Btn variant="secondary" onClick={e => { e.stopPropagation(); openPay(r); }} style={{ padding: "4px 10px", fontSize: 11 }}>Record Payment</Btn> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Invoice Generator */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>INVOICE GENERATOR — from Weekly Cost Entries</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Input label="Billing Month" type="month" value={genMonth} onChange={e => setGenMonth(e.target.value)} style={{ maxWidth: 200 }} />
          <Btn onClick={runGenerate}>Calculate Invoice</Btn>
        </div>
        {invoiceGen && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: C.textMuted }}>
                {invoiceGen.client_name} — {monthLabel(invoiceGen.month_year)} — {invoiceGen.total_hours.toFixed(2)} hrs @ ${invoiceGen.billing_rate}/hr
              </div>
              <Btn variant="secondary" onClick={useGeneratedAmount} style={{ fontSize: 12, padding: "5px 12px" }}>
                → Create Invoice Draft
              </Btn>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: MONO }}>
              <thead><tr>
                {["Task Code", "Billable Amount", "Hours @ $145"].map(h => (
                  <th key={h} style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {invoiceGen.lines.map(l => (
                  <tr key={l.task_code}>
                    <td style={{ padding: "7px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}20`, fontFamily: FONT, fontWeight: 600, color: C.accent }}>{l.task_code}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20` }}>{fmt(l.billable_amount)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20` }}>{l.hours_equivalent.toFixed(2)} hrs</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${C.border}` }}>
                  <td style={{ padding: "10px 10px", fontFamily: FONT, fontWeight: 700 }}>Total</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: C.accent }}>{fmt(invoiceGen.total_amount)}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: MONO, fontWeight: 700 }}>{invoiceGen.total_hours.toFixed(2)} hrs</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 10, fontSize: 11, color: C.textDim, fontFamily: MONO }}>
              Ops cost: {fmt(invoiceGen.ops_cost)} · Owner margin: {fmt(invoiceGen.owner_margin)}
            </div>
          </div>
        )}
      </Card>

      {/* Invoice list */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{invoices.length} invoice(s) — {fmt(sum(invoices, "amount"))} total billed</div>
          <Btn onClick={openNew}>+ New Invoice</Btn>
        </div>
        <Card style={{ padding: 0, overflow: "hidden" }}><Table columns={columns} data={invoices} onRowClick={openEdit} /></Card>
      </div>

      {modal && (
        <Modal title={modal === "new" ? "New Client Invoice" : "Edit Invoice"} onClose={() => setModal(null)}>
          <FormRow><Input label="Invoice Number" value={form.invoice_number||""} onChange={e => setForm({...form, invoice_number: e.target.value})} /><Input label="Amount" type="number" value={form.amount||""} onChange={e => setForm({...form, amount: e.target.value})} /></FormRow>
          <FormRow><Input label="Invoice Date" type="date" value={form.invoice_date||""} onChange={e => setForm({...form, invoice_date: e.target.value})} /><Input label="Due Date" type="date" value={form.due_date||""} onChange={e => setForm({...form, due_date: e.target.value})} /></FormRow>
          <FormRow><Input label="Period Start" type="date" value={form.billing_period_start||""} onChange={e => setForm({...form, billing_period_start: e.target.value})} /><Input label="Period End" type="date" value={form.billing_period_end||""} onChange={e => setForm({...form, billing_period_end: e.target.value})} /></FormRow>
          <FormRow><Select label="Status" value={form.status||"draft"} onChange={e => setForm({...form, status: e.target.value})} options={[{value:"draft",label:"Draft"},{value:"sent",label:"Sent"},{value:"partially_paid",label:"Partially Paid"},{value:"paid",label:"Paid"}]} /></FormRow>
          <FormRow><Input label="Notes" value={form.notes||""} onChange={e => setForm({...form, notes: e.target.value})} /></FormRow>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            {modal === "edit" && <Btn variant="danger" onClick={remove}>Delete</Btn>}
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.amount}>Save</Btn>
          </div>
        </Modal>
      )}
      {payModal && (
        <Modal title="Record Client Payment" onClose={() => setPayModal(null)} width={400}>
          <FormRow><Input label="Payment Date" type="date" value={payForm.payment_date||""} onChange={e => setPayForm({...payForm, payment_date: e.target.value})} /></FormRow>
          <FormRow><Input label="Amount" type="number" value={payForm.amount||""} onChange={e => setPayForm({...payForm, amount: e.target.value})} /></FormRow>
          <FormRow><Select label="Method" value={payForm.payment_method||"check"} onChange={e => setPayForm({...payForm, payment_method: e.target.value})} options={[{value:"check",label:"Check"},{value:"ach",label:"ACH"},{value:"wire",label:"Wire"},{value:"other",label:"Other"}]} /></FormRow>
          <FormRow><Input label="Reference" value={payForm.reference||""} onChange={e => setPayForm({...payForm, reference: e.target.value})} /></FormRow>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => setPayModal(null)}>Cancel</Btn>
            <Btn onClick={savePay} disabled={!payForm.amount}>Save Payment</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Vendor Bills ───
function VendorBills({ contractId }) {
  const [bills, setBills] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [workstreams, setWorkstreams] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [payForm, setPayForm] = useState({});
  const [payModal, setPayModal] = useState(null);

  const load = useCallback(async () => {
    const [b, v, w] = await Promise.all([api.listVendorBills(contractId), api.listVendors(), api.listWorkstreams(contractId)]);
    setBills(b); setVendors(v); setWorkstreams(w);
  }, [contractId]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ vendor_id: vendors[0]?.id || "", contract_id: contractId, workstream_id: "", bill_number: "", bill_date: today(), due_date: "", service_period_start: "", service_period_end: "", amount: "", status: "received", expense_category: "", notes: "" }); setModal("new"); };
  const openEdit = (r) => { setForm({ ...r }); setModal("edit"); };
  const save = async () => {
    const f = { ...form, amount: Number(form.amount) || 0, workstream_id: form.workstream_id || null };
    if (modal === "new") await api.createVendorBill(f);
    else await api.updateVendorBill(f.id, f);
    setModal(null); load();
  };
  const remove = async () => { await api.deleteVendorBill(form.id); setModal(null); load(); };

  const openPay = (bill) => { setPayForm({ vendor_bill_id: bill.id, payment_date: today(), amount: bill.amount, payment_method: "check", reference: "", paid_from_account: "" }); setPayModal("pay"); };
  const savePay = async () => {
    await api.createVendorPayment(payForm.vendor_bill_id, { ...payForm, amount: Number(payForm.amount) || 0 });
    setPayModal(null); load();
  };

  const vName = (vid) => vendors.find(v => v.id === vid)?.display_name || "—";
  const wsName = (wsid) => workstreams.find(w => w.id === wsid)?.name || "—";

  const columns = [
    { label: "Vendor", render: r => <span style={{ fontWeight: 600 }}>{vName(r.vendor_id)}</span> },
    { label: "Bill #", key: "bill_number" },
    { label: "Workstream", render: r => r.workstream_id ? wsName(r.workstream_id) : "—" },
    { label: "Date", key: "bill_date" },
    { label: "Due", key: "due_date" },
    { label: "Amount", align: "right", mono: true, render: r => fmt(r.amount) },
    { label: "Status", render: r => <Badge status={r.due_date && r.due_date < today() && r.status !== "paid" ? "overdue" : r.status} /> },
    { label: "", render: r => r.status !== "paid" && <Btn variant="secondary" onClick={e => { e.stopPropagation(); openPay(r); }} style={{ padding: "4px 10px", fontSize: 11 }}>Pay</Btn> },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.textMuted }}>{bills.length} bill(s)</div>
        <Btn onClick={openNew} disabled={!vendors.length}>+ New Bill</Btn>
      </div>
      {!vendors.length && <Card><div style={{ color: C.textDim, textAlign: "center", padding: 20 }}>Add vendors first before entering bills.</div></Card>}
      <Card style={{ padding: 0, overflow: "hidden" }}><Table columns={columns} data={bills} onRowClick={openEdit} /></Card>
      {modal && (
        <Modal title={modal === "new" ? "New Vendor Bill" : "Edit Bill"} onClose={() => setModal(null)} width={580}>
          <FormRow><Select label="Vendor" value={form.vendor_id||""} onChange={e => setForm({...form, vendor_id: e.target.value})} options={[{value:"",label:"Select..."}, ...vendors.map(v => ({value:v.id,label:v.display_name}))]} /><Select label="Workstream" value={form.workstream_id||""} onChange={e => setForm({...form, workstream_id: e.target.value})} options={[{value:"",label:"None"}, ...workstreams.map(w => ({value:w.id,label:w.name}))]} /></FormRow>
          <FormRow><Input label="Bill Number" value={form.bill_number||""} onChange={e => setForm({...form, bill_number: e.target.value})} /><Input label="Amount" type="number" value={form.amount||""} onChange={e => setForm({...form, amount: e.target.value})} /></FormRow>
          <FormRow><Input label="Bill Date" type="date" value={form.bill_date||""} onChange={e => setForm({...form, bill_date: e.target.value})} /><Input label="Due Date" type="date" value={form.due_date||""} onChange={e => setForm({...form, due_date: e.target.value})} /></FormRow>
          <FormRow><Input label="Service Start" type="date" value={form.service_period_start||""} onChange={e => setForm({...form, service_period_start: e.target.value})} /><Input label="Service End" type="date" value={form.service_period_end||""} onChange={e => setForm({...form, service_period_end: e.target.value})} /></FormRow>
          <FormRow><Select label="Status" value={form.status||"received"} onChange={e => setForm({...form, status: e.target.value})} options={[{value:"draft",label:"Draft"},{value:"received",label:"Received"},{value:"approved",label:"Approved"},{value:"partially_paid",label:"Partially Paid"},{value:"paid",label:"Paid"}]} /></FormRow>
          <FormRow><Input label="Category" value={form.expense_category||""} onChange={e => setForm({...form, expense_category: e.target.value})} /><Input label="Notes" value={form.notes||""} onChange={e => setForm({...form, notes: e.target.value})} /></FormRow>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            {modal === "edit" && <Btn variant="danger" onClick={remove}>Delete</Btn>}
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.vendor_id || !form.amount}>Save</Btn>
          </div>
        </Modal>
      )}
      {payModal && (
        <Modal title="Record Vendor Payment" onClose={() => setPayModal(null)} width={400}>
          <FormRow><Input label="Payment Date" type="date" value={payForm.payment_date||""} onChange={e => setPayForm({...payForm, payment_date: e.target.value})} /></FormRow>
          <FormRow><Input label="Amount" type="number" value={payForm.amount||""} onChange={e => setPayForm({...payForm, amount: e.target.value})} /></FormRow>
          <FormRow><Select label="Method" value={payForm.payment_method||"check"} onChange={e => setPayForm({...payForm, payment_method: e.target.value})} options={[{value:"check",label:"Check"},{value:"ach",label:"ACH"},{value:"wire",label:"Wire"},{value:"other",label:"Other"}]} /></FormRow>
          <FormRow><Input label="Reference" value={payForm.reference||""} onChange={e => setPayForm({...payForm, reference: e.target.value})} /></FormRow>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => setPayModal(null)}>Cancel</Btn>
            <Btn onClick={savePay} disabled={!payForm.amount}>Save Payment</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Direct Costs ───
function DirectCosts({ contractId }) {
  const [costs, setCosts] = useState([]);
  const [workstreams, setWorkstreams] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const load = useCallback(async () => {
    const [c, w] = await Promise.all([api.listDirectCosts(contractId), api.listWorkstreams(contractId)]);
    setCosts(c); setWorkstreams(w);
  }, [contractId]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ contract_id: contractId, workstream_id: "", vendor_id: null, cost_date: today(), amount: "", category: "", status: "incurred", notes: "" }); setModal("new"); };
  const openEdit = (r) => { setForm({ ...r }); setModal("edit"); };
  const save = async () => {
    const f = { ...form, amount: Number(form.amount) || 0, workstream_id: form.workstream_id || null };
    if (modal === "new") await api.createDirectCost(f);
    else await api.updateDirectCost(f.id, f);
    setModal(null); load();
  };
  const remove = async () => { await api.deleteDirectCost(form.id); setModal(null); load(); };

  const wsName = (wsid) => workstreams.find(w => w.id === wsid)?.name || "—";
  const columns = [
    { label: "Date", key: "cost_date" },
    { label: "Category", render: r => r.category || "—" },
    { label: "Workstream", render: r => r.workstream_id ? wsName(r.workstream_id) : "—" },
    { label: "Amount", align: "right", mono: true, render: r => fmt(r.amount) },
    { label: "Status", render: r => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.textMuted }}>{costs.length} cost(s) — {fmt(sum(costs, "amount"))} total</div>
        <Btn onClick={openNew}>+ Add Cost</Btn>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}><Table columns={columns} data={costs} onRowClick={openEdit} /></Card>
      {modal && (
        <Modal title={modal === "new" ? "Add Direct Cost" : "Edit Cost"} onClose={() => setModal(null)}>
          <FormRow><Input label="Date" type="date" value={form.cost_date||""} onChange={e => setForm({...form, cost_date: e.target.value})} /><Input label="Amount" type="number" value={form.amount||""} onChange={e => setForm({...form, amount: e.target.value})} /></FormRow>
          <FormRow><Input label="Category" value={form.category||""} onChange={e => setForm({...form, category: e.target.value})} /><Select label="Workstream" value={form.workstream_id||""} onChange={e => setForm({...form, workstream_id: e.target.value})} options={[{value:"",label:"None"}, ...workstreams.map(w => ({value:w.id,label:w.name}))]} /></FormRow>
          <FormRow><Select label="Status" value={form.status||"incurred"} onChange={e => setForm({...form, status: e.target.value})} options={[{value:"planned",label:"Planned"},{value:"incurred",label:"Incurred"},{value:"paid",label:"Paid"}]} /></FormRow>
          <FormRow><Input label="Notes" value={form.notes||""} onChange={e => setForm({...form, notes: e.target.value})} /></FormRow>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            {modal === "edit" && <Btn variant="danger" onClick={remove}>Delete</Btn>}
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.amount}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Forecast ───
function Forecast({ contractId }) {
  const [entries, setEntries] = useState([]);
  const [fva, setFva] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [workstreams, setWorkstreams] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const load = useCallback(async () => {
    const [f, v, w, fvaData] = await Promise.all([
      api.listForecast(contractId), api.listVendors(), api.listWorkstreams(contractId), api.reportForecastVsActual(),
    ]);
    setEntries(f); setVendors(v); setWorkstreams(w); setFva(fvaData);
  }, [contractId]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ contract_id: contractId, month: new Date().toISOString().slice(0, 7), workstream_id: "", vendor_id: "", forecast_type: "subcontractor_cost", amount: "", confidence_level: "", notes: "" }); setModal("new"); };
  const openEdit = (r) => { setForm({ ...r }); setModal("edit"); };
  const save = async () => {
    const f = { ...form, amount: Number(form.amount) || 0, workstream_id: form.workstream_id || null, vendor_id: form.vendor_id || null };
    if (modal === "new") await api.createForecast(f);
    else await api.updateForecast(f.id, f);
    setModal(null); load();
  };
  const remove = async () => { await api.deleteForecast(form.id); setModal(null); load(); };

  const vName = (vid) => vendors.find(v => v.id === vid)?.display_name || "";

  const columns = [
    { label: "Month", render: r => monthLabel(r.month) },
    { label: "Type", render: r => <Badge status={r.forecast_type} /> },
    { label: "Vendor", render: r => r.vendor_id ? vName(r.vendor_id) : "—" },
    { label: "Amount", align: "right", mono: true, render: r => fmt(r.amount) },
    { label: "Confidence", render: r => r.confidence_level || "—" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.textMuted }}>{entries.length} forecast entries</div>
        <Btn onClick={openNew}>+ Add Forecast</Btn>
      </div>
      {fva.length > 0 && (
        <Card style={{ marginBottom: 16, overflowX: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>FORECAST vs ACTUAL</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: MONO }}>
            <thead><tr>{["Month","Fcst Rev","Fcst Cost","Fcst Net","Act Rev","Act Cost","Act Net"].map(h => <th key={h} style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
            <tbody>{fva.map(r => (
              <tr key={r.month}>
                <td style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}20` }}>{monthLabel(r.month)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.green }}>{fmt(r.forecast_revenue)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.red }}>{fmt(r.forecast_cost)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, fontWeight: 700, color: r.forecast_net >= 0 ? C.green : C.red }}>{fmt(r.forecast_net)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.green }}>{fmt(r.actual_revenue)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.red }}>{fmt(r.actual_cost)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, fontWeight: 700, color: r.actual_net >= 0 ? C.green : C.red }}>{fmt(r.actual_net)}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
      <Card style={{ padding: 0, overflow: "hidden" }}><Table columns={columns} data={entries} onRowClick={openEdit} /></Card>
      {modal && (
        <Modal title={modal === "new" ? "Add Forecast Entry" : "Edit Forecast"} onClose={() => setModal(null)}>
          <FormRow><Input label="Month" type="month" value={form.month||""} onChange={e => setForm({...form, month: e.target.value})} /><Select label="Type" value={form.forecast_type||"subcontractor_cost"} onChange={e => setForm({...form, forecast_type: e.target.value})} options={[{value:"revenue",label:"Revenue"},{value:"subcontractor_cost",label:"Subcontractor Cost"},{value:"direct_cost",label:"Direct Cost"},{value:"overhead",label:"Overhead"}]} /></FormRow>
          <FormRow><Input label="Amount" type="number" value={form.amount||""} onChange={e => setForm({...form, amount: e.target.value})} /><Select label="Vendor (optional)" value={form.vendor_id||""} onChange={e => setForm({...form, vendor_id: e.target.value})} options={[{value:"",label:"None"}, ...vendors.map(v => ({value:v.id,label:v.display_name}))]} /></FormRow>
          <FormRow><Select label="Workstream" value={form.workstream_id||""} onChange={e => setForm({...form, workstream_id: e.target.value})} options={[{value:"",label:"None"}, ...workstreams.map(w => ({value:w.id,label:w.name}))]} /><Input label="Confidence" value={form.confidence_level||""} onChange={e => setForm({...form, confidence_level: e.target.value})} placeholder="high, medium, low" /></FormRow>
          <FormRow><Input label="Notes" value={form.notes||""} onChange={e => setForm({...form, notes: e.target.value})} /></FormRow>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            {modal === "edit" && <Btn variant="danger" onClick={remove}>Delete</Btn>}
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.amount || !form.month}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Reports ───
function Reports() {
  const [tab, setTab] = useState("pl");
  const [plData, setPlData] = useState([]);
  const [cfData, setCfData] = useState([]);
  const [vsData, setVsData] = useState([]);
  const [bvData, setBvData] = useState(null);

  useEffect(() => {
    api.reportPL().then(setPlData);
    api.reportCashFlow().then(setCfData);
    api.reportVendorSummary().then(setVsData);
    api.reportBilledVsCollected().then(setBvData);
  }, []);

  const tabs = [{ id: "pl", label: "P&L by Month" }, { id: "cash", label: "Cash Flow" }, { id: "vendor", label: "Vendor Summary" }, { id: "billed", label: "Billed vs Collected" }];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map(t => <Btn key={t.id} variant={tab === t.id ? "primary" : "secondary"} onClick={() => setTab(t.id)} style={{ fontSize: 12 }}>{t.label}</Btn>)}
      </div>
      {tab === "pl" && (
        <Card style={{ overflowX: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>PROFIT & LOSS BY MONTH</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: MONO }}>
            <thead><tr>{["Month","Revenue","Sub Costs","Direct Costs","Total Costs","Net"].map(h => <th key={h} style={{ padding: "8px 10px", textAlign: "right", borderBottom: `2px solid ${C.border}`, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
            <tbody>
              {plData.map(r => (<tr key={r.month}><td style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}20` }}>{monthLabel(r.month)}</td><td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.green }}>{fmt(r.revenue)}</td><td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20` }}>{fmt(r.sub_costs)}</td><td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20` }}>{fmt(r.direct_costs)}</td><td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20` }}>{fmt(r.total_costs)}</td><td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, fontWeight: 700, color: r.net >= 0 ? C.green : C.red }}>{fmt(r.net)}</td></tr>))}
              {plData.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: C.textDim }}>No data yet</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
      {tab === "cash" && (
        <Card style={{ overflowX: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>CASH FLOW BY MONTH</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: MONO }}>
            <thead><tr>{["Month","Inflows","Outflows","Net"].map(h => <th key={h} style={{ padding: "8px 10px", textAlign: "right", borderBottom: `2px solid ${C.border}`, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
            <tbody>{cfData.map(r => (<tr key={r.month}><td style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}20` }}>{monthLabel(r.month)}</td><td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.green }}>{fmt(r.inflows)}</td><td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.red }}>{fmt(r.outflows)}</td><td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, fontWeight: 700, color: r.net >= 0 ? C.green : C.red }}>{fmt(r.net)}</td></tr>))}</tbody>
          </table>
        </Card>
      )}
      {tab === "vendor" && (
        <Card style={{ overflowX: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>VENDOR UNPAID SUMMARY</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: MONO }}>
            <thead><tr>{["Vendor","Billed","Paid","Unpaid"].map(h => <th key={h} style={{ padding: "8px 10px", textAlign: "right", borderBottom: `2px solid ${C.border}`, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
            <tbody>{vsData.map(v => (<tr key={v.vendor_id}><td style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}20`, fontFamily: FONT, fontWeight: 600 }}>{v.display_name}</td><td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20` }}>{fmt(v.billed)}</td><td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, color: C.green }}>{fmt(v.paid)}</td><td style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.border}20`, fontWeight: 700, color: v.unpaid > 0 ? C.amber : C.green }}>{fmt(v.unpaid)}</td></tr>))}{vsData.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: C.textDim }}>No vendor bills entered yet</td></tr>}</tbody>
          </table>
        </Card>
      )}
      {tab === "billed" && bvData && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: C.textMuted }}>BILLED vs COLLECTED</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Total Billed</div><div style={{ fontSize: 28, fontWeight: 700, fontFamily: MONO, color: C.accent }}>{fmt(bvData.billed)}</div></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Total Collected</div><div style={{ fontSize: 28, fontWeight: 700, fontFamily: MONO, color: C.green }}>{fmt(bvData.collected)}</div></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Outstanding</div><div style={{ fontSize: 28, fontWeight: 700, fontFamily: MONO, color: C.amber }}>{fmt(bvData.outstanding)}</div></div>
          </div>
          {bvData.billed > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted, marginBottom: 4 }}><span>Collection Rate</span><span>{bvData.collection_rate.toFixed(1)}%</span></div>
              <div style={{ height: 10, borderRadius: 99, background: C.surface2, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(bvData.collection_rate, 100)}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.green})`, borderRadius: 99 }} /></div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Settings ───
function ContractSettings({ contractId, onUpdate }) {
  const [contract, setContract] = useState(null);
  const [bank, setBank] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getContract(contractId).then(setContract);
    api.listBankAccounts().then(accts => setBank(accts[0] || null));
  }, [contractId]);

  const save = async () => {
    await api.updateContract(contractId, { ...contract, total_value: Number(contract.total_value) || 0 });
    if (bank) await api.updateBankAccount(bank.id, { ...bank, opening_balance: Number(bank.opening_balance) || 0 });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    onUpdate?.();
  };

  if (!contract) return <div style={{ color: C.textDim }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 600 }}>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Contract Details</div>
        <FormRow><Input label="Contract Name" value={contract.name||""} onChange={e => setContract({...contract, name: e.target.value})} /></FormRow>
        <FormRow><Input label="Client Name" value={contract.client_name||""} onChange={e => setContract({...contract, client_name: e.target.value})} /></FormRow>
        <FormRow><Input label="Start Date" type="date" value={contract.contract_start||""} onChange={e => setContract({...contract, contract_start: e.target.value})} /><Input label="End Date" type="date" value={contract.contract_end||""} onChange={e => setContract({...contract, contract_end: e.target.value})} /></FormRow>
        <FormRow><Input label="Total Value" type="number" value={contract.total_value||""} onChange={e => setContract({...contract, total_value: e.target.value})} /></FormRow>
      </Card>
      {bank && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Bank Account</div>
          <FormRow><Input label="Account Name" value={bank.name||""} onChange={e => setBank({...bank, name: e.target.value})} /></FormRow>
          <FormRow><Input label="Opening Balance" type="number" value={bank.opening_balance||""} onChange={e => setBank({...bank, opening_balance: e.target.value})} /></FormRow>
        </Card>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Btn onClick={save}>Save Settings</Btn>
        {saved && <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>✓ Saved</span>}
      </div>
    </div>
  );
}


// ─── MAIN APP ───
const NAV = [
  { id: "dashboard",    label: "Dashboard",         icon: "◉" },
  { id: "weekly",       label: "Weekly Costs",       icon: "◫" },
  { id: "invoices",     label: "Client Invoices",    icon: "◈" },
  { id: "allocations",  label: "Task Allocations",   icon: "◪" },
  { id: "profit",       label: "Owner Profit",       icon: "◬" },
  { id: "vendors",      label: "Vendors",            icon: "◇" },
  { id: "bills",        label: "Vendor Bills",       icon: "◆" },
  { id: "costs",        label: "Direct Costs",       icon: "○" },
  { id: "forecast",     label: "Forecast",           icon: "◎" },
  { id: "reports",      label: "Reports",            icon: "▤" },
  { id: "settings",     label: "Settings",           icon: "⚙" },
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [contractId, setContractId] = useState(null);
  const [contractName, setContractName] = useState("Contract Manager");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  const loadContract = useCallback(async () => {
    try {
      const contracts = await api.listContracts();
      if (contracts.length > 0) {
        setContractId(contracts[0].id);
        setContractName(contracts[0].name);
      }
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContract(); }, [loadContract]);

  if (loading) return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.text, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 8 }}>◉</div><div style={{ color: C.textMuted }}>Connecting to server...</div></div>
    </div>
  );

  if (error) return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.text, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <Card style={{ maxWidth: 500, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Cannot connect to backend</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>{error}</div>
        <div style={{ fontSize: 12, color: C.textDim }}>Make sure the API server is running at {import.meta.env.VITE_API_URL || "http://localhost:8000"}</div>
      </Card>
    </div>
  );

  const renderPage = () => {
    switch (page) {
      case "dashboard":   return <Dashboard contractId={contractId} />;
      case "weekly":      return <WeeklyCosts contractId={contractId} />;
      case "invoices":    return <ClientInvoices contractId={contractId} />;
      case "allocations": return <TaskAllocations contractId={contractId} />;
      case "profit":      return <OwnerProfit contractId={contractId} />;
      case "vendors":     return <Vendors />;
      case "bills":       return <VendorBills contractId={contractId} />;
      case "costs":       return <DirectCosts contractId={contractId} />;
      case "forecast":    return <Forecast contractId={contractId} />;
      case "reports":     return <Reports />;
      case "settings":    return <ContractSettings contractId={contractId} onUpdate={loadContract} />;
      default:            return <Dashboard contractId={contractId} />;
    }
  };

  return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.text, minHeight: "100vh", display: "flex" }}>
      <style>{`
        @media (max-width: 768px) { .desktop-nav { display: none !important; } .mobile-header { display: flex !important; } .main-content { margin-left: 0 !important; } }
        @media (min-width: 769px) { .mobile-header { display: none !important; } }
      `}</style>

      <nav className="desktop-nav" style={{ width: 220, minHeight: "100vh", background: C.surface, borderRight: `1px solid ${C.border}`, padding: "20px 12px", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, zIndex: 100 }}>
        <div style={{ padding: "4px 10px", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.5 }}>◉ Contract Mgr</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{contractName}</div>
        </div>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "none", background: page === n.id ? C.accentSoft : "transparent", color: page === n.id ? C.accent : C.textMuted, cursor: "pointer", fontSize: 13, fontWeight: page === n.id ? 600 : 400, fontFamily: FONT, textAlign: "left", width: "100%" }}>
            <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{n.icon}</span>{n.label}
          </button>
        ))}
      </nav>

      <div className="mobile-header" style={{ display: "none", position: "fixed", top: 0, left: 0, right: 0, height: 56, background: C.surface, borderBottom: `1px solid ${C.border}`, alignItems: "center", padding: "0 16px", zIndex: 200, justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>◉ Contract Mgr</div>
        <button onClick={() => setNavOpen(!navOpen)} style={{ background: "none", border: "none", color: C.text, fontSize: 22, cursor: "pointer" }}>☰</button>
      </div>

      {navOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300 }} onClick={() => setNavOpen(false)}>
          <div style={{ width: 240, background: C.surface, height: "100%", padding: "20px 12px" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, padding: "4px 10px", marginBottom: 16 }}>◉ Contract Mgr</div>
            {NAV.map(n => (
              <button key={n.id} onClick={() => { setPage(n.id); setNavOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", borderRadius: 8, border: "none", background: page === n.id ? C.accentSoft : "transparent", color: page === n.id ? C.accent : C.textMuted, cursor: "pointer", fontSize: 14, fontWeight: page === n.id ? 600 : 400, fontFamily: FONT, textAlign: "left", width: "100%" }}>
                <span>{n.icon}</span>{n.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="main-content" style={{ flex: 1, marginLeft: 220, padding: "28px 32px", maxWidth: 1100 }}>
        <div style={{ marginBottom: 24 }}><h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{NAV.find(n => n.id === page)?.label}</h1></div>
        {renderPage()}
      </main>
    </div>
  );
}
