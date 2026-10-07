"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import PageLoading from "@/components/PageLoading";

type RawRow = Record<string, string>;
type IpIntel = {
  ip:string; city:string; region:string; country:string; countryCode:string; asn:string; provider:string; domain:string; networkType:string;
  vpn:boolean|null; proxy:boolean|null; tor:boolean|null; relay:boolean|null; hosting:boolean|null; anonymous:boolean|null;
  privacyService:string; privacyAvailable:boolean; source:"lookup"|"lite"; error?:string;
};
type ImportedSignIn = {
  id:string; time:string; user:string; displayName:string; ip:string; city:string; state:string; country:string; application:string;
  status:string; failureReason:string; microsoftRisk:string; importedVpn:string; failed:boolean; errorCode:string;
};
type AnalyzedSignIn = ImportedSignIn & { intel?:IpIntel; score:number; level:"normal"|"review"|"suspicious"|"critical"; reasons:string[] };
type Tenant = { id:string; tenant_id:string; tenant_name:string|null; automatic_monitoring_available:boolean|null };

function parseCsv(text:string):RawRow[]{
  const rows:string[][]=[]; let row:string[]=[]; let field=""; let quoted=false;
  for(let i=0;i<text.length;i++){ const ch=text[i];
    if(ch==='"'){ if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted; }
    else if(ch===","&&!quoted){row.push(field);field="";}
    else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(field);field="";if(row.some(x=>x.trim()!==""))rows.push(row);row=[];}
    else field+=ch;
  }
  row.push(field); if(row.some(x=>x.trim()!==""))rows.push(row); if(rows.length<2)return[];
  const headers=rows[0].map(h=>h.trim().replace(/^\uFEFF/,""));
  return rows.slice(1).map(values=>{const out:RawRow={};headers.forEach((h,i)=>out[h]=(values[i]??"").trim());return out;});
}
function nk(s:string){return s.toLowerCase().replace(/[^a-z0-9]/g,"")}
function gv(row:RawRow, aliases:string[]){const m=new Map(Object.entries(row).map(([k,v])=>[nk(k),v]));for(const a of aliases){const v=m.get(nk(a));if(v!==undefined&&v!=="")return v;}return "";}
function riskFromText(v:string){v=v.toLowerCase();if(v.includes("high"))return"high";if(v.includes("medium"))return"medium";if(v.includes("low"))return"low";return"none";}
function looksFailed(status:string,errorCode:string,failureReason:string){if(errorCode&&errorCode!=="0")return true;const t=`${status} ${failureReason}`.toLowerCase();return /(fail|denied|blocked|error|interrupt)/.test(t)&&!t.includes("success");}
function buildRecords(rows:RawRow[]):ImportedSignIn[]{return rows.map((row,index)=>{
  const user=gv(row,["User principal name","UserPrincipalName","UPN","User","Username"]), displayName=gv(row,["User display name","UserDisplayName","Display name"]), ip=gv(row,["IP address","IPAddress","IP"]);
  let city=gv(row,["City"]), state=gv(row,["State","Region"]), country=gv(row,["Country","Country/Region","CountryOrRegion"]); const locationText=gv(row,["Location"]);
  if(!city&&!state&&!country&&locationText){const p=locationText.split(",").map(x=>x.trim());city=p[0]||"";state=p[1]||"";country=p[2]||"";}
  const application=gv(row,["Application","Application name","AppDisplayName","Resource"]), status=gv(row,["Status","Sign-in status","Result"]), failureReason=gv(row,["Failure reason","FailureReason","Result description"]), errorCode=gv(row,["Error code","ErrorCode"]), microsoftRisk=gv(row,["Risk level during sign-in","RiskLevelDuringSignIn","Risk level","RiskLevelAggregated"]), time=gv(row,["Date","CreatedDateTime","Created date time","Time","Date (UTC)","Sign-in date"]), vpnRaw=gv(row,["VPN","Is VPN","VPN detected","Proxy","Is proxy"]);
  const failed=looksFailed(status,errorCode,failureReason);
  return {id:`${index}-${user}-${ip}-${time}`,time,user,displayName,ip,city,state,country,application,status:failed?"Failed":(status||"Success"),failureReason,microsoftRisk,importedVpn:/^(true|yes|vpn|proxy)$/i.test(vpnRaw)?"Yes":/^(false|no)$/i.test(vpnRaw)?"No":"Unknown",failed,errorCode};
});}

