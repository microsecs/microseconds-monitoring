import SupportForm from "./SupportForm";
export default function SupportPage(){return <>
 <div className="topbar"><div><div className="title">Support</div><div className="subtitle">Get help with MicroSECONDS Monitoring</div></div></div>
 <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.35fr) minmax(300px,.65fr)",gap:18,alignItems:"start"}}>
  <div className="card"><h2 style={{marginTop:0}}>Contact Support</h2><div className="subtitle" style={{marginBottom:18}}>Tell us what you need help with and include any error message or relevant details.</div><SupportForm/></div>
  <div className="card"><h2 style={{marginTop:0}}>How-to Videos</h2><div className="subtitle">Step-by-step MicroSECONDS Monitoring videos will be available here soon.</div><div style={{marginTop:18,padding:18,border:"1px solid var(--line)",borderRadius:12,textAlign:"center"}}><div style={{fontWeight:700}}>YouTube Guides</div><div className="subtitle" style={{marginTop:5}}>Coming soon</div></div></div>
 </div>
 </>;}
