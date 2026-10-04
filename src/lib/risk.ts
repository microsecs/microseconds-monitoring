export type RiskInput = {
  vpn?: boolean; proxy?: boolean; tor?: boolean; datacenter?: boolean;
  newCountry?: boolean; newRegion?: boolean; newIp?: boolean;
  impossibleTravel?: boolean; failedCount?: number; microsoftRisk?: 'none'|'low'|'medium'|'high';
};

export function scoreRisk(x: RiskInput){
  let score = 0; const reasons:string[] = [];
  const add=(n:number,r:string)=>{score+=n;reasons.push(r)};
  if(x.tor) add(35,'Tor exit node');
  else if(x.vpn || x.proxy) add(15,'VPN/proxy detected');
  if(x.datacenter) add(10,'Datacenter/hosting network');
  if(x.newCountry) add(30,'New country');
  else if(x.newRegion) add(15,'New region');
  if(x.newIp) add(8,'First-seen IP');
  if(x.impossibleTravel) add(40,'Impossible travel');
  if((x.failedCount||0) >= 5) add(15,'Repeated failed sign-ins');
  if(x.microsoftRisk==='high') add(40,'Microsoft high-risk event');
  else if(x.microsoftRisk==='medium') add(25,'Microsoft medium-risk event');
  else if(x.microsoftRisk==='low') add(10,'Microsoft low-risk event');
  const level = score >= 60 ? 'critical' : score >= 30 ? 'suspicious' : score >= 15 ? 'review' : 'normal';
  return {score:Math.min(score,100), level, reasons};
}
