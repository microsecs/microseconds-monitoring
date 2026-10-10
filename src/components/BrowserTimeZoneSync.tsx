"use client";
import {useEffect} from "react";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
// Keep URL filters, pagination and CSV downloads in the browser's time zone.
export default function BrowserTimeZoneSync(){
 const router=useRouter(), pathname=usePathname(), searchParams=useSearchParams();
 useEffect(()=>{
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  if(searchParams.get("tz")===zone)return;
  const params=new URLSearchParams(searchParams.toString());
  params.set("tz",zone);
  params.delete("page");
  router.replace(`${pathname}?${params.toString()}`,{scroll:false});
 },[router,pathname,searchParams]);
 return null;
}
