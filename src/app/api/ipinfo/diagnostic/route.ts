import { NextRequest, NextResponse } from "next/server";
import net from "node:net";

const TEST_IP = "185.183.33.33";

async function fetchJson(url:string){
  const r=await fetch(url,{cache:"no-store"});
  const text=await r.text();
  let data:any={};
  try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
  return {ok:r.ok,status:r.status,data};
}

function summarize(data:any){
  const a=data?.anonymous||data?.privacy||data||{};
  return {
    is_anonymous:data?.is_anonymous ?? a?.is_anonymous ?? null,
    is_hosting:data?.is_hosting ?? a?.is_hosting ?? a?.hosting ?? null,
    is_vpn:a?.is_vpn ?? a?.vpn ?? null,
    is_proxy:a?.is_proxy ?? a?.proxy ?? null,
    is_tor:a?.is_tor ?? a?.tor ?? null,
    is_relay:a?.is_relay ?? a?.relay ?? null,
    service:a?.name ?? a?.service ?? a?.provider ?? null,
    anonymous_object:data?.anonymous ?? null,
    privacy_object:data?.privacy ?? null
  };
}

export async function GET(req:NextRequest){
  const token=process.env.IPINFO_TOKEN;
  if(!token)return NextResponse.json({error:"IPINFO_TOKEN is not configured."},{status:500});
  const requested=req.nextUrl.searchParams.get("ip")||TEST_IP;
  const ip=net.isIP(requested)?requested:TEST_IP;
  const pathIp=net.isIP(ip)===6?ip:encodeURIComponent(ip);

  const full=await fetchJson(`https://api.ipinfo.io/lookup/${pathIp}?token=${encodeURIComponent(token)}`);
  const anonymous=await fetchJson(`https://api.ipinfo.io/lookup/${pathIp}/anonymous?token=${encodeURIComponent(token)}`);

  return NextResponse.json({
    diagnostic:true,
    ip,
    note:"Server-side IPinfo token is never returned by this diagnostic.",
    full_lookup:{ok:full.ok,status:full.status,classification:summarize(full.data),raw:full.data},
    anonymous_lookup:{ok:anonymous.ok,status:anonymous.status,classification:summarize(anonymous.data),raw:anonymous.data}
  },{headers:{"Cache-Control":"no-store"}});
}
