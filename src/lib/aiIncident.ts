type IncidentFacts = {
  cloudProvider: "Microsoft 365" | "Google Workspace";
  user: string; time: string | null; ip: string | null; country: string | null; city: string | null;
  provider: string | null; asn: string | null; app: string | null; status: string | null;
  riskScore: number; reasons: string[]; baseline: any;
};
function fallbackSummary(f:IncidentFacts){
 const status=String(f.status||"").toLowerCase()==="success"?"successful":"failed";
 const location=[f.city,f.country].filter(Boolean).join(", ")||"an unknown location";
 const network=f.provider||f.asn||"an unknown network provider";
 const why=f.reasons?.length?f.reasons.join("; "):"The sign-in exceeded the configured risk threshold.";
 return `This was a ${status} ${f.cloudProvider} sign-in from ${location} using ${f.ip||"an unknown IP"} on ${network}. ${why} Review the sign-in with the user and confirm whether the activity was expected.`;
}
export async function createIncidentAnalysis(f:IncidentFacts){
 const fallback=fallbackSummary(f),apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return fallback;
 try{
  const model=process.env.OPENAI_INCIDENT_MODEL||"gpt-5.6-luna";
  const prompt=[
   "You are a cloud identity security analyst.",
   `The cloud platform is ${f.cloudProvider}. You MUST describe it as ${f.cloudProvider}; never substitute another platform.`,
   "Use only the supplied facts. Do not invent location, provider, user, application, or risk indicators.",
   "Write a concise 2-4 sentence assessment. Explain why it may be unusual and give one practical next step.",
   "Do not claim compromise unless the evidence supports it. Do not use markdown.","",JSON.stringify(f)
  ].join("\\n");
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,input:prompt,max_output_tokens:220})});
  if(!r.ok)return fallback;const data:any=await r.json();
  if(typeof data?.output_text==="string"&&data.output_text.trim())return data.output_text.trim();
  const parts:string[]=[];for(const item of data?.output||[])for(const c of item?.content||[])if(typeof c?.text==="string")parts.push(c.text);
  return parts.join("\\n").trim()||fallback;
 }catch{return fallback;}
}
