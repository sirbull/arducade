// Both ATtiny illustrations read the same pin configuration used by compilation.
// Not used: public/docs/ holds hand-drawn Illustrator artwork. Never write there; ask the owner first.
throw new Error('public/docs/ is hand-drawn artwork; this script must not overwrite it.');
import { mkdirSync, writeFileSync } from 'node:fs';
import { SECRET_PROFILES } from '../src/hw/profile';
import { getChip } from '../src/hw/chips';
import { ATTINY85_DIP, tinyDipPin } from '../src/hw/attiny85-pinout';
const p = SECRET_PROFILES.find(p => p.id === 'attiny85-pico')!;
const chip = getChip(p.chip);
const C = { ink:'#172c3d', muted:'#536777', ground:'#394651', power:'#c73944', sda:'#149078', scl:'#267cb8', button:'#8257ac', sound:'#bd682d' };
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const text=(x:number,y:number,s:string,size=20,color=C.ink,anchor='start',weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-weight="${weight}">${esc(s)}</text>`;
const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='none',sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const circle=(x:number,y:number,r:number,fill:string,stroke='none',sw=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const wire=(points:number[][],color:string,w=4)=>`<path d="${points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="miter"/>`;
const tag=(x:number,y:number,s:string,color:string,w=96)=>rect(x,y,w,36,'#fff',color,2)+text(x+w/2,y+25,s,18,color,'middle',700);
const panel=(x:number,y:number,w:number,h:number,n:string,title:string,sub:string)=>rect(x,y,w,h,'#fff','#d9e2e9',2)+rect(x,y,6,h,'#2e6874')+text(x+24,y+38,n,20,'#2e6874','start',700)+text(x+66,y+38,title,24,C.ink,'start',700)+text(x+24,y+69,sub,17,C.muted);
const start=(title:string,desc:string)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400" viewBox="0 0 1400 1400" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(desc)}</desc>`+rect(0,0,1400,1400,'#f2f6f8')+'<g font-family="Arial, Helvetica, sans-serif">'+text(40,58,title,36,C.ink,'start',700)+text(40,96,'ArduCade · ATtiny85 Pico · 8 MHz internal clock · one 3 V battery',21,C.muted);
const pinLabel=(port:string)=>`${port} / ${tinyDipPin(port)}`;
function dip(cx:number,cy:number) {
  let s=rect(cx-88,cy-120,176,250,'#202a32','#0b151d',3)+circle(cx-60,cy-93,7,'#afbec8')+circle(cx,cy-108,12,'#0f181f')+`<text transform="translate(${cx} ${cy}) rotate(-90)" font-size="18" fill="#e1eaf0" text-anchor="middle" font-weight="700">ATtiny85</text>`;
  const l=['PB5','PB3','PB4','GND'],r=['VCC','PB2','PB1','PB0'];
  for(let i=0;i<4;i++){const y=cy-72+i*54;
    s+=rect(cx-124,y-8,36,16,'#b7c3cb','#728490')+rect(cx+88,y-8,36,16,'#b7c3cb','#728490');
    s+=text(cx-133,y+7,String(ATTINY85_DIP[l[i]]),19,C.ink,'end',700)+text(cx+133,y+7,String(ATTINY85_DIP[r[i]]),19,C.ink,'start',700);
    s+=text(cx-40,y+7,l[i],16,'#dbe6eb','middle')+text(cx+40,y+7,r[i],16,'#dbe6eb','middle');
  }
  return s;
}
function button(cx:number,cy:number){let s='';for(const dx of [-38,38])for(const dy of [-18,18])s+=rect(cx+dx-7,cy+dy-6,14,12,'#b5a583','#776d58');s+=rect(cx-31,cy-31,62,62,'#252e35','#111c24',2)+rect(cx-26,cy-26,52,52,'#a8b2b9')+circle(cx,cy,20,'#11191f','#060d13',3);for(const dx of [-19,19])for(const dy of [-19,19])s+=circle(cx+dx,cy+dy,3,'#394751');return s;}

let v=start('ATtiny85 · components and connections','Top-view vector ATtiny85, four-pin I2C OLED, two buttons, passive piezo, CR2032 holder, SPDT power switch and decoupling capacitor. Port labels and physical DIP pins follow the ArduCade ATtiny85 Pico profile.');
v+=text(40,131,'Matching pin names mean the same connection. Numbers after / are physical DIP pins, viewed from above.',18,C.ink);
v+=panel(40,156,570,552,'01','Chip and socket','The dot marks pin 1. Check the chip orientation.');
v+=dip(315,412)+text(64,597,'1 = PB5 / RESET. Keep this pin for ISP.',18,C.muted)+text(64,626,'8 = VCC. 4 = GND. No USB or RAW pin.',18,C.muted)+text(64,655,'PB0–PB4 differ from physical DIP pin numbers.',17,C.muted)+text(64,683,'Use a DIP-8 socket to swap or program the chip.',17,C.muted);
v+=panel(638,156,722,552,'02','OLED · 4-pin I2C','SSD1306 · onboard I2C pull-ups · address 0x'+p.display.i2cAddress.toString(16).toUpperCase());
const pins=[['GND','GND',C.ground],['VCC','VCC / 8',C.power],['SCL',pinLabel(chip.bus.scl!),C.scl],['SDA',pinLabel(chip.bus.sda!),C.sda]];
v+=rect(720,348,554,262,'#147d9b','#10546d',3)+rect(753,404,488,164,'#09171e','#b5c3cb',3)+text(997,470,'ArduCade',35,'#d9f1e8','middle',700);
for(const x of [739,1255])for(const y of [370,588])v+=circle(x,y,10,'#c4d1d8')+circle(x,y,5,'#f2f6f8');
for(let i=0;i<23;i++)v+=rect(775+i*19,533,16,8,'#d9f1e8');
pins.forEach(([name,label,color],i)=>{const x=809+i*124;v+=circle(x,373,8,'#d9ba72')+circle(x,373,4,'#193646')+text(x,395,name,16,'#edf6fa','middle',700)+wire([[x,365],[x,307]],color)+tag(x-52,271,label,color,104);});
v+=text(662,654,`SDA = ${pinLabel(chip.bus.sda!)} · SCL = ${pinLabel(chip.bus.scl!)}`,19,C.ink,'start',700)+text(662,684,'Use a 3 V-compatible module; follow its printed pin labels.',18,C.muted);
v+=panel(40,736,790,396,'03','Two buttons and passive piezo','No 1 kΩ pull-downs: ArduCade uses internal pull-ups.');
for(const [cx,port,label] of [[180,p.buttons.left,'LEFT'],[413,p.buttons.right,'RIGHT']] as const){
 const cy=918;v+=text(cx,849,label,18,C.ink,'middle',700)+wire([[cx-85,cy-18],[cx-38,cy-18]],C.ground)+wire([[cx+38,cy-18],[cx+78,cy-18],[cx+78,1000]],C.button)+button(cx,cy)+tag(cx-132,956,'GND / 4',C.ground,100)+wire([[cx-85,cy-18],[cx-85,956]],C.ground)+tag(cx+25,1000,pinLabel(port),C.button,110);
}
v+=circle(673,898,47,'#18232b','#657782',3)+circle(673,892,10,'#070f16')+text(673,933,'+',20,'#9dafbd','middle',700)+text(673,849,'PIEZO',18,C.ink,'middle',700)+circle(657,954,5,'#cab783')+circle(689,954,5,'#cab783')+wire([[657,954],[657,999]],C.sound)+tag(610,999,pinLabel(p.sound.pin1!),C.sound,106)+wire([[689,954],[765,954],[765,1054]],C.ground)+tag(710,1054,'GND / 4',C.ground,102);
v+=text(64,1097,'Left + right together = A. There is no up, down or B.',18,C.muted);
v+=panel(858,736,502,396,'04','Power and decoupling','One CR2032 · positive via switch · negative to GND');
v+=circle(964,926,51,'#16232c','#08131c',3)+circle(964,926,37,'#c0cbd2','#788994',2)+rect(956,875,16,29,'#dee6eb')+rect(956,950,16,27,'#dee6eb')+text(964,936,'+',30,'#4f6575','middle',700)+text(964,1012,'CR2032 · 3 V',17,C.ink,'middle',700);
v+=rect(1170,883,129,54,'#b0bdc7','#596e7e',2)+rect(1192,898,79,23,'#17252e')+rect(1199,895,23,30,'#25343e');
for(let i=0;i<3;i++)v+=rect(1189+i*35,937,10,22,'#bdab84');
v+=wire([[964,875],[964,850],[1154,850],[1154,959],[1194,959]],C.power)+wire([[1229,959],[1229,1000]],C.power)+tag(1179,1000,'VCC / 8',C.power,100)+wire([[964,977],[882,977],[882,1054]],C.ground)+tag(872,1054,'GND / 4',C.ground,103)+text(1264,981,'unused',15,C.muted,'middle');
v+=text(882,1112,'Add 100 nF between pins 8 and 4, close to the chip.',17,C.muted);
v+=panel(40,1160,1320,194,'05','Programming and assembly','Remove the chip from its socket to program it separately.');
v+=text(64,1266,'ISP: RESET / 1 · MOSI = PB0 / 5 · MISO = PB1 / 6 · SCK = PB2 / 7 · VCC / 8 · GND / 4',21,C.ink,'start',700)+text(64,1305,'Front: display, buttons, piezo and socket. Back: battery and switch. Check the mirrored underside.',18,C.muted);
v+=text(40,1383,'ArduCade wiring based on the sunyecz06 reference. Buttons changed to active LOW. Not to scale.',17,C.muted)+'</g></svg>';

// Electrical schematic: named nets avoid wire crossings while remaining unambiguous.
let s=start('ATtiny85 · electrical schematic','Electrical schematic for ArduCade ATtiny85 Pico. Named nets connect the same ports. One switched CR2032, a 100 nF bypass capacitor, SSD1306 SDA on PB3 and SCL on PB4, active-low buttons on PB0 and PB2, passive piezo on PB1, and reserved reset on pin 1.');
s+=text(40,132,'Matching net names mean an electrical connection. ArduCade buttons are active LOW, unlike the reference PDF.',18,C.ink);
s+=panel(40,155,1320,273,'01','Power','One 3 V battery. The switch interrupts positive; negative is common GND.');
s+=text(110,282,'B1 · CR2032',20,C.ink,'start',700)+wire([[145,316],[227,316]],C.power)+wire([[145,359],[227,359]],C.ground)+wire([[145,316],[145,331]],C.power)+wire([[145,343],[145,359]],C.ground)+wire([[123,331],[167,331]],C.ink,3)+wire([[132,343],[158,343]],C.ink,3);
s+=wire([[125,306],[125,326]],C.power,3)+wire([[116,316],[134,316]],C.power,3)+wire([[116,359],[134,359]],C.ground,3);
s+=circle(282,316,5,'#fff',C.power,2)+circle(383,316,5,'#fff',C.power,2)+wire([[227,316],[277,316]],C.power)+wire([[287,316],[363,288]],C.power,3)+wire([[388,316],[450,316]],C.power)+tag(450,298,'VCC',C.power)+text(278,270,'SW1 · SPDT',19,C.ink,'start',700)+text(278,404,'One outer pin + centre pin; third pin is unused.',17,C.muted);
s+=tag(227,341,'GND',C.ground)+text(697,270,'C1 · 100 nF ceramic',20,C.ink,'start',700)+tag(685,298,'VCC',C.power)+wire([[781,316],[859,316]],C.power)+wire([[859,280],[859,352]],C.ink,3)+wire([[873,280],[873,352]],C.ink,3)+wire([[873,316],[961,316]],C.ground)+tag(961,298,'GND',C.ground)+text(697,380,'Place the capacitor close to DIP pins 8 and 4.',17,C.muted);
s+=panel(40,456,622,539,'02','ATtiny85 · DIP-8','Top view. Keep PB5/RESET for programming.');
s+=rect(243,580,200,333,'#eef3f6',C.ink,2)+text(343,627,'U1 · ATtiny85',21,C.ink,'middle',700)+circle(260,595,5,C.ink);
const left=['PB5','PB3','PB4','GND'],right=['VCC','PB2','PB1','PB0'];
const nets:Record<string,[string,string]>={PB5:['RESET',C.muted],[chip.bus.sda!]:['OLED_SDA',C.sda],[chip.bus.scl!]:['OLED_SCL',C.scl],GND:['GND',C.ground],VCC:['VCC',C.power],[p.buttons.right]:['RIGHT',C.button],[p.sound.pin1!]:['SOUND',C.sound],[p.buttons.left]:['LEFT',C.button]};
for(let i=0;i<4;i++){const y=686+i*64;
 for(const [port,isLeft] of [[left[i],true],[right[i],false]] as const){const [net,color]=nets[port];
  s+=text(isLeft?263:423,y+7,`${tinyDipPin(port)}  ${port}`,17,C.ink,isLeft?'start':'end',700)+wire(isLeft?[[201,y],[243,y]]:[[443,y],[487,y]],color)+tag(isLeft?65:487,y-18,net,color,136);
 }
}
s+=text(64,966,'PB3 / PB4 provide software I2C in ArduCade.',17,C.muted);
s+=panel(690,456,670,539,'03','Display and sound','SSD1306 · onboard I2C pull-ups · address 0x'+p.display.i2cAddress.toString(16).toUpperCase());
s+=rect(939,585,372,263,'#eef3f6',C.ink,2)+text(1125,624,'OLED · 128 × 64',23,C.ink,'middle',700);
for(const [i,[port,net,color]] of [['VCC','VCC',C.power],['GND','GND',C.ground],['SCL','OLED_SCL',C.scl],['SDA','OLED_SDA',C.sda]].entries()){const y=670+i*46;s+=tag(714,y-18,net,color,152)+wire([[866,y],[939,y]],color)+text(958,y+7,port,18,C.ink,'start',700);}
s+=tag(714,910,'SOUND',C.sound,126)+wire([[840,928],[947,928]],C.sound)+rect(947,910,34,36,'#fff',C.ink,2)+`<path d="M981 910L1013 893V963L981 946Z" fill="#eef3f6" stroke="${C.ink}" stroke-width="2"/>`+wire([[1013,928],[1133,928]],C.ground)+tag(1133,910,'GND',C.ground,102)+text(927,983,'Passive piezo · not a low-impedance speaker',17,C.muted);
s+=panel(40,1023,1320,305,'04','Buttons to ground','Internal pull-ups are enabled. No external 1 kΩ resistors in this version.');
for(const [x,name,net] of [[92,'SW2 · left','LEFT'],[722,'SW3 · right','RIGHT']] as const){const y=1172;
 s+=text(x,y-31,name,21,C.ink,'start',700)+tag(x,y-18,net,C.button,110)+wire([[x+110,y],[x+176,y]],C.button)+circle(x+181,y,4,'#fff',C.ink,2)+circle(x+247,y,4,'#fff',C.ink,2)+wire([[x+184,y-14],[x+243,y-14]],C.ink,3)+wire([[x+251,y],[x+320,y]],C.ground)+tag(x+320,y-18,'GND',C.ground,110);
}
s+=text(64,1250,'Released: HIGH. Pressed: LOW. Both buttons together produce A in the game engine.',19,C.ink)+text(64,1288,'The reference uses buttons to VCC + 1 kΩ to GND. Do not copy that arrangement for ArduCade.',18,C.muted);
s+=text(40,1376,'Checked against the ArduCade profile and Microchip DIP pinout. PB5/RESET is not a third game button.',17,C.muted)+'</g></svg>';
mkdirSync(new URL('../public/docs/',import.meta.url),{recursive:true});
writeFileSync(new URL('../public/docs/attiny85-components.svg',import.meta.url),v);
writeFileSync(new URL('../public/docs/attiny85-schematic.svg',import.meta.url),s);
