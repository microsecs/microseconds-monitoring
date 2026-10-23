"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";

// New pages should start at the top even if the user clicked a link in the footer.
export default function ScrollToTopOnRoute(){
 const pathname=usePathname();
 useEffect(()=>{
  if(pathname==="/terms"||pathname==="/privacy"){
   window.scrollTo({top:0,left:0,behavior:"instant"});
   // Allow the new route's content to settle before restoring the top position.
   const frame=requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:"instant"}));
   return ()=>cancelAnimationFrame(frame);
  }
 },[pathname]);
 return null;
}
