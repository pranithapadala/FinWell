import { useEffect, useMemo, useRef, useState } from "react";
import api from "./api";
import Chart from "chart.js/auto";

/* ---------- Palettes ---------- */
const GREYS = ["#CCCCCC", "#AAAAAA", "#888888", "#666666", "#555555", "#444444"];
const REDS  = ["#FFCCCC", "#FF9999", "#FF6666", "#FF3333", "#DC143C", "#A01020"];
const RED   = "#e60023";
const MUTED = "#aaaaaa";

/* categories tinted red in pie */
const RED_CATEGORIES = new Set(["Food", "Shopping", "Travel", "Bills"]);

/* ---------- Utils ---------- */
function ymd(date) { return date.toISOString().slice(0,10); }
function ym(date)  { return date.toISOString().slice(0,7); }
function addMonths(date, delta){
  const d = new Date(date);
  d.setMonth(d.getMonth()+delta);
  return d;
}
function monthLabel(y_m){
  const [y,m] = y_m.split("-").map(Number);
  return new Date(y, m-1, 1).toLocaleDateString(undefined, { month:"short", year:"numeric" });
}

/* ---------- Local storage for goals ---------- */
const GOALS_KEY = "finwell_goals_v1";
function loadGoals(){ try { return JSON.parse(localStorage.getItem(GOALS_KEY)) || []; } catch { return []; } }
function saveGoals(goals){ try { localStorage.setItem(GOALS_KEY, JSON.stringify(goals)); } catch {} }

