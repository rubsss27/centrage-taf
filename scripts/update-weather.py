"""Download the official AWC cache files once each, preserving raw bulletins."""
import argparse
import gzip
import json
import math
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

SOURCE = 'https://aviationweather.gov/data/cache/'

def timestamp(text):
    return int(datetime.fromisoformat(text.replace('Z', '+00:00')).timestamp())

def number(element, field):
    try:
        result = float(element.findtext(field))
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None

def parse_cache(xml, kind):
    root = ET.fromstring(xml)
    if root.findall('./errors/error'):
        raise ValueError('La source NOAA signale une erreur.')
    latest = {}
    for element in root.findall('./data/' + kind.upper()):
        station = element.findtext('station_id', '')
        raw = element.findtext('raw_text', '')
        if not re.fullmatch('[A-Z]{4}', station) or not raw.strip():
            continue
        if kind == 'metar':
            t = timestamp(element.findtext('observation_time'))
            # Preserve QNH as written when present; XML altimeter is in inches Hg.
            qnh = re.search(r'\bQ(\d{4})\b', raw)
            alt = number(element, 'altim_in_hg')
            item = dict(icaoId=station, rawOb=raw, obsTime=t,
                        temp=number(element, 'temp_c'),
                        wdir=number(element, 'wind_dir_degrees'),
                        wspd=number(element, 'wind_speed_kt'),
                        altim=int(qnh[1]) if qnh else (round(alt*33.8638866667, 1) if alt is not None else None))
        else:
            t = timestamp(element.findtext('issue_time'))
            item = dict(icaoId=station, rawTAF=raw, issueTime=t,
                        validTimeFrom=timestamp(element.findtext('valid_time_from')),
                        validTimeTo=timestamp(element.findtext('valid_time_to')))
        if station not in latest or t > latest[station][0]:
            latest[station] = (t, item)
    if not latest:
        raise ValueError('Cache officiel vide : publication annulée.')
    return [entry[1] for entry in latest.values()]

def download(kind):
    request = urllib.request.Request(SOURCE + kind + 's.cache.xml.gz', headers={
        'User-Agent': 'TAF-Flight-Preparation/2.0 (GitHub Pages weather snapshot)',
        'Accept': 'application/gzip'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return parse_cache(gzip.decompress(response.read()), kind)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='public/weather/latest.json')
    args = parser.parse_args()
    metars = download('metar')
    tafs = download('taf')
    snapshot = dict(version=1, source='NOAA / NWS Aviation Weather Center · caches officiels',
                    sourceUrl='https://aviationweather.gov/data/api/',
                    retrievedAt=datetime.now(timezone.utc).isoformat(),
                    metars=metars, tafs=tafs, errors=[])
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    temporary.replace(output)
    print(f'Snapshot publié : {len(metars)} METAR, {len(tafs)} TAF, {snapshot["retrievedAt"]}')

if __name__ == '__main__':
    main()
