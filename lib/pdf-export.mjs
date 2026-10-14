// Browser/Node compatible. Dependency injection avoids a CDN at export time.
export async function loadPdfTemplate(url, fetcher=fetch) {
  const response=await fetcher(url,{credentials:'same-origin',cache:'no-store'});
  if(response.status===401||response.status===403||(response.headers.get('content-type')||'').includes('text/html')) {
    throw Error('Accès au modèle PDF refusé. Recharge la page et reconnecte-toi à ChatGPT si le site privé le demande. Ton dossier reste enregistré sur cet appareil.');
  }
  if(!response.ok)throw Error('Modèle TAF indisponible. Réessaie après avoir rechargé la page.');
  const bytes=await response.arrayBuffer();
  if(!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))throw Error('Le modèle reçu n’est pas un PDF valide. Recharge la page avant de réessayer.');
  return bytes;
}
export function createPdfExporter(PDFLib) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const ink = rgb(.06,.23,.36), muted=rgb(.35,.4,.45);
  const clean = v => String(v ?? '').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/œ/g,'oe').replace(/Œ/g,'OE').replace(/\u202f|\u00a0/g,' ').replace(/[^\x20-\x7e\xa0-\xff\n]/g,'?');
  const number = (v,d=1) => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '' : Number(v).toFixed(d).replace('.',',');
  const value = v => v === null || v === undefined || v === '' || (typeof v==='number'&&!Number.isFinite(v)) ? 'À renseigner' : String(v);
  const unit=(v,u,d=1)=>number(v,d)?number(v,d)+' '+u:'';
  return async function exportDossier({plan={},results={},weather=[],attachments=[]}, options={}) {
    const bytes=options.templateBytes || await loadPdfTemplate(options.templateUrl || './documents/dossier-vfr-taf.pdf');
    const doc=await PDFDocument.load(bytes), pages=doc.getPages();
    if(pages.length!==4)throw Error('Le modèle TAF attendu comporte quatre pages.');
    const font=await doc.embedFont(StandardFonts.Helvetica), bold=await doc.embedFont(StandardFonts.HelveticaBold);
    const overflow=[];
    const box=(page,x,y,w,h,text,size=9,label='')=>{
      text=clean(text); if(!text)return;
      const sx=page.getWidth()/1203,sy=page.getHeight()/1700;
      const maxW=w*sx-6, maxLines=Math.max(1,Math.floor((h*sy-5)/(size*1.18)));
      const lines=[];
      for(const para of text.split('\n')) { let line='';for(const word of para.split(/\s+/)){const candidate=line?line+' '+word:word;if(font.widthOfTextAtSize(candidate,size)>maxW && line){lines.push(line);line=word;}else line=candidate;}lines.push(line); }
      // Never silently discard data. Long fields are continued in annexes.
      if(lines.length>maxLines || lines.some(l=>font.widthOfTextAtSize(l,size)>maxW)){
        overflow.push([label||'Champ détaillé',text]);
        const short=lines.slice(0,Math.max(0,maxLines-1));short.push('Suite en annexe');lines.splice(0,lines.length,...short);
      }
      lines.forEach((line,i)=>page.drawText(line,{x:x*sx+3,y:page.getHeight()-y*sy-size-3-i*size*1.18,size,font,color:ink}));
    };
    const tick=(p,x,y,checked)=>{if(checked===true)box(p,x,y,28,30,'X',11);};
    const white=(p,x,y,w,h)=>p.drawRectangle({x:x*p.getWidth()/1203,y:p.getHeight()-(y+h)*p.getHeight()/1700,width:w*p.getWidth()/1203,height:h*p.getHeight()/1700,color:rgb(1,1,1)});
    const p1=pages[0],p2=pages[1],p3=pages[2],p4=pages[3],legs=(plan.legs||[]).slice(0,3);
    [plan.date,plan.departureTime,'TB200',plan.registration].forEach((v,i)=>box(p1,74+i*264,202,264,43,value(v)));
    [plan.pilot,plan.pob,plan.sunset,plan.departure||legs[0]?.departure].forEach((v,i)=>box(p1,74+i*264,287,264,43,value(v)));
    legs.forEach((l,i)=>box(p1,74+i*352,374,350,41,`${value(l.arrival)} / ${value(l.alternate)}`,9,`Destination et dégagement ${i+1}`));
    const checks=plan.checklist||{};
    ['documents','notam','weather','navigation'].forEach((k,i)=>tick(p1,566,469+i*40,checks[k]));
    ['fuel','wb','performance','flightplan','conclusion'].forEach((k,i)=>tick(p1,871,469+i*40,checks[k]));
    const docs=plan.documents||{};
    tick(p1,324,786,docs.identity);box(p1,616,785,121,29,docs.licenseValidity,7,'Validité licence/QC');box(p1,955,785,115,29,docs.medicalValidity,7,'Validité médicale');
    ['manual','registration','airworthiness','cen','journeyLog'].forEach((k,i)=>tick(p1,548,870+i*40,docs[k]));
    ['noise','radio','insurance','weighing','interception'].forEach((k,i)=>tick(p1,1038,870+i*40,docs[k]));
    box(p1,405,990,133,28,docs.cenValidity,7);box(p1,462,1030,76,28,docs.potential,7);box(p1,915,950,114,28,docs.insuranceValidity,7);
    box(p1,80,1183,1038,461,plan.notamSummary || 'Briefing NOTAM : consulter les annexes jointes et vérifier la couverture de la route, des horaires et des niveaux.',10,'NOTAM');
    box(p2,80,133,1038,325,plan.weatherSummary||'Produits météo et messages bruts en annexe, selon les documents disponibles.',10,'Synthèse météo');
    const wxCols=[plan.departureWeather||{},...legs.map(l=>l.weather||{})];
    wxCols.forEach((w,i)=>{
      box(p2,[247,447,678,909][i],504,[181,212,212,212][i],34,w.terrain|| (i?`${legs[i-1]?.arrival||''}/${legs[i-1]?.alternate||''}`:plan.departure),8);
      ['visibility','ceiling','wind','qfu'].forEach((k,j)=>box(p2,[241,441,672,902][i],545+j*57,[194,225,225,225][i],50,w[k],8,`Météo ${i+1} ${k}`));
    });
    legs.forEach((l,i)=>{
      const nav=l.navigation||{};const y=941+i*254;
      box(p2,110,y,238,205,`${value(l.departure)}\n${nav.departure||''}`,8,`Navigation départ ${i+1}`);
      box(p2,369,y,493,205,typeof nav==='string'?nav:`${nav.route||''}\n${nav.enroute||''}\n${l.durationMin ? 'Temps prévu : '+l.durationMin+' min':''}`,8,`Navigation route ${i+1}`);
      box(p2,883,y,238,205,`${value(l.arrival)}\nDég. ${value(l.alternate)}\n${nav.arrival||''}`,8,`Navigation arrivée ${i+1}`);
    });
    const keys=['taxi','procedures','trip','contingency','alternate','extra','discretionary','finalReserve','total'];
    legs.forEach((l,i)=>{
      box(p3,497+i*172,145,155,29,`${l.departure||''}-${l.arrival||''}`,8);
      keys.forEach((k,j)=>box(p3,494+i*172,190+j*48.6,164,38,number(l.fuel?.[k])+(Number.isFinite(Number(l.fuel?.[k]))&&l.fuel?.[k]!==''&&l.fuel?.[k]!=null?' L':''),9));
    });
    [results.fuelMinimum,results.fuelActual,results.fuelExtra].forEach((v,i)=>box(p3,840,674+i*46,160,39,unit(v,'L'),9));
    if(Number.isFinite(Number(plan.consumption)) && plan.consumption!=='' && plan.consumption!=null){
      const sx=p3.getWidth()/1203,sy=p3.getHeight()/1700;
      p3.drawRectangle({x:199*sx,y:p3.getHeight()-796*sy,width:100*sx,height:35*sy,color:rgb(1,1,1)});
      box(p3,198,763,100,30,number(plan.consumption,0)+' L/h',10);
    }
    const rows=results.wbRows||[];
    // 13 exact original table rows: empty/front/rear/bags/ZFM/fuel/TOM/burn1/LM1/burn2/LM2/burn3/LM3.
    rows.slice(0,13).forEach((r,i)=>{
      const y=996+i*45.65;
      if(i===9||i===11){
        white(p3,44,993+i*45.65,169,39);
        white(p3,345,993+i*45.65,76,39);
        box(p3,45,y,165,36,`Variation ${i===9?2:3}`,8);
        box(p3,347,y,71,36,number(r.arm,3),8);
      }
      box(p3,220,y,116,36,number(r.mass),8);
      if([0,4,6,8,10,12].includes(i))box(p3,347,y,71,36,number(r.arm,3),8);
      box(p3,429,y,116,36,number(r.moment),8);
    });
    box(p3,108,1276,95,26,legs[0]?.departure,7);
    legs.forEach((l,i)=>box(p3,98,1367+i*91.3,104,26,l.arrival,7));
    const pts=results.wbPoints||[];let last;
    pts.forEach((pt,i)=>{
      if(!Number.isFinite(pt.cg)||!Number.isFinite(pt.mass))return;
      if(pt.cg<.94||pt.cg>1.21||pt.mass<700||pt.mass>1200){overflow.push(['Point hors cadre du graphique',`${pt.label}: ${number(pt.mass)} kg ; CG ${number(pt.cg,3)} m`]);last=null;return;}
      const sx=p3.getWidth()/1203,sy=p3.getHeight()/1700;
      const point={x:(627+(pt.cg-.94)/.27*527)*sx,y:p3.getHeight()-(1406-(pt.mass-700)/500*449)*sy};
      if(last)p3.drawLine({start:last,end:point,thickness:1,color:ink});
      p3.drawCircle({...point,size:3,color:ink});p3.drawText(String(i+1),{x:point.x+4,y:point.y+3,size:7,font,color:ink});last=point;
    });
    (results.payloadRemaining||[]).slice(0,3).forEach((v,i)=>box(p3,1041,1453+i*46,110,35,unit(v,'kg'),8));
    box(p4,660,280,440,100,'TB20 NON APPLICABLE',16);
    const perf=results.performanceRows||[];
    box(p4,687,902,60,14,'brut',6);
    perf.slice(0,8).forEach((r,i)=>[r.terrain,unit(r.runwayLength,'m',0),unit(r.nco,'m',0)||'À vérifier',unit(r.cat,'m',0)||'À confirmer',i===0?'':unit(r.flaps,'m',0)||'À confirmer'].forEach((v,j)=>box(p4,[300,414,586,758,930][j],928+i*40,[103,158,160,160,159][j],32,v,8,`Performances ${i+1}`)));
    legs.forEach((l,i)=>{box(p4,276+i*298,1364,125,30,l.eobt||l.departureTime,8);box(p4,160+i*298,1400,286,33,l.flightplanStatus||'Statut à renseigner',8);});
    box(p4,82,1525,1037,117,plan.conclusion||'Conclusion et décision du pilote à renseigner.',10,'Conclusion du pilote');

    // Readable annexes retain details and chronology beyond the fixed TAF form.
    let annex,pageY;const margin=40,width=515;
    const newPage=()=>{annex=doc.addPage([595.28,841.89]);pageY=795;annex.drawText('ANNEXES - PRÉPARATION TB200',{x:margin,y:pageY,size:15,font:bold,color:ink});pageY-=27;annex.drawText(clean(`${plan.date||''} | ${plan.registration||''} | Horaires UTC sauf mention explicite`),{x:margin,y:pageY,size:9,font,color:muted});pageY-=27;};
    const write=(text,heading=false)=>{const sz=heading?11:9;for(const para of clean(text).split('\n')){let lines=[],line='';for(const word of para.split(/\s+/)){const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,sz)>width&&line){lines.push(line);line=word;}else line=next;}lines.push(line);for(const l of lines){if(!annex||pageY<48)newPage();annex.drawText(l,{x:margin,y:pageY,size:sz,font:heading?bold:font,color:heading?ink:rgb(.12,.16,.2)});pageY-=sz*1.4;}}pageY-=5;};
    write('Données et contrôles du dossier',true);
    write('Ce dossier contient les données saisies et les calculs disponibles au moment de son export. Les cases cochées reflètent uniquement les validations du pilote. Aucune autorisation de départ automatique.');
    write(`Consommation utilisée : ${value(plan.consumption)} L/h. Masse volumique carburant : ${value(plan.fuelDensity)} kg/L. Méthode réserves : ${value(plan.reservePolicy)}.`);
    write(`Minimum initial calculé : ${unit(results.fuelMinimum,'L')||'à renseigner'} ; réel embarqué : ${unit(results.fuelActual,'L')||'à renseigner'}. ${results.fuelExplanation||''}`);
    write('Checklist et documents du pilote',true);
    const names={documents:'Documents',notam:'NOTAM',notams:'NOTAM',weather:'Météo',navigation:'Navigation',fuel:'Carburant',wb:'Masse et centrage',performance:'Performances',flightplan:'Plan de vol',flightPlan:'Plan de vol',conclusion:'Conclusion',identity:'Identité',license:'Licence et qualification',medical:'Certificat médical',manual:'Manuel de vol',registration:'Immatriculation',airworthiness:'Navigabilité',cen:'CEN',journeyLog:'Carnet de route',noise:'Certificat acoustique',radio:'Licence station',insurance:'Assurance',weighing:'Fiche de pesée',interception:'Signaux interception',licenseValidity:'Validité licence/QC',medicalValidity:'Validité médicale',cenValidity:'Validité CEN',insuranceValidity:'Validité assurance',potential:'Potentiel'};
    const status=v=>v===true?'vérifié':v===false?'non vérifié':value(v);
    Object.entries(checks).forEach(([k,v])=>write(`${names[k]||k} : ${status(v)}`));
    Object.entries(docs).forEach(([k,v])=>write(`${names[k]||k} : ${typeof v==='object'&&v!==null?`${status(v.checked)} ; validité ${value(v.validity)}`:status(v)}`));
    const conditionLabels={alt:'Altitude pression (ft)',oat:'Température (°C)',runway:'Piste',bearing:'QFU (°)',tora:'TORA (m)',toda:'TODA (m)',lda:'LDA (m)',windDir:'Direction vent (°)',windSpeed:'Vent (kt)'};
    legs.forEach((l,i)=>{for(const [key,title] of [['depConditions','Départ'],['arrConditions','Arrivée'],['altConditions','Dégagement']])if(l[key]){write(`Étape ${i+1} - ${title} : conditions saisies`,true);write(Object.entries(l[key]).map(([k,v])=>`${conditionLabels[k]||k} : ${value(v)}`).join(' ; '));}if(l.checklist){write(`Étape ${i+1} - checklist départ`,true);Object.entries(l.checklist).forEach(([k,v])=>write(`${names[k]||k} : ${status(v)}`));}});
    legs.forEach((l,i)=>{write(`Étape ${i+1} : ${value(l.departure)} - ${value(l.arrival)} ; dégagement ${value(l.alternate)}`,true);write(`EOBT : ${value(l.eobt)} ; durée : ${unit(l.durationMin,'min')||'à renseigner'} ; avitaillement avant étape : ${unit(l.refuel,'L')||'à renseigner'}.`);if(l.fuel)write(keys.map(k=>`${({taxi:'Roulages',procedures:'Procédures',trip:'Trajet',contingency:'Réserve route',alternate:'Dégagement',extra:'Extra',discretionary:'Facultatif',finalReserve:'Réserve finale',total:'Total'})[k]} : ${unit(l.fuel[k],'L')||'à renseigner'}`).join(' ; '));});
    write('Masse et centrage : points tracés',true);pts.forEach((p,i)=>write(`${i+1}. ${p.label||''} : ${unit(p.mass,'kg')||'à renseigner'} ; CG ${unit(p.cg,'m',3)||'à renseigner'}${p.fuel==null?'':'; carburant '+(unit(p.fuel,'L')||'à renseigner')}`));
    write('Lecture des variations entre étapes',true);
    write('Pour les étapes 2 et 3, la ligne Variation indique la variation nette de masse et de moment entre deux arrivées. Elle inclut avitaillement, roulage, carburant consommé et changements de chargement. Masse LM précédente - variation nette = masse LM suivante. Une variation négative correspond à une augmentation nette de masse. Le levier est moment net / masse nette ; il reste vide si la variation de masse est nulle ou inconnue.');
    (results.legs||[]).forEach((l,i)=>{
      write(`Étape ${i+1} - masse, centrage et carburant détaillés`,true);
      write(`Carburant avant roulage : ${unit(l.startFuel,'L')||'à renseigner'} ; décollage : ${unit(l.takeoffFuel,'L')||'à renseigner'} ; arrivée : ${unit(l.endFuel,'L')||'à renseigner'}.`);
      for(const [key,label] of [['zfm','ZFM'],['to','Décollage'],['ld','Arrivée']])if(l[key]){
        const w=l[key];write(`${label} : ${unit(w.mass,'kg')||'à renseigner'} ; moment ${unit(w.moment,'kg.m')||'à renseigner'} ; CG ${unit(w.cg,'m',3)||'à renseigner'}`,true);
        (w.rows||[]).forEach(r=>write(`${r.label||'Poste'} : ${unit(r.mass,'kg')||'à renseigner'} ; levier ${unit(r.arm,'m',3)||'à renseigner'} ; moment ${unit(r.moment,'kg.m')||'à renseigner'}`));
      }
      (l.rows||[]).forEach(r=>write(`${r.label||'Poste'} : ${unit(r.mass,'kg')||'à renseigner'} ; levier ${unit(r.arm,'m',3)||'à renseigner'} ; moment ${unit(r.moment,'kg.m')||'à renseigner'}`));
    });
    if(perf.length){write('Performances : détails des valeurs reportées',true);write('Colonne NCO : distances brutes issues des tableaux disponibles, sans validation automatique des facteurs opérationnels applicables.');perf.forEach((r,i)=>write(`${['TODR départ','LDR départ','LDR destination 1','LDR dégagement 1','LDR destination 2','LDR dégagement 2','LDR destination 3','LDR dégagement 3'][i]||'Terrain'} ${r.terrain||''} : longueur disponible ${unit(r.runwayLength,'m',0)||'à renseigner'} ; NCO brut ${unit(r.nco,'m',0)||'à vérifier'} ; CAT ${unit(r.cat,'m',0)||'à confirmer'} ; panne de volets ${unit(r.flaps,'m',0)||'à confirmer'}.`));}
    if(results.warnings?.length){write('Points nécessitant une action',true);results.warnings.forEach(w=>write(typeof w==='string'?w:w.message||String(w)));}
    const wx=Array.isArray(weather)?weather:[weather];
    if(wx.length){write('Messages météo et traçabilité',true);wx.forEach(w=>{write(typeof w==='string'?w:`${w.icao||w.terrain||''} | ${w.source||''} | récupéré : ${w.fetchedAt||''} | validité : ${w.validity||''}`,true);if(typeof w==='object'){if(w.metar)write(w.metar);if(w.taf)write(w.taf);if(w.raw)write(w.raw);if(w.error)write('Récupération : '+w.error);}});}
    if(overflow.length){write('Champs poursuivis depuis le formulaire',true);overflow.forEach(([label,text])=>{write(label,true);write(text);});}
    if(attachments.length){write('Pièces jointes ajoutées après ces annexes',true);attachments.forEach((a,i)=>write(`${i+1}. ${a.name||'Document'} | ${a.source||'Import utilisateur'} | validité ${a.validity||'à vérifier'}${a.fetchedAt?' | récupéré '+a.fetchedAt:''}`));}
    for(const attachment of attachments){
      const buffer=attachment.bytes || (typeof attachment.arrayBuffer==='function'?await attachment.arrayBuffer():null);
      if(!buffer)throw Error(`Pièce jointe sans données : ${attachment.name||'document'}`);
      const type=attachment.type||attachment.mimeType||'';
      if(type.includes('pdf') || /\.pdf$/i.test(attachment.name||'')){
        try{const imported=await PDFDocument.load(buffer);const copied=await doc.copyPages(imported,imported.getPageIndices());copied.forEach(p=>doc.addPage(p));}catch(e){throw Error(`Impossible d'intégrer le PDF ${attachment.name||''} : ${e.message}`);}
      }else if(type.includes('png')||type.includes('jpeg')||/\.(png|jpe?g)$/i.test(attachment.name||'')){
        const img=type.includes('png')||/\.png$/i.test(attachment.name||'')?await doc.embedPng(buffer):await doc.embedJpg(buffer);
        const page=doc.addPage([595.28,841.89]),scale=Math.min(515/img.width,735/img.height);
        page.drawText(clean(attachment.name||'Pièce jointe'),{x:40,y:803,size:11,font:bold,color:ink});page.drawImage(img,{x:(595-img.width*scale)/2,y:45+(735-img.height*scale)/2,width:img.width*scale,height:img.height*scale});
      }else throw Error(`Format de pièce jointe non pris en charge : ${attachment.name||type}`);
    }
    doc.setTitle(`Dossier VFR TB200 ${plan.registration||''} ${plan.date||''}`);doc.setSubject('Dossier pilote TAF rempli et annexes');doc.setCreator('Préparation de vol TB200');
    return await doc.save();
  };
}
