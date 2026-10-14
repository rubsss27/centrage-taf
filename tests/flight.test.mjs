import assert from 'node:assert/strict';
import {AIRCRAFT,PERF,newPlan,newLeg,weight,inEnvelope,performance,flightResults,durations,windComponents} from '../lib/flight.mjs';
let checks=0;const near=(a,b)=>{assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);checks++};
for(const [reg,bag,fuel,moment]of [['F-HTRI',25,115,1250.87],['F-HTFI',6,120,1283.005],['F-GTFI',14,95,1287.09]]){const r=weight(AIRCRAFT[reg],154,77,bag,fuel/.72);near(r.mass,1150);near(r.moment,moment);assert.ok(r.ok);checks++}
for(const b of [PERF.takeoff,PERF.landing,PERF.climb])for(const key of ['roll','d15','vz','grad'].filter(k=>b[k]))for(const m of b.masses)for(let j=0;j<b.isa.length;j++)for(let i=0;i<b.alts.length;i++)near(performance(b,key,m,b.alts[i],b.isa[j]),b[key][m][j][i]);
near(performance(PERF.takeoff,'roll',1025,1000,10),(159+183+187+216+290+334+341+393)/8);
for(const args of [['roll',899,0,0],['roll',1151,0,0],['roll',1000,-1,0],['roll',1000,4001,0],['roll',1000,0,21],['roll',NaN,0,0]]){assert.equal(performance(PERF.takeoff,...args),null);checks++}
for(const [m,cg]of [[970,.949],[1070,1.01],[1150,1.083],[1150,1.205],[700,.949]]){assert.ok(inEnvelope(m,cg));checks++}
const p=newPlan();Object.assign(p,{date:'2026-10-14',departureTime:'10:00',pilot:'EXEMPLE',departure:'LFPN',pob:'3',front:'154',rear:'77',baggage:'14',fuelActual:'120',registration:'F-GTFI',policyConfirmed:true,limitsConfirmed:true});Object.assign(p.legs[0],{arrival:'LFAT',duration:'60',alternate:'LFAB',alternateMinutes:'0',alternateProcedureCount:'0'});p.legs.push({...newLeg(),arrival:'LFPN',duration:'60',refuel:'30'});
let r=flightResults(p);near(r.legs[0].final,30);near(r.legs[0].proc,6);near(r.legs[0].takeoffFuel,115);near(r.legs[0].endFuel,69);near(r.legs[1].startFuel,99);near(r.legs[1].endFuel,48);near(r.fuelMinimum,105);near(r.fuelExtra,15);
near(r.legs[0].to.mass,1055+115*.72);near(r.legs[0].ld.mass,1055+69*.72);assert.ok(!r.issues.length);checks++;
p.legs[1].refuel='0';r=flightResults(p);near(r.fuelMinimum,135);assert.ok(r.issues.some(s=>s.includes('Carburant insuffisant')));checks++;
p.legs[1].front='100';p.legs[1].rear='0';r=flightResults(p);near(r.legs[1].zfm.mass,810+100+14);
p.legs[0].procedureCount='3';r=flightResults(p);near(r.legs[0].proc,9);near(r.legs[0].endFuel,66);
p.finalMinutes='30';assert.ok(flightResults(p).issues.some(s=>s.includes('45 minutes')));checks++;
p.finalMinutes='45';p.legs[0].routeReserve='2';assert.ok(flightResults(p).issues.some(s=>s.includes('3 L')));checks++;
p.fuelActual='220';assert.ok(flightResults(p).issues.some(s=>s.includes('204 L')));checks++;
near(durations({...newLeg(),distance:'120',tas:'120',headwind:'20'}),72);near(windComponents({windDir:'180',bearing:'180',windSpeed:'10'}).head,10);
console.log(`${checks} contrôles réussis : pesées, tableaux, interpolation, carburant multi-étapes, réserves, avitaillements, changements de charge et bornes.`);
