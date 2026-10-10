"use client";
import {useState} from "react";
export default function HistoryDateFilter({range="30d",from="",to="",preserve={}}:{range?:string;from?:string;to?:string;preserve?:Record<string,string>}){
 const [selected,setSelected]=useState(range);
 return <form method="get" style={{display:"flex",alignItems:"center",gap:6,position:"relative"}}>
  {Object.entries(preserve).filter(([k,v])=>v&&!["range","from","to","page"].includes(k)).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}
  <select className="select" style={{width:165,maxWidth:165,fontSize:14,height:38}} aria-label="Date range" name="range" value={selected} onChange={e=>{setSelected(e.target.value);if(e.target.value!=="custom")e.target.form?.requestSubmit();}}>
   <option value="24h">Last 24 Hours</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="90d">Last 90 Days</option><option value="custom">Custom Range</option><option value="all">All Available History</option>
  </select>
  {selected==="custom"?<div className="customDateFields" style={{position:"absolute",top:"calc(100% + 12px)",right:0,display:"flex",gap:8,alignItems:"flex-end",whiteSpace:"nowrap",zIndex:3}}><label className="subtitle" style={{display:"flex",flexDirection:"column",gap:5}}>From<input className="input" style={{width:148,height:38,padding:"0 12px",fontSize:14,borderRadius:8,boxSizing:"border-box",fontFamily:"inherit",colorScheme:"dark"}} aria-label="From date" type="date" name="from" defaultValue={from}/></label><label className="subtitle" style={{display:"flex",flexDirection:"column",gap:5}}>To<input className="input" style={{width:148,height:38,padding:"0 12px",fontSize:14,borderRadius:8,boxSizing:"border-box",fontFamily:"inherit",colorScheme:"dark"}} aria-label="To date" type="date" name="to" defaultValue={to}/></label><button className="button" style={{fontSize:14,height:38,borderRadius:8,boxSizing:"border-box",fontFamily:"inherit"}} type="submit">Apply</button></div>:null}
 </form>;
}
