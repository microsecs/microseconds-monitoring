import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type IncidentFacts = {
  organizationId?: string;
  cloudProvider: "Microsoft 365" | "Google Workspace";
  user: string; time: string | null; ip: string | null; country: string | null; city: string | null;
  provider: string | null; asn: string | null; app: string | null; status: string | null;
  riskScore: number; reasons: string[]; baseline: any;
};

export type AiIncidentReview = {
  usedAi: boolean;
  classification: "low" | "suspicious" | "critical" | "unknown";
  confidence: number | null;
  recommendedRiskScore: number | null;
  summary: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

function fallbackSummary(f:IncidentFacts){
 const status=String(f.status||"").toLowerCase()==="success"?"successful":"failed";
 const location=[f.city,f.country].filter(Boolean).join(", ")||"an unknown location";
 const network=f.provider||f.asn||"an unknown network provider";
 const why=f.reasons?.length?f.reasons.join("; "):"The sign-in exceeded the configured risk threshold.";
 return `This was a ${status} ${f.cloudProvider} sign-in from ${location} using ${f.ip||"an unknown IP"} on ${network}. ${why} Review the sign-in with the user and confirm whether the activity was expected.`;
}

function priceFor(model:string){
 // Standard-processing prices per 1M tokens. Unknown/custom models are tracked with token usage but $0 estimate.
 if(model==="gpt-6-luna"||model.startsWith("gpt-6-luna-")) return {input:0.05,output:0.25};
 if(model==="gpt-5.6-luna"||model.startsWith("gpt-5.6-luna-")) return {input:0.20,output:1.20};
 return {input:0,output:0};
}

function outputText(data:any){
 if(typeof data?.output_text==="string"&&data.output_text.trim())return data.output_text.trim();
 const parts:string[]=[];for(const item of data?.output||[])for(const c of item?.content||[])if(typeof c?.text==="string")parts.push(c.text);
 return parts.join("\n").trim();
}

function parseJson(raw:string){
 const cleaned=raw.trim().replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/```$/,"" ).trim();
 try{return JSON.parse(cleaned);}catch{}
 const m=cleaned.match(/\{[\s\S]*\}/);if(m){try{return JSON.parse(m[0]);}catch{}}
 return null;
}

async function logUsage(f:IncidentFacts, review:AiIncidentReview){
 if(!f.organizationId||!review.usedAi)return;
 try{
  await getSupabaseAdmin().from("ai_risk_usage").insert({
   organization_id:f.organizationId,model:review.model,input_tokens:review.inputTokens,output_tokens:review.outputTokens,
   estimated_cost_usd:review.estimatedCostUsd,classification:review.classification,confidence:review.confidence
  });
 }catch(e){console.warn("[ai-risk] usage logging failed",e);}
}

export async function createIncidentAnalysis(f:IncidentFacts):Promise<AiIncidentReview>{
 const fallback=fallbackSummary(f),apiKey=process.env.OPENAI_API_KEY;
 const noAi:AiIncidentReview={usedAi:false,classification:"unknown",confidence:null,recommendedRiskScore:null,summary:fallback,model:null,inputTokens:0,outputTokens:0,estimatedCostUsd:0};
 if(!apiKey)return noAi;
 try{
  const model=process.env.OPENAI_RISK_MODEL||process.env.OPENAI_INCIDENT_MODEL||"gpt-6-luna";
  const prompt=[
   "You are a defensive cloud identity security reviewer.",
   `The platform is ${f.cloudProvider}. Use only the supplied facts; never invent facts.`,
   "The deterministic rules engine has already identified this successful sign-in as an incident candidate.",
   "Return ONLY JSON with: classification (low|suspicious|critical), confidence (integer 0-100), recommended_risk_score (integer 0-100), summary (2-4 concise sentences).",
   "Evaluate whether the combination of location, network, baseline, application, and supplied risk indicators makes the activity concerning.",
   "Do not claim compromise without evidence. Give one practical verification step in the summary.",
   "A low classification is allowed, but the application will not suppress a deterministic incident solely because of the AI opinion.",
   "",JSON.stringify(f)
  ].join("\n");
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  let r:Response;
  try{r=await fetch("https://api.openai.com/v1/responses",{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,input:prompt,max_output_tokens:300,reasoning:{effort:"low"}})});}finally{clearTimeout(timer);}
  if(!r.ok){console.warn(`[ai-risk] OpenAI returned ${r.status}`);return noAi;}
  const data:any=await r.json();const parsed=parseJson(outputText(data));if(!parsed)return noAi;
  const cls=["low","suspicious","critical"].includes(String(parsed.classification).toLowerCase())?String(parsed.classification).toLowerCase():"unknown";
  const confidence=Math.max(0,Math.min(100,Number(parsed.confidence)));
  const recommended=Math.max(0,Math.min(100,Number(parsed.recommended_risk_score)));
  const inputTokens=Number(data?.usage?.input_tokens||0),outputTokens=Number(data?.usage?.output_tokens||0),p=priceFor(model);
  const review:AiIncidentReview={usedAi:true,classification:cls as any,confidence:Number.isFinite(confidence)?confidence:null,recommendedRiskScore:Number.isFinite(recommended)?recommended:null,summary:String(parsed.summary||fallback).trim()||fallback,model,inputTokens,outputTokens,estimatedCostUsd:(inputTokens*p.input+outputTokens*p.output)/1_000_000};
  await logUsage(f,review);return review;
 }catch(e){console.warn("[ai-risk] review failed; deterministic incident preserved",e);return noAi;}
}
