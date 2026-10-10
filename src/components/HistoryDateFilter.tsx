"use client";
import {useState} from "react";
export default function HistoryDateFilter({range="30d",from="",to="",preserve={}}:{range?:string;from?:string;to?:string;preserve?:Record<string,string>}){
 const [selected,setSelected]=useState(range);
 return <form method="get" style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
  {Object.entries(preserve).filter(([k,v])=>v&&!["range","from","to","page"].includes(k)).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}
  <select className="select" aria-label="Date range" name="range" value={selected} onChange={e=>{setSelected(e.target.value);if(e.target.value!=="custom")e.target.form?.requestSubmit();}}>
   <option value="24h">Last 24 Hours</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="90d">Last 90 Days</option><option value="custom">Custom Range</option><option value="all">All Available History</option>
  </select>
  {selected==="custom"?<><input className="input" aria-label="From date" type="date" name="from" defaultValue={from}/><input className="input" aria-label="To date" type="date" name="to" defaultValue={to}/><button className="button" type="submit">Apply</button></>:null}
 </form>;
}
