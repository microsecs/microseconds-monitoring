"use client";
type Opt={id:string;label:string};
export default function TenantSignInFilter({value,microsoftTenants,googleTenants,platform,showUnsuccessful,range,from,to}:{value:string;microsoftTenants:Opt[];googleTenants:Opt[];platform?:string;showUnsuccessful:boolean;range?:string;from?:string;to?:string;}){
 const allTenants=[...microsoftTenants,...googleTenants];
 const selectedId=value.startsWith("google:")?value.slice(7):value;
 const selectedName=allTenants.find(t=>t.id===selectedId)?.label||"All tenants";
 const shortLabel=(label:string)=>label.length>22?label.slice(0,19).trimEnd()+"…\u00a0\u00a0":label;
 return <form method="get">
  <select name="tenant" value={value} className="select" title={selectedName} aria-label="Filter by tenant" style={{width:185,maxWidth:185,height:38,fontSize:14,textOverflow:"ellipsis",overflow:"hidden",whiteSpace:"nowrap"}} onChange={(e)=>e.currentTarget.form?.requestSubmit()}>
   <option value="">All tenants</option>
   <optgroup label="Microsoft 365">{microsoftTenants.map(t=><option key={t.id} value={t.id}>{shortLabel(t.label)}</option>)}</optgroup>
   <optgroup label="Google Workspace">{googleTenants.map(t=><option key={t.id} value={`google:${t.id}`}>{shortLabel(t.label)}</option>)}</optgroup>
  </select>
  {range?<input type="hidden" name="range" value={range}/>:null}
  {from?<input type="hidden" name="from" value={from}/>:null}
  {to?<input type="hidden" name="to" value={to}/>:null}
  {platform?<input type="hidden" name="platform" value={platform}/>:null}
  {showUnsuccessful?<input type="hidden" name="unsuccessful" value="1"/>:null}
 </form>;
}
