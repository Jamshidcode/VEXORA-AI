const API_URL = "https://fragrant-hall-9e4d.jamshidabduvaliyevn1.workers.dev";
let currentLanguage = "uz";
let conversation = [];
let isSending = false;
let requestController = null;

const translations = {
  uz: {
    placeholder:"VEXORA AI ga xabar yozing...", waiting:"VEXORA AI javob tayyorlamoqda...",
    copied:"✓ Nusxalandi", copy:"Nusxalash", copyFailed:"Nusxalash amalga oshmadi",
    failed:"Xatolik yuz berdi. Qayta urinib ko‘ring.", noCode:"Iltimos, avval matn yoki kod kiriting.",
    imageWait:"Rasm yaratilmoqda. Biroz kuting...", presentationWait:"Taqdimot tayyorlanmoqda...",
    chat:"AI Chat", generator:"Code Generator", debugger:"Bug Fixer", explainer:"Code Explainer",
    image:"Image Studio", presentation:"Presentation", newChat:"Yangi suhbat"
  },
  en: {
    placeholder:"Message VEXORA AI...", waiting:"VEXORA AI is preparing a response...",
    copied:"✓ Copied", copy:"Copy", copyFailed:"Copy failed",
    failed:"Something went wrong. Please try again.", noCode:"Please enter some text or code first.",
    imageWait:"Creating your image. Please wait...", presentationWait:"Preparing your presentation...",
    chat:"AI Chat", generator:"Code Generator", debugger:"Bug Fixer", explainer:"Code Explainer",
    image:"Image Studio", presentation:"Presentation", newChat:"New chat"
  }
};
function t(key){return translations[currentLanguage][key] || key;}

function toggleSidebar(force){
  const side=document.getElementById("sidebar"),back=document.getElementById("mobileBackdrop");
  if(!side)return;
  const open=typeof force==="boolean"?force:!side.classList.contains("open");
  side.classList.toggle("open",open);
  if(back)back.classList.toggle("show",open);
}
function openPage(id,button){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===id));
  const title=document.getElementById("pageTitle");
  if(title)title.textContent=t(id);
  toggleSidebar(false);
}
function changeLanguage(){
  const sel=document.getElementById("language");if(!sel)return;
  currentLanguage=sel.value;
  document.querySelectorAll("[data-uz][data-en]").forEach(el=>{
    const val=el.getAttribute("data-"+currentLanguage);
    // Keep the welcome heading's intentional emphasis markup.
    if(el.id==="unused")return;
    if(el.querySelector("em"))el.innerHTML=val;else el.textContent=val;
  });
  const input=document.getElementById("messageInput");if(input)input.placeholder=t("placeholder");
  const active=document.querySelector(".nav.active");if(active)openPage(active.dataset.page,active);
}

