import { useState, useEffect, useCallback } from "react";
import api from "./lib/api";

// ─── Helpers ───
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const fmtShort = (n) => { const a = Math.abs(n||0); if(a>=1e6) return `$${(n/1e6).toFixed(1)}M`; if(a>=1e3) return `$${(n/1e3).toFixed(1)}K`; return fmt(n); };
const today = () => new Date().toISOString().slice(0, 10);
const monthLabel = (m) => { const [y, mo] = m.split("-"); return new Date(y, mo - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }); };
const daysDiff = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
const sum = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);

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

// ─── Dashboard (reads from /api/dashboard) ───
function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.getDashboard().then(setD).catch(console.error); }, []);
  if (!d) return <div style={{ color: C.textDim, padding: 40, textAlign: "center" }}>Loading dashboard...</div>;

  const plData = (d.monthly_pl || []).map(r => ({ label: monthLabel(r.month), value: r.net }));
  const margin = d.margin_pct;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <StatCard label="Cash on Hand" value={fmt(d.cash_on_hand)} icon="💵" color={d.cash_on_hand >= 0 ? C.green : C.red} />
        <StatCard label="Billed to Date" value={fmt(d.total_billed)} sub={`of ${fmt(d.contract_value)}`} icon="📄" color={C.accent} />
        <StatCard label="Collected" value={fmt(d.total_collected)} sub={`AR: ${fmt(d.outstanding_ar)}`} icon="🏦" color={C.green} />
        <StatCard label="Total Costs" value={fmt(d.total_costs)} sub={`AP: ${fmt(d.unpaid_ap)}`} icon="📊" color={C.amber} />
        <StatCard label="Projected Margin" value={`${margin.toFixed(1)}%`} icon="📈" color={margin >= 20 ? C.green : margin >= 0 ? C.amber : C.red} />
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Card style={{ flex: "2 1 300px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.textMuted }}>MONTHLY NET INCOME</div>
          {plData.length > 0 ? <MiniBar data={plData} /> : <div style={{ color: C.textDim, padding: 30, textAlign: "center" }}>Enter invoices and bills to see chart</div>}
        </Card>
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

// ─── Vendors ───
function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const load = useCallback(async () => {
    const [v, b] = await Promise.all([api.listVendors(), api.listVendorBills()]);
    setVendors(v); setBills(b);
    // load all vendor payments for balance calc
    const allPays = [];
    for (const bill of b) {
      if (bill.status !== "paid") continue; // optimization: skip loading pays for paid bills individually
    }
    // Simpler: compute from bill statuses. For precise balance we track payments too.
    setPayments([]); // We'll compute balance from bills for now
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

  const columns = [
    { label: "Invoice #", render: r => <span style={{ fontWeight: 600 }}>{r.invoice_number || "—"}</span> },
    { label: "Date", key: "invoice_date" },
    { label: "Amount", align: "right", mono: true, render: r => fmt(r.amount) },
    { label: "Status", render: r => <Badge status={r.status} /> },
    { label: "", render: r => r.status !== "paid" && <Btn variant="secondary" onClick={e => { e.stopPropagation(); openPay(r); }} style={{ padding: "4px 10px", fontSize: 11 }}>Record Payment</Btn> },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.textMuted }}>{invoices.length} invoice(s) — {fmt(sum(invoices, "amount"))} total billed</div>
        <Btn onClick={openNew}>+ New Invoice</Btn>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}><Table columns={columns} data={invoices} onRowClick={openEdit} /></Card>
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
  { id: "dashboard", label: "Dashboard", icon: "◉" },
  { id: "invoices", label: "Client Invoices", icon: "◈" },
  { id: "vendors", label: "Vendors", icon: "◇" },
  { id: "bills", label: "Vendor Bills", icon: "◆" },
  { id: "costs", label: "Direct Costs", icon: "○" },
  { id: "forecast", label: "Forecast", icon: "◎" },
  { id: "reports", label: "Reports", icon: "▤" },
  { id: "settings", label: "Settings", icon: "⚙" },
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
      case "dashboard": return <Dashboard />;
      case "invoices": return <ClientInvoices contractId={contractId} />;
      case "vendors": return <Vendors />;
      case "bills": return <VendorBills contractId={contractId} />;
      case "costs": return <DirectCosts contractId={contractId} />;
      case "forecast": return <Forecast contractId={contractId} />;
      case "reports": return <Reports />;
      case "settings": return <ContractSettings contractId={contractId} onUpdate={loadContract} />;
      default: return <Dashboard />;
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