function analyze(records:ImportedSignIn[], intelMap:Map<string,IpIntel>):AnalyzedSignIn[]{
  const failures=new Map<string,number>(), countryCounts=new Map<string,Map<string,number>>();
  for(const r of records){const u=r.user.toLowerCase();if(r.failed&&u)failures.set(u,(failures.get(u)||0)+1); const c=(r.country||intelMap.get(r.ip)?.country||"").toLowerCase(); if(u&&c){if(!countryCounts.has(u))countryCounts.set(u,new Map());const m=countryCounts.get(u)!;m.set(c,(m.get(c)||0)+1);}}
  const normalCountry=new Map<string,string>(); for(const [u,counts] of countryCounts){let best="",n=0;for(const [c,k] of counts)if(k>n){best=c;n=k;}if(best)normalCountry.set(u,best);}
  const ipUsers=new Map<string,Set<string>>(); for(const r of records){if(r.ip&&r.user){if(!ipUsers.has(r.ip))ipUsers.set(r.ip,new Set());ipUsers.get(r.ip)!.add(r.user.toLowerCase());}}

  return records.map(r=>{let score=0;const reasons:string[]=[];const add=(n:number,s:string)=>{score+=n;reasons.push(s)}; const intel=intelMap.get(r.ip); const mr=riskFromText(r.microsoftRisk);
    if(mr==="high")add(40,"Microsoft high-risk event");else if(mr==="medium")add(25,"Microsoft medium-risk event");else if(mr==="low")add(10,"Microsoft low-risk event");
    if(intel?.tor)add(35,"Tor exit node detected"); else if(intel?.vpn||intel?.proxy)add(15,intel.vpn?"VPN detected by IP intelligence":"Proxy detected by IP intelligence"); else if(r.importedVpn==="Yes")add(15,"VPN/proxy indicated by imported data");
    if(intel?.hosting)add(10,"Hosting/datacenter network"); if(intel?.relay)add(5,"Privacy relay detected");
    if(r.failed)add(8,"Failed sign-in"); const fc=failures.get(r.user.toLowerCase())||0;if(fc>=5)add(15,`${fc} failed sign-ins in uploaded period`);
    const actualCountry=(r.country||intel?.country||"").toLowerCase(), typical=normalCountry.get(r.user.toLowerCase()); if(typical&&actualCountry&&actualCountry!==typical)add(20,"Different country than user's most common uploaded location");
    if(r.ip && (ipUsers.get(r.ip)?.size||0)>=5) add(5,"IP address used by multiple users in this upload");
    score=Math.min(score,100); const level:AnalyzedSignIn["level"]=score>=60?"critical":score>=30?"suspicious":score>=15?"review":"normal";
    return {...r,intel,score,level,reasons};
  });
}
function fmtTime(v:string){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.valueOf())?v:d.toLocaleString();}
function privacyLabel(i?:IpIntel, imported="Unknown"){if(i?.tor)return"Tor";if(i?.vpn)return i.privacyService?`VPN (${i.privacyService})`:"VPN";if(i?.proxy)return"Proxy";if(i?.relay)return"Relay";if(i?.privacyAvailable)return"No";if(imported!=="Unknown")return imported;return"Unknown";}