async function copyText(text){
  try{
    if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return true;}
    const area=document.createElement("textarea");area.value=text;
    area.style.position="fixed";area.style.left="-9999px";area.setAttribute("readonly","");
    document.body.appendChild(area);area.select();const ok=document.execCommand("copy");area.remove();return ok;
  }catch(e){return false;}
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function renderRichText(container,text){
  const source=String(text??"");
  const regex=/```([a-zA-Z0-9_+#.-]*)[ \t]*\n?([\s\S]*?)```/g;
  let last=0,m;
  while((m=regex.exec(source))!==null){
    if(m.index>last)appendFormattedText(container,source.slice(last,m.index));
    const lang=(m[1]||"code").toUpperCase();
    const codeText=m[2].replace(/\n$/,"");
    const wrap=document.createElement("div");wrap.className="code-wrapper";
    const head=document.createElement("div");head.className="code-header";
    const label=document.createElement("span");label.textContent=lang;
    const btn=document.createElement("button");btn.className="copy-code-btn";btn.type="button";btn.textContent=t("copy");
    const pre=document.createElement("pre"),code=document.createElement("code");
    code.textContent=codeText;pre.appendChild(code);
    btn.addEventListener("click",async()=>{
      const ok=await copyText(codeText);btn.textContent=ok?t("copied"):t("copyFailed");
      btn.classList.toggle("copied",ok);setTimeout(()=>{btn.textContent=t("copy");btn.classList.remove("copied");},1800);
    });
    head.append(label,btn);wrap.append(head,pre);container.appendChild(wrap);last=regex.lastIndex;
  }
  if(last<source.length)appendFormattedText(container,source.slice(last));
}
function appendFormattedText(container,text){
  // Safe, lightweight formatting: paragraphs and line breaks; no raw HTML execution.
  const lines=String(text).split("\n");
  lines.forEach((line,i)=>{
    const p=document.createElement("span");p.textContent=line;
    if(i<lines.length-1)p.appendChild(document.createElement("br"));
    container.appendChild(p);
  });
}
function addMessage(text,type){
  const area=document.getElementById("chatArea");if(!area)return null;
  const welcome=document.getElementById("welcome");if(welcome)welcome.classList.add("welcome-compact");
  const box=document.createElement("article");box.className="chat-message "+type;
  if(type==="ai"){const tag=document.createElement("div");tag.className="message-label";tag.textContent="VEXORA AI";box.appendChild(tag);}
  renderRichText(box,text);area.appendChild(box);
  const sc=document.getElementById("chatScroll");if(sc)sc.scrollTop=sc.scrollHeight;
  return box;
}
function addTyping(){
  const box=addMessage("", "ai");if(!box)return null;
  const dots=document.createElement("div");dots.className="typing";dots.innerHTML="<i></i><i></i><i></i>";box.appendChild(dots);return box;
}
async function askAI(message,extra={}){
  const controller=new AbortController();requestController=controller;
  const timer=setTimeout(()=>controller.abort(),90000);
  try{
    const response=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,...extra}),signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`Server xatosi (${response.status})`);
    if(!data.answer)throw new Error(data.error||t("failed"));
    return data.answer;
  }catch(err){
    if(err.name==="AbortError")throw new Error("Server javobi kechikdi. Qayta urinib ko‘ring.");
    throw err;
  }finally{clearTimeout(timer);requestController=null;}
}
async function sendMessage(){
  const input=document.getElementById("messageInput");if(!input||isSending)return;
  const message=input.value.trim();if(!message)return;
  isSending=true;const send=document.querySelector(".send-btn");if(send)send.disabled=true;
  addMessage(message,"user");input.value="";autoResize(input);
  conversation.push({role:"user",content:message});
  const loading=addTyping();
  try{
    // Keep a compact conversation context so the assistant can follow up.
    const context=conversation.slice(-10).map(m=>`${m.role==="assistant"?"Assistant":"User"}: ${m.content}`).join("\n\n");
    const answer=await askAI("Quyidagi suhbat kontekstini hisobga olib, foydalanuvchining oxirgi xabariga javob ber. Kod kerak bo‘lsa, uni til nomi ko‘rsatilgan markdown code block ichida ber. Kodni oddiy matn ichiga aralashtirma.\n\n"+context);
    if(loading)loading.remove();addMessage(answer,"ai");conversation.push({role:"assistant",content:answer});
  }catch(err){if(loading){loading.textContent="⚠ "+err.message;loading.classList.add("error");}}
  finally{isSending=false;if(send)send.disabled=false;input.focus();}
}
function handleEnter(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}
function autoResize(el){if(!el)return;el.style.height="auto";el.style.height=Math.min(el.scrollHeight,130)+"px";}
function newChat(){
  conversation=[];const area=document.getElementById("chatArea");if(area)area.innerHTML="";
  const welcome=document.getElementById("welcome");if(welcome)welcome.classList.remove("welcome-compact");
  openPage("chat");const input=document.getElementById("messageInput");if(input)input.focus();
}
function usePrompt(text){const input=document.getElementById("messageInput");if(!input)return;input.value=text;autoResize(input);input.focus();}
function setBusy(button,busy,label){
  if(!button)return;
  if(busy){button.dataset.oldText=button.innerHTML;button.disabled=true;button.textContent=label||t("waiting");}
  else{button.disabled=false;if(button.dataset.oldText)button.innerHTML=button.dataset.oldText;delete button.dataset.oldText;}
}
function showResult(id,text){
  const el=document.getElementById(id);if(!el)return;
  el.innerHTML="";renderRichText(el,String(text));
}
async function runTool(type){
  const config={
    generator:{input:"generatorInput",output:"generatorResult",instruction:"Foydalanuvchi topshirig‘i uchun to‘liq va ishlaydigan yechim yarat. HTML, CSS va JavaScript kerak bo‘lsa, har birini alohida, to‘g‘ri til yorlig‘i bilan code block ichida ber. Kodlarni markdown code blockdan tashqarida yozma. Telefon ekranida ham ishlashini hisobga ol."},
    debugger:{input:"debugInput",output:"debugResult",instruction:"Quyidagi kodni chuqur tekshir. Sintaksis va mantiqiy xatolarni, sababini va aniq tuzatish usulini ko‘rsat. Oxirida to‘liq tuzatilgan kodni tegishli til yorlig‘i bilan bitta code block ichida ber."},
    explainer:{input:"explainInput",output:"explainResult",instruction:"Quyidagi kodni sodda o‘zbek tilida bosqichma-bosqich tushuntir. Muhim qismlarni, ishlash tartibini va ehtimoliy xatolarni ko‘rsat. Kod bo‘lsa code block ichida saqla."}
  };
  const cfg=config[type];if(!cfg)return;
  const input=document.getElementById(cfg.input),value=input?.value.trim();
  if(!value){showResult(cfg.output,t("noCode"));return;}
  const button=input.parentElement.querySelector(".primary-btn");setBusy(button,true,t("waiting"));
  showResult(cfg.output,t("waiting"));
  try{const answer=await askAI(cfg.instruction+"\n\n"+value);showResult(cfg.output,answer);}
  catch(err){showResult(cfg.output,"⚠ "+err.message);}
  finally{setBusy(button,false);}
}
async function generateImage(){
  const prompt=document.getElementById("imagePrompt")?.value.trim(),result=document.getElementById("imageResult"),button=document.querySelector("#image .primary-btn");
  if(!prompt){showResult("imageResult",t("noCode"));return;}
  const size=document.getElementById("imageSize")?.value||"1:1";
  setBusy(button,true,t("imageWait"));result.textContent=t("imageWait");
  try{
    const response=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"generate_image",message:prompt,aspect_ratio:size})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.success||!data.image)throw new Error(data.error||"Rasm yaratishda xatolik");
    result.innerHTML="";
    const img=document.createElement("img");img.src=data.image;img.alt=prompt;img.loading="lazy";result.appendChild(img);
    const link=document.createElement("a");link.className="download-link";link.href=data.image;link.download="vexora-ai-image.png";link.textContent="↓ Rasmni yuklab olish";result.appendChild(link);
    if(data.prompt){const note=document.createElement("p");note.style.cssText="margin-top:10px;color:#8190ad;font-size:10px";note.textContent="Prompt: "+data.prompt;result.appendChild(note);}
  }catch(err){result.textContent="⚠ "+err.message;}
  finally{setBusy(button,false);}
}
async function generatePresentation(){
  const topic=document.getElementById("presentationTopic")?.value.trim(),count=document.getElementById("slideCount")?.value||7,language=document.getElementById("presentationLanguage")?.value||"English";
  const button=document.querySelector("#presentation .primary-btn");
  if(!topic){showResult("presentationResult",t("noCode"));return;}
  setBusy(button,true,t("presentationWait"));showResult("presentationResult",t("presentationWait"));
  try{
    const prompt=`Create a polished ${count}-slide presentation in ${language} about "${topic}". For every slide provide: slide number, concise title, 3-5 short bullet points, and a realistic non-AI-looking photo suggestion. Keep slide text presentation-ready and age-appropriate. Do not claim to create a PowerPoint file; provide structured slide content.`;
    const answer=await askAI(prompt);showResult("presentationResult",answer);
  }catch(err){showResult("presentationResult","⚠ "+err.message);}
  finally{setBusy(button,false);}
}
document.addEventListener("DOMContentLoaded",()=>{
  const app=document.getElementById("app"),splash=document.getElementById("splash");
  const input=document.getElementById("messageInput");
  if(input){input.placeholder=t("placeholder");input.addEventListener("input",()=>autoResize(input));}
  setTimeout(()=>{if(splash)splash.classList.add("hide");if(app)app.classList.add("ready");},1500);
});
