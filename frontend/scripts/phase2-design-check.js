// Phase 2 self-check: WCAG AA contrast for every token pair (light + dark) and the mockups' sample numbers vs docs/business-rules.md §2.
// Run: node scripts/phase2-design-check.js
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const L={bg:'#F4F6FB',surface:'#FFFFFF',surface2:'#E6EAF3',text:'#0D1530',muted:'#566080',primary:'#1D3FAF',primarySoft:'#E6ECFB',onPrimary:'#FFFFFF',goldText:'#875F0B',goldSoft:'#FBF2DC',gold:'#E0A82E',ok:'#13774A',okSoft:'#E2F4EA',warn:'#9A5B00',warnSoft:'#FDF0DA',bad:'#B42318',badSoft:'#FDE8E6',hero:'#13297A',heroMuted:'#C9D4F7'};
const D={bg:'#080D1C',surface:'#111934',surface2:'#18223F',text:'#EDF0FA',muted:'#9BA6C6',primary:'#8AA4FF',primarySoft:'#1B2A5A',onPrimary:'#0A1233',goldText:'#F0C14B',goldSoft:'#3A2F12',gold:'#F0C14B',ok:'#4CD38A',okSoft:'#0F3324',warn:'#F2B045',warnSoft:'#3A2A0C',bad:'#FF8A80',badSoft:'#3E1614',hero:'#1A2C78',heroMuted:'#B9C6F5'};
const pairs=[['text','bg'],['text','surface'],['muted','bg'],['muted','surface'],['muted','surface2'],['primary','surface'],['primary','primarySoft'],['onPrimary','primary'],['goldText','goldSoft'],['ok','okSoft'],['ok','surface'],['warn','warnSoft'],['bad','badSoft'],['bad','surface'],['heroMuted','hero']];
let fail=0;for(const [n,T] of [['light',L],['dark',D]]){for(const [f,b] of pairs){const r=cr(T[f],T[b]);if(r<4.5)fail++;console.log(n.padEnd(6),(f+' on '+b).padEnd(26),r.toFixed(2),r>=4.5?'PASS':'FAIL')}
 const r=cr('#1A1300',T.gold);console.log(n.padEnd(6),'#1A1300 on gold'.padEnd(26),r.toFixed(2),r>=4.5?'PASS':'FAIL');if(r<4.5)fail++;
 for(const c of ['#FFFFFF']){const r2=cr(c,T.hero);console.log(n.padEnd(6),'white on hero'.padEnd(26),r2.toFixed(2),r2>=4.5?'PASS':'FAIL');if(r2<4.5)fail++}}
// money checks
const e={SSG:[2150,8200],JOES:[860,3400],PADC:[1225,2950],YMO:[640,1800],LSC:[310,1150],JFMS:[520,2100],Sports:[480,1600],English:[260,900],SciMath:[400,1250],SamFilko:[180,700]};
const cash=Object.values(e).reduce((s,x)=>s+x[0],0),saved=Object.values(e).reduce((s,x)=>s+x[1],0);
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
ok(cash===7025,'school cash 7025 = '+cash);ok(saved===24050,'school saved 24050 = '+saved);ok(cash+saved===31075,'school total 31075');
ok(Math.abs(cash/31075*100-22.6)<0.05,'school cash bar 22.6%');
ok(3400+1060-200===4260&&1060-200===860,'JOES total 4260 = prev 3400 + dues 1060 - exp 200; cash 860');
ok(53*20===1060&&27*20===540&&53+27===80&&Math.abs(53/80*100-66.25)<1e-9,'JOES dues 53x20, 27 unpaid 540, 66.25%');
ok(Math.abs(860/4260*100-20.2)<0.05,'JOES cash bar 20.2%');
ok(160*15-250===2150,'SSG cash = 160x15 dues - 250 expense');ok(24*20===480,'Sports cash = 24x20');
ok(8200-3000===5200&&2150+3000===5150&&5200+5150===10350,'SSG release preview, total unchanged');
ok(860-800===60&&400-350===50,'remit previews (JOES 60, Sci-Math 50)');ok(1225>=450,'PADC expense within cash');
ok(3400-1500===1900&&860+1500===2360&&1900+2360===4260,'JOES release form preview');
console.log(fail?fail+' FAILURES':'ALL CHECKS PASSED');
