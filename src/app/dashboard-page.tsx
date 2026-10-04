const rows = [
  {risk:'Critical', user:'john@contoso.com', time:'2:14 AM', ip:'185.220.101.4', location:'Frankfurt, DE', vpn:'Yes', reason:'New country + Tor exit node'},
  {risk:'Review', user:'sue@contoso.com', time:'8:52 AM', ip:'104.28.31.18', location:'New York, US', vpn:'No', reason:'First-seen location'},
  {risk:'Normal', user:'mike@contoso.com', time:'9:05 AM', ip:'68.8.22.10', location:'San Diego, US', vpn:'No', reason:'Known network'}
];
export default function Dashboard(){return <>
  <div className="topbar"><div><div className="title">Security Overview</div><div className="subtitle">Microsoft 365 sign-in activity across connected organizations</div></div><div style={{display:"flex",gap:10}}><a className="button" href="/import">Import CSV</a><a className="button primary" href="/api/microsoft/connect">Connect Microsoft 365</a></div></div>
  <div className="grid4">
    <div className="card"><div className="label">Tenants</div><div className="metric">1</div></div>
    <div className="card"><div className="label">Sign-ins Today</div><div className="metric">1,842</div></div>
    <div className="card"><div className="label">VPN / Proxy</div><div className="metric">14</div></div>
    <div className="card"><div className="label">Suspicious</div><div className="metric">6</div></div>
  </div>
  <div className="section card"><h2>Recent Findings</h2><table className="table"><thead><tr><th>Risk</th><th>User</th><th>Time</th><th>IP</th><th>Location</th><th>VPN</th><th>Reason</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td><span className={'pill '+(r.risk==='Critical'?'critical':r.risk==='Review'?'review':'normal')}>{r.risk}</span></td><td>{r.user}</td><td>{r.time}</td><td>{r.ip}</td><td>{r.location}</td><td>{r.vpn}</td><td>{r.reason}</td></tr>)}</tbody></table></div>
</>}