export default function ImportPage(){
  const [base,setBase]=useState<ImportedSignIn[]>([]),[intel,setIntel]=useState<Map<string,IpIntel>>(new Map()),[fileName,setFileName]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState(""),[filter,setFilter]=useState("all"),[enriching,setEnriching]=useState(false),[saving,setSaving]=useState(false),[saveMessage,setSaveMessage]=useState("");
  const [tenants,setTenants]=useState<Tenant[]>([]),[selectedTenant,setSelectedTenant]=useState(""),[initialLoading,setInitialLoading]=useState(true);
  const [importing,setImporting]=useState(false),[importStatus,setImportStatus]=useState("");
  const fileInputRef=useRef<HTMLInputElement|null>(null);
  const browseRequestedRef=useRef(false);
  const records=useMemo(()=>analyze(base,intel),[base,intel]);

  useEffect(()=>{
    fetch("/api/tenants",{cache:"no-store"})
      .then(async res=>{const data=await res.json();if(!res.ok)throw new Error(data?.error||"Could not load tenants.");return data;})
      .then(data=>{const list:Tenant[]=data.tenants||[];setTenants(list);const params=new URLSearchParams(window.location.search);const q=params.get("tenant");const browse=params.get("browse")==="1";if(q&&list.some(t=>t.id===q)){setSelectedTenant(q);browseRequestedRef.current=browse;}else if(list.length===1){setSelectedTenant(list[0].id);browseRequestedRef.current=browse;}})
      .catch(e=>setError(e instanceof Error?e.message:"Could not load tenants."))
      .finally(()=>setInitialLoading(false));
  },[]);

  useEffect(()=>{
    if(selectedTenant && browseRequestedRef.current){
      browseRequestedRef.current=false;
      const timer=window.setTimeout(()=>fileInputRef.current?.click(),50);
      return ()=>window.clearTimeout(timer);
    }
  },[selectedTenant]);

  async function enrich(records:ImportedSignIn[]){
    const ips=Array.from(new Set(records.map(r=>r.ip).filter(Boolean)));
    const next=new Map<string,IpIntel>();
    if(!ips.length)return next;
    setEnriching(true);
    setImportStatus(`Analyzing ${ips.length} unique IP address${ips.length===1?"":"es"}…`);
    setNotice(`Looking up ${ips.length} unique IP address${ips.length===1?"":"es"}…`);
    try{
      for(let i=0;i<ips.length;i+=250){
        const batch=ips.slice(i,i+250);
        const res=await fetch("/api/ipinfo/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ips:batch})});
        const data=await res.json();
        if(!res.ok)throw new Error(data?.error||"IP intelligence lookup failed.");
        for(const item of (data.results||[]))next.set(item.ip,item);
      }
      setIntel(next);
      const privacy=Array.from(next.values()).filter(x=>x.privacyAvailable).length;
      setNotice(privacy?`IP intelligence complete. Privacy/VPN detection available for ${privacy} of ${next.size} unique IPs.`:`IP location/ASN lookup complete. Your current IPinfo plan did not return VPN/proxy/Tor privacy fields.`);
    }catch(e){
      setNotice("IP intelligence could not be completed. The sign-in data will still be saved.");
      setError(e instanceof Error?e.message:"IP intelligence lookup failed.");
    }finally{
      setEnriching(false);
    }
    return next;
  }
  async function saveHistory(recordsToSave:AnalyzedSignIn[], importFileName:string, tenantId:string){
    if(!recordsToSave.length)throw new Error("No sign-ins were available to save.");
    setSaving(true);
    setSaveMessage("");
    setImportStatus("Saving sign-in history…");
    try{
      const res=await fetch("/api/imports/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileName:importFileName,records:recordsToSave,microsoftTenantId:tenantId})});
      const data=await res.json();
      if(!res.ok)throw new Error(data?.error||"Could not save import.");

      const inserted=Number(data.inserted||0);
      const submitted=Number(data.submitted||recordsToSave.length||0);
      const duplicates=Math.max(0,submitted-inserted);

      // Incident analysis is intentionally non-blocking. The import is complete once
      // sign-in history has been saved; do not keep the user waiting on this endpoint.
      void fetch("/api/imports/process-incidents",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          microsoftTenantId:tenantId,
          since:recordsToSave.map(r=>r.time).filter(Boolean).sort()[0]||null
        })
      }).catch(()=>{});

      const tenantName=String(data.tenant||tenants.find(t=>t.id===tenantId)?.tenant_name||tenants.find(t=>t.id===tenantId)?.tenant_id||"tenant");
      const result=`Import complete for ${tenantName}: ${inserted} new sign-in${inserted===1?"":"s"} saved; ${duplicates} duplicate${duplicates===1?" was":"s were"} ignored. Incident analysis started in the background.`;
      window.sessionStorage.setItem("monitoringStatusMessage",result);
      window.location.assign("/tenants?importComplete=1");
      return true;
    }catch(e){
      setError(e instanceof Error?e.message:"Could not save import.");
      return false;
    }finally{
      setSaving(false);
    }
  }

  async function onFile(e:ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0];
    if(!f)return;
    if(!selectedTenant){
      setError("Select the Microsoft 365 tenant before choosing a CSV file.");
      e.target.value="";
      return;
    }

    const tenant=tenants.find(t=>t.id===selectedTenant);
    const tenantLabel=tenant?.tenant_name||tenant?.tenant_id||"the selected tenant";
    setFileName(f.name);
    setError("");
    setNotice("");
    setSaveMessage("");
    setIntel(new Map());

    try{
      const rows=parseCsv(await f.text());
      if(!rows.length)throw new Error("No data rows were found in the CSV file.");
      const parsed=buildRecords(rows);
      if(!parsed.some(r=>r.user||r.ip))throw new Error("The CSV was read, but recognizable Microsoft sign-in columns were not found.");

      const confirmed=window.confirm(
        `Import ${parsed.length} sign-in records from "${f.name}" into:\n\n${tenantLabel}\n\nThe data will be saved automatically. Duplicate sign-ins will be ignored.`
      );
      if(!confirmed){
        setFileName("");
        setBase([]);
        e.target.value="";
        return;
      }

      // Lock the selected tenant for this import by capturing selectedTenant here.
      const importTenantId=selectedTenant;
      setImporting(true);
      setImportStatus(`Preparing ${parsed.length} sign-in record${parsed.length===1?"":"s"} for import…`);
      setBase(parsed);

      const intelMap=await enrich(parsed);
      const analyzed=analyze(parsed,intelMap);
      const redirected=await saveHistory(analyzed,f.name,importTenantId);
      if(!redirected){ setImporting(false); setImportStatus(""); }
    }catch(err){
      setBase([]);
      setError(err instanceof Error?err.message:"Could not read CSV file.");
      setSaving(false);
      setImporting(false);
      setImportStatus("");
    }
  }
  const stats=useMemo(()=>({total:records.length,suspicious:records.filter(r=>r.level==="suspicious"||r.level==="critical").length,failed:records.filter(r=>r.status==="Failed").length,uniqueIps:new Set(records.map(r=>r.ip).filter(Boolean)).size,vpn:new Set(records.filter(r=>r.intel?.vpn||r.intel?.proxy||r.intel?.tor).map(r=>r.ip)).size}),[records]);
  const shown=useMemo(()=>records.filter(r=>filter==="all"||r.level===filter),[records,filter]);
  const selected=tenants.find(t=>t.id===selectedTenant);
  const entraUrl="https://entra.microsoft.com/#view/Microsoft_AAD_IAM/SignInEventsV3Blade";
  if(initialLoading)return <PageLoading/>;
  return <>{importing?<div className="syncOverlay" role="status" aria-live="polite"><div className="syncOverlayCard"><span className="spinner spinnerLarge"/><div><strong>Importing sign-ins…</strong><div className="muted">{importStatus||"Processing CSV import…"} Please leave this page open.</div></div></div></div>:null}<div className="topbar"><div><div className="title">Import Microsoft Sign-ins</div><div className="subtitle">CSV analysis with IP location, network ownership and privacy intelligence</div></div><a className="button" href="/tenants">Manage Tenants</a></div>
    <div className="card uploadCard">
      <h2>1. Select Microsoft 365 tenant</h2>
      <select className="select" value={selectedTenant} onChange={e=>setSelectedTenant(e.target.value)}>
        <option value="">Select tenant…</option>
        {tenants.map(t=><option key={t.id} value={t.id}>{t.tenant_name||t.tenant_id}</option>)}
      </select>
      {!tenants.length?<p className="muted">No tenants are configured yet. <a href="/tenants" style={{textDecoration:"underline"}}>Add a tenant first.</a></p>:null}
      {selected&&selected.automatic_monitoring_available!==true?<div className="infoBox" style={{marginTop:14}}>
        Automatic sign-in retrieval is not available for this tenant. Download the CSV from Microsoft Entra, then import it below.
        <div style={{marginTop:10}}><a className="button primary" href={entraUrl} target="_blank" rel="noreferrer">Open Microsoft Entra Sign-in Logs</a></div>
      </div>:null}
    </div>
    <div className="card uploadCard section"><h2>2. Upload sign-in CSV</h2><p className="muted">Select the tenant first, then choose the Microsoft Entra CSV. Before anything is saved, you will be asked to confirm the tenant name. Valid sign-ins are saved automatically and duplicate sign-ins are ignored.</p>{selected?<div className="infoBox" style={{marginBottom:14}}><strong>Import destination:</strong> {selected.tenant_name||selected.tenant_id}</div>:<div className="infoBox" style={{marginBottom:14}}>Select a tenant above before choosing a CSV file.</div>}<label className={`button primary fileButton${!selectedTenant?" disabled":""}`}>Choose CSV<input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onFile} disabled={!selectedTenant||saving||enriching}/></label>{fileName?<span className="fileName">{fileName}</span>:null}{saving?<span className="fileName">Saving security history…</span>:null}{enriching?<span className="fileName">Analyzing IPs…</span>:null}{notice?<div className="infoBox">{notice}</div>:null}{saveMessage?<div className="infoBox">{saveMessage}</div>:null}{error?<div className="errorBox">{error}</div>:null}</div>
    {records.length?<><div className="grid5 section"><div className="card"><div className="label">Imported Sign-ins</div><div className="metric">{stats.total}</div></div><div className="card"><div className="label">Suspicious / Critical</div><div className="metric">{stats.suspicious}</div></div><div className="card"><div className="label">Failed Sign-ins</div><div className="metric">{stats.failed}</div></div><div className="card"><div className="label">Unique IP Addresses</div><div className="metric">{stats.uniqueIps}</div></div><div className="card"><div className="label">VPN / Proxy / Tor IPs</div><div className="metric">{stats.vpn}</div></div></div>
      <div className="section card"><div className="tableHeader"><div><h2>Analyzed Sign-ins</h2><div className="subtitle">Risk combines Microsoft signals, failures, geography and IP privacy/network intelligence.</div></div><select className="select" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All risk levels</option><option value="critical">Critical</option><option value="suspicious">Suspicious</option><option value="review">Review</option><option value="normal">Normal</option></select></div>
      <div className="tableWrap"><table className="table"><thead><tr><th>Risk</th><th>Time</th><th>User</th><th>IP Address</th><th>Location</th><th>Provider / ASN</th><th>VPN / Privacy</th><th>Application</th><th>Result</th><th>Why</th></tr></thead><tbody>{shown.map(r=><tr key={r.id}><td><span className={`pill ${r.level}`}>{r.level==="suspicious"?"Suspicious":r.level[0].toUpperCase()+r.level.slice(1)}</span><div className="score">{r.score}/100</div></td><td className="nowrap">{fmtTime(r.time)}</td><td><strong>{r.displayName||r.user||"—"}</strong>{r.displayName&&r.user?<><br/><span className="subtitle">{r.user}</span></>:null}</td><td className="nowrap">{r.ip||"—"}</td><td>{[r.city||r.intel?.city,r.state||r.intel?.region,r.country||r.intel?.country].filter(Boolean).join(", ")||"—"}</td><td>{r.intel?.provider||"—"}{r.intel?.asn?<><br/><span className="subtitle">{r.intel.asn}{r.intel.networkType?` · ${r.intel.networkType}`:""}</span></>:null}</td><td>{privacyLabel(r.intel,r.importedVpn)}{r.intel?.hosting?<><br/><span className="subtitle">Hosting/datacenter</span></>:null}{r.intel?.error&&!r.intel.privacyAvailable?<><br/><span className="subtitle">Privacy data unavailable</span></>:null}</td><td>{r.application||"—"}</td><td><span className={`pill ${r.status==="Failed"?"critical":"normal"}`}>{r.status||"Success"}</span>{r.failureReason?<div className="subtitle">{r.failureReason}</div>:null}</td><td>{r.reasons.join("; ")}</td></tr>)}</tbody></table></div></div></>:null}</>;
}