export default function Dashboard(){
  const [month, setMonth] = useState(ym(new Date()));
  const [tx, setTx] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    category:"Food", note:"", amount:"", date: ymd(new Date()), type:"EXPENSE"
  });

  // charts
  const pieRef  = useRef(null);
  const lineRef = useRef(null);

  /* ---------- Fetch current month ---------- */
  async function loadMonth(m) {
    const { data } = await api.get("/api/transactions", { params:{ month:m }});
    return data;
  }
  async function load(){
    try{
      const data = await loadMonth(month);
      setTx(data); setError("");
    }catch(e){
      console.error(e); setError(e?.message || "Failed to fetch");
    }
  }
  useEffect(() => { load(); }, [month]);

  /* ---------- Derived KPIs ---------- */
  const summary = useMemo(() => {
    let income=0, expense=0;
    for(const t of tx){
      const amt = Number(t.amount)||0;
      if(t.type==="INCOME") income += amt; else expense += amt;
    }
    const balance = income - expense;
    const days = new Set(tx.map(t=>t.date)).size || 1;
    const avgDailySpend = expense / days;

    const byCat = {};
    tx.filter(t=>t.type==="EXPENSE").forEach(t=>{
      const k = t.category || "Other";
      byCat[k] = (byCat[k]||0) + Number(t.amount||0);
    });
    const topCat = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0] || ["—",0];

    return { income, expense, balance, avgDailySpend, topCatLabel: topCat[0], topCatValue: topCat[1] };
  }, [tx]);

  /* ---------- CRUD ---------- */
  async function add(e){
    e.preventDefault();
    try{
      const amt = Number(form.amount);
      if(!amt || amt<=0) return;
      await api.post("/api/transactions", { ...form, amount: amt });
      setForm(f=>({ ...f, note:"", amount:"" }));
      load();
    }catch(e){ setError(e?.message || "Create failed"); }
  }
  async function remove(id){
    if(!confirm("Delete this transaction?")) return;
    try{ await api.delete(`/api/transactions/${id}`); load(); }
    catch(e){ setError(e?.message || "Delete failed"); }
  }

  /* ---------- Pie data ---------- */
  const pieData = useMemo(()=>{
    const map = {};
    tx.filter(t=>t.type==="EXPENSE").forEach(t=>{
      const k = t.category || "Other";
      map[k] = (map[k]||0) + Number(t.amount||0);
    });
    const labels = Object.keys(map);
    let gi=0, ri=0;
    const bg = labels.map(l => RED_CATEGORIES.has(l) ? REDS[ri++ % REDS.length] : GREYS[gi++ % GREYS.length]);
    const values = labels.map(l => map[l]);
    return { labels, values, bg };
  }, [tx]);

  useEffect(()=>{
    const c = pieRef.current; if(!c) return;
    if(c._chart){ try{c._chart.destroy();}catch{} c._chart=null; }
    if(!pieData.labels.length) return;
    c._chart = new Chart(c.getContext("2d"), {
      type:"pie",
      data:{ labels: pieData.labels, datasets:[{ data: pieData.values, backgroundColor: pieData.bg, borderWidth:0 }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:"bottom", labels:{ color:"#ffffff" } } }
      }
    });
  }, [pieData]);

  /* ---------- Trends (last 6 months) ---------- */
  const [trend, setTrend] = useState({ labels:[], income:[], expense:[] });
  useEffect(()=>{
    (async ()=>{
      try{
        const months = [];
        for(let i=5;i>=0;i--) months.push( ym(addMonths(new Date(`${month}-01`), -i)) );
        const results = await Promise.all(months.map(m => loadMonth(m).catch(()=>[])));
        const income = results.map(arr => arr.filter(t=>t.type==="INCOME").reduce((s,t)=>s+Number(t.amount||0),0));
        const expense = results.map(arr => arr.filter(t=>t.type==="EXPENSE").reduce((s,t)=>s+Number(t.amount||0),0));
        setTrend({ labels: months.map(monthLabel), income, expense });
      }catch(e){ console.error(e); }
    })();
  }, [month]);

  useEffect(()=>{
    const c = lineRef.current; if(!c) return;
    if(c._chart){ try{c._chart.destroy();}catch{} c._chart=null; }
    if(!trend.labels.length) return;
    c._chart = new Chart(c.getContext("2d"), {
      type:"line",
      data:{
        labels: trend.labels,
        datasets:[
          { label:"Income",  data: trend.income,  borderColor:"#cccccc", backgroundColor:"rgba(204,204,204,.2)", tension:.3 },
          { label:"Expense", data: trend.expense, borderColor:RED,        backgroundColor:"rgba(230,0,35,.15)",   tension:.3 }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{ color:"#ffffff" } } },
        scales:{ x:{ ticks:{ color:MUTED }, grid:{ color:"#222" } }, y:{ ticks:{ color:MUTED }, grid:{ color:"#222" } } }
      }
    });
  }, [trend]);

  /* ---------- Savings Goals (no leading zeros) ---------- */
  const [goals, setGoals]   = useState(loadGoals());
  const [gForm, setGForm]   = useState({ name:"Emergency Fund", target:"1000", saved:"" }); // saved starts blank
  const [editSaved, setEditSaved] = useState({}); // per-goal display strings

  useEffect(() => {
    const next = {};
    for (const g of goals) next[g.id] = (g.id in editSaved) ? editSaved[g.id] : String(g.saved ?? "");
    setEditSaved(next);
    saveGoals(goals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals]);

  function addGoal(e){
    e.preventDefault();
    const t = Number(gForm.target);
    const s = gForm.saved === "" ? 0 : Number(gForm.saved);
    if (!gForm.name || !Number.isFinite(t) || t <= 0) return;

    const goal = { id: crypto.randomUUID(), name: gForm.name, target: t, saved: Number.isFinite(s) ? s : 0 };
    const next = [...goals, goal];
    setGoals(next);
    setGForm({ name:"", target:"", saved:"" });
  }
  function removeGoal(id){
    setGoals(goals.filter(g => g.id !== id));
    const { [id]: _, ...rest } = editSaved;
    setEditSaved(rest);
  }
  function updateSavedField(id, raw){
    if (raw === "") { // allow blank while typing
      setEditSaved(prev => ({ ...prev, [id]: "" }));
      return;
    }
    const cleaned = raw.replace(/^0+(?=\d)/, ""); // strip leading zeros
    setEditSaved(prev => ({ ...prev, [id]: cleaned }));
    const num = Number(cleaned);
    if (Number.isFinite(num)) {
      setGoals(prev => prev.map(g => g.id === id ? { ...g, saved: num } : g));
    }
  }

  return (
    <div>
      {/* Hero */}
      <header className="hero">
        <div className="container heroInner">
          <h1 className="brand">FinWell</h1>
          <div className="monthPicker">
            <div className="monthLabel">Select Month</div>
            <input
              className="input"
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
            />
          </div>
          {error && <div className="alert">{error}</div>}
        </div>
      </header>

      {/* Form+Table | Pie */}
      <section className="section">
        <div className="container">
          <div className="grid two">
            <div className="card">
              <div className="label" style={{marginBottom:8}}>Add transaction</div>
              <form onSubmit={add} className="toolbar" style={{marginTop:0}}>
                <select className="select" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
                  <option>Food</option><option>Rent</option><option>Travel</option>
                  <option>Shopping</option><option>Bills</option><option>Health</option><option>Other</option>
                </select>
                <input className="input" placeholder="Note" value={form.note} onChange={e=>setForm({...form, note:e.target.value})}/>
                <input className="input" type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})}/>
                <input className="input" type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>
                <select className="select" value={form.type} onChange={e=>setForm({...form, type:e.target.value})}>
                  <option>EXPENSE</option><option>INCOME</option>
                </select>
                <button className="button" type="submit">Add</button>
              </form>

              <div className="label" style={{margin:"6px 0 8px"}}>Transactions</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th><th>Category</th><th>Type</th>
                    <th className="amount">Amount</th><th>Note</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tx.map(t=>(
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td>{t.category}</td>
                      <td>{t.type}</td>
                      <td className="amount">${Number(t.amount).toFixed(2)}</td>
                      <td>{t.note||""}</td>
                      <td><button className="button danger" type="button" onClick={()=>remove(t.id)}>🗑️ Delete</button></td>
                    </tr>
                  ))}
                  {tx.length===0 && (
                    <tr><td colSpan="6" style={{textAlign:"center", color:MUTED}}>No transactions yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="label" style={{marginBottom:8}}>Spending by Category</div>
              <div className="pieWrap big"><canvas ref={pieRef}/></div>
              {!pieData.labels.length && <div style={{color:MUTED,marginTop:8}}>No expense data yet</div>}
            </div>
          </div>
        </div>
      </section>

      {/* Monthly Summary */}
      <section className="section alt">
        <div className="container">
          <h2 className="sectionTitle">Monthly Summary</h2>
          <div className="kpiGrid">
            <div className="kpi">
              <div className="k">Income</div>
              <div className="v">${summary.income.toFixed(2)}</div>
            </div>
            <div className="kpi">
              <div className="k">Expense</div>
              <div className="v red">${summary.expense.toFixed(2)}</div>
            </div>
            <div className="kpi">
              <div className="k">Balance</div>
              <div className="v" style={{color: summary.balance>=0 ? "#ffffff" : RED}}>${summary.balance.toFixed(2)}</div>
            </div>
            <div className="kpi">
              <div className="k">Avg Daily Spend</div>
              <div className="v">${summary.avgDailySpend.toFixed(2)}</div>
            </div>
            <div className="kpi span2">
              <div className="k">Top Category</div>
              <div className="v">{summary.topCatLabel} &nbsp; <span className="sub">${summary.topCatValue.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Trends */}
      <section className="section">
        <div className="container">
          <h2 className="sectionTitle">Income vs Expense Trends (Last 6 Months)</h2>
          <div className="lineWrap"><canvas ref={lineRef}/></div>
        </div>
      </section>

      {/* Savings Goals (updated) */}
      <section className="section alt">
        <div className="container">
          <h2 className="sectionTitle">Savings Goals</h2>

          <form className="toolbar" onSubmit={addGoal}>
            <input
              className="input"
              placeholder="Goal name"
              value={gForm.name}
              onChange={e=>setGForm({...gForm, name:e.target.value})}
            />
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Target $"
              value={gForm.target}
              onChange={e=>setGForm({...gForm, target:e.target.value})}
            />
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Saved $"
              value={gForm.saved}
              onChange={e=> {
                const v = e.target.value;
                if (v === "") setGForm({...gForm, saved: ""});
                else setGForm({...gForm, saved: v.replace(/^0+(?=\d)/, "")});
              }}
            />
            <button className="button" type="submit">Add Goal</button>
          </form>

          <div className="goals">
            {goals.map(g=>{
              const savedStr = editSaved[g.id] ?? String(g.saved ?? "");
              const pct = Math.max(0, Math.min(100, (Number(g.saved||0) / Number(g.target||1)) * 100 || 0));
              return (
                <div className="goal card" key={g.id}>
                  <div className="goalHead">
                    <div className="goalName">{g.name}</div>
                    <button className="button danger" onClick={()=>removeGoal(g.id)}>🗑️ Remove</button>
                  </div>
                  <div className="goalMeta">
                    <span className="muted">Target</span> ${Number(g.target||0).toFixed(2)}
                    <span className="dot"/> 
                    <span className="muted">Saved</span> ${Number(g.saved||0).toFixed(2)}
                  </div>
                  <div className="progress"><div className="bar" style={{ width:`${pct}%` }}/></div>
                  <div className="goalControls">
                    <span className="muted">Update saved:</span>
                    <input
                      className="input"
                      type="number"
                      step="1"
                      value={savedStr}
                      onChange={e => updateSavedField(g.id, e.target.value)}
                      style={{width:160, textAlign:"right"}}
                    />
                    <span className="muted" style={{marginLeft:8}}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
            {goals.length===0 && <div className="muted">No goals yet — add your first goal above.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
