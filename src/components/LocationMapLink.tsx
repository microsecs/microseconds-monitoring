"use client";

import { useState } from "react";

/** Approximate IP-derived geography, never an exact device position. */
export default function LocationMapLink({ location, preview = false }: { location: string; preview?: boolean }) {
  const [showMap, setShowMap] = useState(false);
  const valid = !!location && location !== "—" && location.toLowerCase() !== "unknown";
  if (!valid) return <span>{location || "Unknown"}</span>;
  const query = encodeURIComponent(location);
  const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
  return <div className="locationMapBlock">
    <a className="locationMapLink" href={url} target="_blank" rel="noopener noreferrer" title={`View approximate IP location: ${location} in Google Maps`}>
      {location}<span className="locationMapLinkIcon" aria-hidden="true"> ↗</span>
    </a>
    {preview && <div style={{marginTop:6}}>
      <div style={{fontSize:12,opacity:.7}}>Approximate IP-based location, not a precise device location.</div>
      <button type="button" onClick={() => setShowMap(!showMap)} style={{background:"none",border:0,padding:"6px 0",cursor:"pointer",color:"#38bdf8",font:"inherit",fontSize:13}} aria-expanded={showMap}>
        {showMap ? "Hide map preview" : "Show small map preview"}
      </button>
      {showMap && <iframe title={`Approximate map of ${location}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${query}&output=embed`} style={{display:"block",width:"100%",maxWidth:360,height:190,border:"1px solid rgba(148,163,184,.25)",borderRadius:8}} />}
    </div>}
  </div>;
}
