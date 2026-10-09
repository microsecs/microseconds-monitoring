import tls from "node:tls";

function env(name:string, fallback?:string){ return process.env[name] || fallback || ""; }
function addressOnly(v:string){ const m=v.match(/<([^>]+)>/); return (m?.[1] || v).trim(); }
function b64(v:string){ return Buffer.from(v,"utf8").toString("base64"); }
function dotStuff(v:string){ return v.replace(/\r?\n/g,"\r\n").replace(/^\./gm,".."); }

export function smtpConfigured(){ return Boolean(env("SMTP_PASSWORD") || env("RESEND_SMTP_PASSWORD")); }

export async function sendSmtpMail(p:{from:string;to:string;subject:string;html:string}){
 const host=env("SMTP_HOST","smtp.resend.com");
 const port=Number(env("SMTP_PORT","465"));
 const user=env("SMTP_USER","resend");
 const password=env("SMTP_PASSWORD") || env("RESEND_SMTP_PASSWORD");
 if(!password) throw new Error("SMTP_PASSWORD is missing");
 return await new Promise<{messageId:string}>((resolve,reject)=>{
  const socket=tls.connect({host,port,servername:host,rejectUnauthorized:true});
  let buffer="", stage=0, finished=false;
  const messageId=`<${Date.now()}.${Math.random().toString(36).slice(2)}@microseconds.com>`;
  const fail=(e:any)=>{ if(!finished){finished=true; socket.destroy(); reject(e instanceof Error?e:new Error(String(e)));} };
  const send=(s:string)=>socket.write(s+"\r\n");
  const commands=[
   ()=>send(`EHLO monitoring.microseconds.com`),
   ()=>send("AUTH LOGIN"),
   ()=>send(b64(user)),
   ()=>send(b64(password)),
   ()=>send(`MAIL FROM:<${addressOnly(p.from)}>`),
   ()=>send(`RCPT TO:<${addressOnly(p.to)}>`),
   ()=>send("DATA"),
   ()=>{
    const msg=[`From: ${p.from}`,`To: ${p.to}`,`Subject: ${p.subject}`,`Message-ID: ${messageId}`,"MIME-Version: 1.0",'Content-Type: text/html; charset="UTF-8"',"Content-Transfer-Encoding: 8bit","",dotStuff(p.html),"."].join("\r\n");
    socket.write(msg+"\r\n");
   },
   ()=>send("QUIT")
  ];
  socket.setTimeout(20000,()=>fail(new Error("SMTP connection timed out")));
  socket.on("error",fail);
  socket.on("secureConnect",()=>{});
  socket.on("data",chunk=>{
   buffer+=chunk.toString();
   const lines=buffer.split(/\r\n/); buffer=lines.pop()||"";
   for(const line of lines){
    if(!/^\d{3}[ -]/.test(line) || /^\d{3}-/.test(line)) continue;
    const code=Number(line.slice(0,3));
    if(code>=400){ fail(new Error(`SMTP ${code}: ${line.slice(4)}`)); return; }
    if(stage===0 && code!==220) continue;
    // Stage 8 is the server response to the message body. A 250 here means
    // the server accepted the message; do not wait for the optional QUIT/221
    // exchange before returning success to the UI.
    if(stage===8 && code===250){
     if(!finished){finished=true; send("QUIT"); socket.end(); resolve({messageId});}
     return;
    }
    const fn=commands[stage++]; if(fn) fn();
   }
  });
 });
}
