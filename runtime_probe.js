
const fs=require("fs"),vm=require("vm");
const src=fs.readFileSync("app.js","utf8");

function el(){
  return new Proxy({
    id:"",value:"",textContent:"",innerHTML:"",style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},
    disabled:false,checked:false,children:[],dataset:{},
    addEventListener(t,f){(winEvents[t]??=[]).push(f)},removeEventListener(){},appendChild(){},remove(){},
    querySelector(){return el()},querySelectorAll(){return []},closest(){return null},
    getBoundingClientRect(){return {left:0,top:0,width:100,height:100}},
    focus(){},select(){},setAttribute(){},getAttribute(){return null}
  },{get(t,p){if(p in t)return t[p]; if(typeof p==="string")return ()=>{}; return undefined}});
}
const store={};
const docEvents={}; const winEvents={};
const document={
  readyState:"complete",
  getElementById(){return el()},
  querySelector(){return el()},
  querySelectorAll(){return []},
  createElement(){return el()},
  addEventListener(t,f){(docEvents[t]??=[]).push(f)},
  removeEventListener(){},
  body:el(),
  documentElement:el()
};
const window={
  addEventListener(t,f){(winEvents[t]??=[]).push(f)},removeEventListener(){},
  setTimeout:setTimeout,clearTimeout:clearTimeout,setInterval:setInterval,clearInterval:clearInterval,
  requestAnimationFrame:(fn)=>setTimeout(()=>fn(Date.now()),16),
  cancelAnimationFrame:clearTimeout,
  localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]},
  navigator:{vibrate(){},clipboard:{writeText:async()=>{}}},
  location:{origin:"https://example.test",pathname:"/"},
  Audio:function(){return {play(){return Promise.resolve()},addEventListener(){},volume:1,currentTime:0}},
  performance:{now:()=>Date.now()}
};
const context={window,document,localStorage:window.localStorage,navigator:window.navigator,location:window.location,
  Audio:window.Audio,performance:window.performance,requestAnimationFrame:window.requestAnimationFrame,
  cancelAnimationFrame:window.cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,
  console,Math,Date,JSON,Promise,URL,fetch:async()=>({ok:true,json:async()=>({})}),
  alert(){},confirm(){return true},prompt(){return null},queueMicrotask,
  TextEncoder,TextDecoder
};
window.window=window; window.document=document;
context.globalThis=context;
let uncaught=null;
process.on("uncaughtException",e=>{uncaught=e; console.error("UNCAUGHT",e.stack)});
try{
  vm.runInNewContext(src,context,{filename:"app.js",timeout:10000});
  console.log("TOP_LEVEL_EXECUTION: PASS");
  for(const f of (docEvents.DOMContentLoaded||[])){
    try{f({type:"DOMContentLoaded"})}catch(e){console.log("DOMContentLOADED HANDLER FAIL",e.stack||String(e))}
  }
  for(const f of (winEvents.load||[])){
    try{f({type:"load"})}catch(e){console.log("LOAD HANDLER FAIL",e.stack||String(e))}
  }
}catch(e){
  console.log("TOP_LEVEL_EXECUTION: FAIL");
  console.log(e.stack||String(e));
}
setTimeout(()=>process.exit(0),100);
