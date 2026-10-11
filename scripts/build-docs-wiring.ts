// Documentation artwork stays vector-native; connection labels use the compiler's profile.
// Not used: public/docs/ holds hand-drawn Illustrator artwork. Never write there; ask the owner first.
throw new Error('public/docs/ is hand-drawn artwork; this script must not overwrite it.');
import { mkdirSync, writeFileSync } from 'node:fs';
import { BUILTIN_PROFILES } from '../src/hw/profile';
import { getChip } from '../src/hw/chips';
const profile = BUILTIN_PROFILES.find(p => p.id === 'promicro-ssd1306-spi')!;
const bus = getChip(profile.chip).bus;
const C = { ink: '#172c3d', muted: '#526677', ground: '#394651', power: '#c73944', clock: '#267cb8', data: '#149078', cs: '#d08219', dc: '#8257ac', reset: '#bc538c', button: '#278488', sound: '#bd682d' };
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const text = (x: number, y: number, value: string, size = 20, fill = C.ink, anchor = 'start', weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${esc(value)}</text>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = 'none', sw = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const circle = (x: number, y: number, r: number, fill: string, stroke = 'none', sw = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const wire = (points: number[][], color: string, width = 4) => `<path d="${points.map(([x,y],i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="miter"/>`;
const tag = (x: number, y: number, label: string, color: string, w = 80) => rect(x, y, w, 36, '#fff', color, 2) + text(x + w / 2, y + 25, label, 19, color, 'middle', 700);
const panel = (x: number, y: number, w: number, h: number, n: string, title: string, sub: string) => rect(x,y,w,h,'#fff','#d9e2e9',2) + rect(x,y,6,h,'#2e6874') + text(x+26,y+40,n,20,'#2e6874','start',700) + text(x+65,y+40,title,25,C.ink,'start',700) + text(x+26,y+72,sub,17,C.muted);

function usb(x: number, y: number, type: 'micro' | 'c', scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">` + rect(-48,-5,96,60,'#acb5bd','#5c6770',2) + rect(-38,5,76,24,'#273440') + rect(-29,10,58,9,'#a5afb6') + rect(-46,35,12,20,'#d5dce0') + rect(34,35,12,20,'#d5dce0') + (type === 'c' ? rect(-20,14,40,4,'#edf1f4') : rect(-23,16,46,5,'#c6af6f')) + '</g>';
}
function board(x: number, y: number, scale = 1, type: 'micro' | 'c' = 'micro', labels = true) {
  const left = ['TX/1','RX/0','GND','GND','D2','D3','D4','D5','D6','D7','D8','D9'];
  const right = ['RAW','GND','RST','VCC','A3','A2','A1','A0','D15','D14','D16','D10'];
  let v = `<g transform="translate(${x} ${y}) scale(${scale})">` + rect(0,0,240,535,'#155c82','#0d3c58',3) + usb(120,-12,type);
  v += text(120,78,'PRO MICRO',21,'#edf7fa','middle',700);
  // Surface-mount controller, quartz, regulator and passives: all sharp rectangles.
  v += `<g transform="translate(120 286) rotate(45)">` + rect(-24,-24,48,48,'#242c33','#89949c',2);
  for (let i=0;i<6;i++) { const a=-20+i*8; v += rect(a,-30,3,6,'#bdc7cc')+rect(a,24,3,6,'#bdc7cc')+rect(-30,a,6,3,'#bdc7cc')+rect(24,a,6,3,'#bdc7cc'); }
  v += text(0,-5,'ATMEL',8,'#a9b5bc','middle')+text(0,9,'32U4',8,'#a9b5bc','middle')+'</g>';
  v += rect(85,408,70,32,'#bec5ca','#78848e',2)+text(120,429,'16.000',12,'#475865','middle');
  v += rect(84,109,62,28,'#252e36')+rect(92,101,8,8,'#c7ced3')+rect(130,101,8,8,'#c7ced3');
  for (const [px,py] of [[82,168],[140,164],[88,212],[152,385],[79,474],[145,478]]) v+=rect(px,py,17,28,'#cbbd9b')+rect(px,py,17,6,'#d2dbe0')+rect(px,py+22,17,6,'#d2dbe0');
  for (let i=0;i<12;i++) {
    const py=110+i*34;
    v += circle(18,py,10,'#cfab54')+circle(18,py,5,'#102f45')+circle(222,py,10,'#cfab54')+circle(222,py,5,'#102f45');
    if(labels) v+=text(36,py+6,left[i],12,'#e5f0f5')+text(204,py+6,right[i],12,'#e5f0f5','end');
  }
  return v + text(120,515,'5 V · 16 MHz',14,'#e5f0f5','middle') + '</g>';
}
function pushbutton(cx: number, cy: number) {
  let v='';
  for(const side of [-1,1]) for(const dy of [-18,18]) v+=rect(cx+side*36-7,cy+dy-7,14,14,'#b4a481','#776e5d');
  v+=rect(cx-30,cy-30,60,60,'#20272d','#10161b',2)+rect(cx-26,cy-26,52,52,'#a8b0b5','#59636b',2)+circle(cx,cy,20,'#14191e','#080c10',3)+circle(cx-5,cy-7,8,'#242c33');
  for(const dx of [-19,19])for(const dy of [-19,19])v+=circle(cx+dx,cy+dy,3,'#333e45');
  return v;
}
function resetButton(cx: number,cy: number) {
  return rect(cx-50,cy-14,100,28,'#adb8bf','#5a6670',2)+rect(cx-41,cy-20,82,40,'#222a31')+rect(cx-33,cy-17,66,34,'#bdc7cd')+rect(cx-21,cy-12,42,24,'#141b20')+rect(cx-62,cy-5,12,10,'#b8c1c7')+rect(cx+50,cy-5,12,10,'#b8c1c7');
}
function battery(cx: number,cy: number) {
  return circle(cx,cy,52,'#17232a','#0b1318',3)+circle(cx,cy,43,'#404b53')+circle(cx,cy,35,'#bdc6cc','#707f89',2)+rect(cx-9,cy-49,18,33,'#e3e9ed','#7e8b94')+rect(cx-9,cy+17,18,33,'#e3e9ed','#7e8b94')+text(cx,cy+8,'+',27,'#52606b','middle',700)+rect(cx-6,cy-62,12,10,'#a9b5bb')+rect(cx-6,cy+52,12,10,'#a9b5bb');
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1700" viewBox="0 0 1500 1700" role="img" aria-labelledby="title desc"><title id="title">Pro Micro + SSD1306: component connection guide</title><desc id="desc">Top-view vector components with individually colored wires and named Pro Micro terminals. Display and button connections come from the ArduCade hardware profile. The battery holder, switch and 10 kiloohm resistor are shown as unconnected reference components until their specifications are known.</desc>`;
svg += rect(0,0,1500,1700,'#f2f6f8') + '<g font-family="Arial, Helvetica, sans-serif">';
svg += text(48,61,'PRO MICRO + SSD1306',37,C.ink,'start',700) + text(48,95,'ArduCade · SPI · 5 V / 16 MHz · components viewed from above',21,C.muted);
svg += text(48,133,'Wires end at named Pro Micro pins. Matching pin names mean the same connection.',19,C.ink);
const legend=[['GND',C.ground],['VCC',C.power],['CLK',C.clock],['DIN',C.data],['CS',C.cs],['DC',C.dc],['RES',C.reset]];
legend.forEach(([name,color],i)=>{const x=690+i*110;svg+=wire([[x,88],[x+30,88]],color)+text(x+39,95,name,17,C.ink);});

svg+=panel(40,168,640,666,'01','Arduino Pro Micro','Find the pins on your board; the USB connector may vary.');
svg+=board(96,281);
svg+=text(380,292,'Micro-USB',20,C.ink,'start',700)+text(380,322,'The board on the left shows',18,C.muted)+text(380,348,'a typical pin layout.',18,C.muted);
svg+=board(423,405,0.53,'c',false)+text(486,725,'USB-C variant',19,C.ink,'middle',700)+text(380,762,'Check the printed pin names.',18,C.muted)+text(380,791,'USB type does not indicate 3.3 V / 5 V.',18,C.muted);

svg+=panel(708,168,752,666,'02','OLED display','SSD1306 · 128 × 64 · 7-pin SPI module');
const ox=794,oy=315,ow=580,oh=322;
svg+=rect(ox,oy,ow,oh,'#147d9b','#10546d',3);
for(const dx of [24,ow-24])for(const dy of [24,oh-24])svg+=circle(ox+dx,oy+dy,11,'#c0cbd0')+circle(ox+dx,oy+dy,6,'#f2f6f8');
svg+=rect(ox+44,oy+51,ow-88,oh-105,'#b9c5c9','#334550',2)+rect(ox+54,oy+61,ow-108,oh-125,'#07151c');
svg+=text(ox+ow/2,oy+125,'ArduCade',36,'#e0f7f2','middle',700);
// Pixel art platform scene, not an embedded raster image.
for(let col=0;col<27;col++)svg+=rect(ox+64+col*16,oy+224,14,8,'#d6eee8');
for(let i=0;i<6;i++)svg+=rect(ox+325+i*16,oy+180,14,8,'#d6eee8');
svg+=wire([[ox+144,oy+221],[ox+144,oy+189],[ox+158,oy+189],[ox+158,oy+210]],'#d6eee8',6)+circle(ox+151,oy+178,6,'#d6eee8');
svg+=rect(ox+230,oy+oh-27,120,32,'#8e6831')+rect(ox+250,oy+oh-27,80,32,'#3b342b');
const screenPins=[['GND','GND',C.ground],['VCC','VCC',C.power],['CLK',bus.sck!,C.clock],['DIN',bus.mosi!,C.data],['CS',profile.display.cs!,C.cs],['DC',profile.display.dc!,C.dc],['RES',profile.display.rst!,C.reset]];
screenPins.forEach(([name,pin,color],i)=>{const x=846+i*79;svg+=circle(x,oy+23,8,'#d5b86e')+circle(x,oy+23,4,'#243d47')+text(x,oy+48,name,14,'#eef7f8','middle',700)+wire([[x,oy+15],[x,302]],color)+tag(x-32,266,pin,color,64);});
svg+=text(734,690,'Connect wires to these named pins on the Pro Micro.',18,C.muted);
svg+=text(734,727,'Pin order varies between display modules.',19,C.ink,'start',700);
svg+=text(734,758,'The reference has 6 pins, with no visible CS. Verify SPI mode',18,C.muted);
svg+=text(734,785,'and the CS connection before using this profile.',18,C.muted);
svg+=text(734,812,'The display module must accept 5 V power and signals.',17,C.muted);

svg+=panel(40,860,784,442,'03','Six black game buttons','Each button connects one input to GND when pressed.');
const buttons: [string, keyof typeof profile.buttons][]=[['UP','up'],['DOWN','down'],['LEFT','left'],['RIGHT','right'],['A','a'],['B','b']];
buttons.forEach(([label,key],i)=>{
  const col=i%2,row=Math.floor(i/2),cx=220+col*378,cy=1004+row*100,gx=cx-112;
  svg+=wire([[gx,961],[gx,1234]],C.ground)+wire([[gx,cy-18],[cx-36,cy-18]],C.ground)+circle(gx,cy-18,5,C.ground)+wire([[cx+36,cy-18],[cx+93,cy-18]],C.button)+tag(cx+93,cy-36,profile.buttons[key],C.button,70)+pushbutton(cx,cy)+text(cx,cy-45,label,17,C.ink,'middle',700);
  if(row===2)svg+=tag(gx-33,1234,'GND',C.ground,66);
});
svg+=text(68,1290,'Internal pull-ups are enabled. No extra button resistors.',17,C.muted);

svg+=panel(852,860,608,442,'04','Sound and reset','Separate circuits: OLED RES is not the board RST.');
const bx=974,by=1013;
svg+=circle(bx,by,57,'#151d23','#687782',3)+circle(bx,by,48,'#232c33')+circle(bx,by-6,12,'#080d12','#4d5a63',2)+text(bx,by+37,'+',24,'#909da6','middle',700);
svg+=circle(bx-19,by+67,6,'#c3b485')+circle(bx+19,by+67,6,'#c3b485')+wire([[bx-19,by+67],[bx-19,1116]],C.sound)+wire([[bx+19,by+67],[bx+19,1092],[1135,1092]],C.ground)+tag(bx-54,1116,profile.sound.pin1!,C.sound,70)+tag(1135,1074,profile.sound.pin2!,C.ground,70);
svg+=text(1074,991,'Passive buzzer / piezo',19,C.ink,'start',700)+text(1074,1021,'D5 outputs sound.',17,C.muted)+text(1074,1047,'D9 is held LOW.',17,C.muted);
svg+=resetButton(985,1210)+wire([[923,1210],[896,1210],[896,1227]],C.ground)+wire([[1047,1210],[1124,1210]],C.reset)+tag(861,1227,'GND',C.ground,70)+tag(1124,1192,'RST',C.reset,70)+text(1256,1206,'RESET',18,C.ink,'middle',700)+text(1256,1232,'2 pins',16,C.muted,'middle');
svg+=text(878,1290,'Appearance alone does not identify active / passive buzzers.',16,C.muted);

svg+=panel(40,1328,1420,326,'05','Battery, switch and resistor','Reference components · not connected in this diagram');
svg+=battery(159,1494)+battery(294,1494)+text(226,1581,'2 × 3 V coin cells',18,C.ink,'middle',700);
// SPDT slide switch viewed from above, with three distinct terminals.
svg+=rect(454,1452,131,65,'#9ca9b2','#586774',2)+rect(450,1464,12,42,'#c5cfd5')+rect(581,1464,12,42,'#c5cfd5')+rect(476,1467,83,22,'#111a21')+rect(485,1462,29,35,'#202b33');
for(let i=0;i<3;i++)svg+=rect(470+i*35,1517,10,35,'#bda77c','#77684d');
svg+=text(520,1581,'3-pin power switch',18,C.ink,'middle',700);
// Rectangular vector body respects the project's no-rounded-corners rule.
svg+=wire([[671,1490],[712,1490]],'#85939d',4)+rect(712,1473,115,34,'#d9c49b','#9c875b',2)+wire([[827,1490],[866,1490]],'#85939d',4);
for(const [dx,color] of [[16,'#734426'],[34,'#22282d'],[56,'#d7822d'],[96,'#b5964c']] as const)svg+=rect(712+dx,1473,7,34,color);
svg+=text(769,1550,'10 kΩ · reference only',18,C.ink,'middle',700);
svg+=text(912,1464,'Verify the battery wiring first.',21,C.ink,'start',700)+text(912,1496,'Series: about 6 V. Parallel: about 3 V.',18,C.muted)+text(912,1526,'Never connect 6 V directly to VCC.',18,C.power,'start',700)+text(912,1556,'No buzzer resistor value has been selected.',17,C.muted)+text(912,1586,'Pro Micro normally has a reset pull-up.',17,C.muted);
svg+=text(48,1684,'Typical components, not to scale. Follow the pin labels and datasheets for your own modules.',17,C.muted)+'</g></svg>';
mkdirSync(new URL('../public/docs/',import.meta.url),{recursive:true});
writeFileSync(new URL('../public/docs/pro-micro-wiring.svg',import.meta.url),svg);

// Electrical schematic for the assembled modules, not the original Arduboy PCB.
let schematic = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1500" viewBox="0 0 1500 1500" role="img" aria-labelledby="title desc"><title id="title">ArduCade Pro Micro electrical schematic</title><desc id="desc">USB powered 5 V 16 MHz Pro Micro, seven-pin SSD1306 SPI module, six active-low buttons, passive piezo between D5 and D9, and a two-pin reset button. Matching net names connect electrically. Unverified battery components are excluded from the powered circuit.</desc>`;
schematic += rect(0,0,1500,1500,'#f2f6f8') + '<g font-family="Arial, Helvetica, sans-serif">';
schematic += text(40,58,'PRO MICRO · ELECTRICAL SCHEMATIC',34,C.ink,'start',700)
  + text(40,94,'ArduCade · 5 V / 16 MHz · USB power · matching net names connect electrically',20,C.muted);
schematic += panel(40,124,690,674,'01','Pro Micro module','USB connector and regulator are part of the board.');
schematic += rect(242,242,252,498,'#eef3f6',C.ink,2)+text(368,277,'U1 · PRO MICRO',21,C.ink,'middle',700)
  +text(368,306,'ATmega32U4',18,C.muted,'middle')+text(368,334,'USB → board power',17,C.muted,'middle');
const leftNets: [string,string,string][] = [['A0','UP',C.button],['A3','DOWN',C.button],['A2','LEFT',C.button],['A1','RIGHT',C.button],['D7','A',C.button],['D8','B',C.button],['RST','RESET',C.reset],['GND','GND',C.ground]];
const rightNets: [string,string,string][] = [['VCC','+5V',C.power],[bus.sck!,'OLED_CLK',C.clock],[bus.mosi!,'OLED_DIN',C.data],[profile.display.cs!,'OLED_CS',C.cs],[profile.display.dc!,'OLED_DC',C.dc],[profile.display.rst!,'OLED_RES',C.reset],[profile.sound.pin1!,'PIEZO_1',C.sound],[profile.sound.pin2!,'PIEZO_2',C.sound]];
for (const [entries,isLeft] of [[leftNets,true],[rightNets,false]] as const) entries.forEach(([pin,net,color],i)=>{
  const y=372+i*47;
  schematic += text(isLeft?258:478,y+6,pin,18,C.ink,isLeft?'start':'end',700)
    + wire(isLeft?[[192,y],[242,y]]:[[494,y],[540,y]],color)
    + tag(isLeft?64:540,y-18,net,color,136);
});
schematic += text(64,776,'RAW is unused in this USB-powered circuit.',18,C.muted);
schematic += panel(758,124,702,674,'02','SSD1306 SPI module','128 × 64 · 7 pins · must accept 5 V power and signals');
schematic += rect(1035,268,376,410,'#eef3f6',C.ink,2)+text(1223,309,'U2 · OLED',24,C.ink,'middle',700);
const oledNets: [string,string,string][] = [['GND','GND',C.ground],['VCC','+5V',C.power],['CLK / D0','OLED_CLK',C.clock],['DIN / D1','OLED_DIN',C.data],['CS','OLED_CS',C.cs],['DC','OLED_DC',C.dc],['RES / RST','OLED_RES',C.reset]];
oledNets.forEach(([pin,net,color],i)=>{const y=357+i*47;schematic+=tag(782,y-18,net,color,164)+wire([[946,y],[1035,y]],color)+text(1055,y+6,pin,20,C.ink,'start',700);});
schematic += text(782,724,'Follow the printed pin names, not the header position.',18,C.muted)
 +text(782,755,'A 6-pin module needs verified SPI mode and CS wiring.',18,C.muted)
 +text(782,780,'OLED RES connects to D6; it is separate from board RST.',17,C.muted);
schematic += panel(40,826,852,402,'03','Six momentary game buttons','Normally open · active LOW · internal pull-ups · no external resistors');
function switchCircuit(x:number,y:number,net:string,label:string,color:string){
 return text(x,y-33,label,18,C.ink,'start',700)+tag(x,y-18,net,color,94)
 +wire([[x+94,y],[x+130,y]],color)+circle(x+135,y,4,'#fff',C.ink,2)
 +circle(x+200,y,4,'#fff',C.ink,2)+wire([[x+139,y],[x+192,y-19]],C.ink,3)
 +wire([[x+204,y],[x+238,y]],C.ground)+tag(x+238,y-18,'GND',C.ground,92);
}
leftNets.slice(0,6).forEach(([,net],i)=>{const col=i%2,row=Math.floor(i/2);schematic+=switchCircuit(64+col*416,963+row*93,net,`SW${i+1} · ${net}`,C.button);});
schematic += panel(920,826,540,402,'04','Piezo and reset','Passive piezo · two-pin momentary reset button');
schematic += text(944,935,'BZ1 · passive piezo',19,C.ink,'start',700)
 +tag(944,959,'PIEZO_1',C.sound,112)+wire([[1056,977],[1101,977]],C.sound)
 +rect(1101,959,24,36,'#fff',C.ink,2)+`<path d="M1125 959L1153 944V1010L1125 995Z" fill="#eef3f6" stroke="${C.ink}" stroke-width="2"/>`
 +wire([[1153,977],[1275,977]],C.sound)+tag(1275,959,'PIEZO_2',C.sound,140)
 +text(944,1042,'D5 outputs sound. D9 is held LOW by ArduCade.',17,C.muted)
 +switchCircuit(944,1145,'RESET','SW7 · RESET',C.reset);
schematic += panel(40,1256,1420,184,'05','Battery parts: connection not yet verified','Two 3 V coin cells, a three-pin switch and the reference 10 kΩ resistor are not connected here.');
schematic += text(64,1367,'About 6 V in series must never connect directly to VCC. Verify the board regulator before using RAW.',19,C.power,'start',700)
 +text(64,1406,'No battery charger, RGB LEDs or original Arduboy PCB circuitry is required for the USB build shown above.',18,C.muted);
schematic += text(40,1478,'Pin assignments are generated from the ArduCade Pro Micro profile. Module symbols are not physical pin layouts.',17,C.muted)+'</g></svg>';
writeFileSync(new URL('../public/docs/pro-micro-schematic.svg',import.meta.url),schematic);
