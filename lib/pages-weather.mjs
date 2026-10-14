export function selectWeather(snapshot, ids, now=Date.now()) {
  if(snapshot.version!==1 || !Array.isArray(snapshot.metars) || !Array.isArray(snapshot.tafs) || !Number.isFinite(Date.parse(snapshot.retrievedAt))) throw Error('Snapshot météo invalide. Importez un briefing officiel.');
  const errors=[...(snapshot.errors||[])];
  const age=Math.floor((now-Date.parse(snapshot.retrievedAt))/60000);
  if(age>30) errors.push(`Snapshot météo ancien (${age} min). L’actualisation GitHub peut être retardée. Vérifiez un briefing officiel récent.`);
  if(age< -5) errors.push('Horodatage météo incohérent : vérifiez l’heure de votre appareil.');
  return {ids,mode:'github-snapshot',source:snapshot.source,sourceUrl:snapshot.sourceUrl,retrievedAt:snapshot.retrievedAt,metars:snapshot.metars.filter(m=>ids.includes(m.icaoId)),tafs:snapshot.tafs.filter(t=>ids.includes(t.icaoId)),errors};
}
export async function fetchPagesWeather(ids,url,fetcher=fetch) {
  const response=await fetcher(url+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw Error('Snapshot météo indisponible. Importez un briefing officiel et réessayez ultérieurement.');
  return selectWeather(await response.json(),ids);
}
