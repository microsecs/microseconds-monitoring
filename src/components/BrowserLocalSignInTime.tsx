"use client";

import { useEffect, useState } from "react";

/** Sign-in History must never show a server timezone before browser hydration. */
export default function BrowserLocalSignInTime({value, mode}:{value:unknown;mode:"date"|"time"}) {
  const [display, setDisplay] = useState("…");
  useEffect(() => {
    if (!value) { setDisplay("—"); return; }
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) { setDisplay("—"); return; }
    try {
      const text = mode === "date"
        ? date.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})
        : date.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit",second:"2-digit",timeZoneName:"short"});
      setDisplay(text);
    } catch { setDisplay("—"); }
  }, [value, mode]);
  return <span>{display}</span>;
}
