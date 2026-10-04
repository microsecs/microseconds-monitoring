"use client";
type Opt={id:string;label:string};
export default function TenantSignInFilter({value,microsoftTenants,googleTenants,platform,showUnsuccessful}:{value:string;microsoftTenants:Opt[];googleTenants:Opt[];platform?:string;showUnsuccessful:boolean;}){
 return <form method="get">
  <select name="tenant" value={value} className="select" onChange={(e)=>e.currentTarget.form?.requestSubmit()}>
   <option value="">All tenants</option>
   <optgroup label="Microsoft 365">{microsoftTenants.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</optgroup>
   <optgroup label="Google Workspace">{googleTenants.map(t=><option key={t.id} value={`google:${t.id}`}>{t.label}</option>)}</optgroup>
  </select>
  {platform?<input type="hidden" name="platform" value={platform}/>:null}
  {showUnsuccessful?<input type="hidden" name="unsuccessful" value="1"/>:null}
 </form>;
}
