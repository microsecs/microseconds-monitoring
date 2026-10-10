export type DateFilter={range?:string;from?:string;to?:string};
export function dateBounds(p:DateFilter){
 const range=p.range||"30d";
 const now=new Date();let start:Date|undefined,end:Date|undefined;
 const durations:Record<string,number>={"24h":86400000,"7d":7*86400000,"30d":30*86400000,"90d":90*86400000};
 if(range in durations)start=new Date(now.getTime()-durations[range]);
 else if(range==="custom"){
  if(p.from&&/^\d{4}-\d{2}-\d{2}$/.test(p.from)){start=new Date(p.from+"T00:00:00Z");if(!Number.isFinite(start.getTime()))throw Error("Invalid start date");}
  if(p.to&&/^\d{4}-\d{2}-\d{2}$/.test(p.to)){end=new Date(p.to+"T00:00:00Z");if(!Number.isFinite(end.getTime()))throw Error("Invalid end date");end.setUTCDate(end.getUTCDate()+1);}
  if(start&&end&&start>=end)throw Error("Start date must be before or equal to end date");
 }else if(range!=="all")throw Error("Invalid date range");
 return {start:start?.toISOString(),end:end?.toISOString()};
}
