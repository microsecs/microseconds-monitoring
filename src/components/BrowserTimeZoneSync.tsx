"use client";
import {useEffect} from "react";
import {usePathname,useRouter,useSearchParams} from "next/navigation";

// The cookie is authoritative for server rendering. Avoid a second client-side
// navigation just to synchronize the URL's timezone parameter.
export default function BrowserTimeZoneSync(){
 const router=useRouter(), pathname=usePathname(), searchParams=useSearchParams();
 useEffect(()=>{
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const encoded=encodeURIComponent(zone);
  const existing=document.cookie.split("; ").find(v=>v.startsWith("microseconds_browser_tz="));
  const cookieMatches=existing===`microseconds_browser_tz=${encoded}`;
  if(!cookieMatches){
   document.cookie=`microseconds_browser_tz=${encoded}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  if(searchParams.get("tz")!==zone){
   const params=new URLSearchParams(searchParams.toString());
   params.set("tz",zone);
   // Updating the URL without router.replace prevents the unnecessary RSC
   // navigation that briefly showed UTC timestamps.
   window.history.replaceState(null,"",`${pathname}?${params.toString()}`);
  }
  // Only refresh if the timezone cookie actually changed. This also handles
  // first visits, when server-rendered timestamps are placeholders.
  if(!cookieMatches) router.refresh();
 },[router,pathname,searchParams]);
 return null;
}
