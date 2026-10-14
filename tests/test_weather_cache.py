import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('weather', Path(__file__).parents[1]/'scripts/update-weather.py')
weather = importlib.util.module_from_spec(spec)
spec.loader.exec_module(weather)

class CacheTests(unittest.TestCase):
    def test_metar_raw_latest_units_and_variable(self):
        xml = '''<response><data><METAR><station_id>LFPO</station_id><raw_text>METAR LFPO 141000Z VRB03KT Q1013</raw_text><observation_time>2026-10-14T10:00:00Z</observation_time><temp_c>12</temp_c><wind_dir_degrees>VRB</wind_dir_degrees><wind_speed_kt>3</wind_speed_kt><altim_in_hg>29.91</altim_in_hg></METAR><METAR><station_id>LFPO</station_id><raw_text>old</raw_text><observation_time>2026-10-14T09:00:00Z</observation_time></METAR></data></response>'''
        rows = weather.parse_cache(xml, 'metar')
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['rawOb'],'METAR LFPO 141000Z VRB03KT Q1013')
        self.assertEqual(rows[0]['altim'],1013)
        self.assertIsNone(rows[0]['wdir'])
        self.assertEqual(rows[0]['temp'],12)

    def test_taf_original_and_validity(self):
        xml = '''<response><data><TAF><station_id>LFPO</station_id><raw_text><![CDATA[TAF LFPO ORIGINAL]]></raw_text><issue_time>2026-10-14T10:00:00Z</issue_time><valid_time_from>2026-10-14T12:00:00Z</valid_time_from><valid_time_to>2026-10-15T12:00:00Z</valid_time_to></TAF></data></response>'''
        row = weather.parse_cache(xml,'taf')[0]
        self.assertEqual(row['rawTAF'],'TAF LFPO ORIGINAL')
        self.assertEqual(row['validTimeTo']-row['validTimeFrom'],86400)

    def test_empty_and_error_fail_publication(self):
        for xml in ['<response><data/></response>', '<response><errors><error>unavailable</error></errors></response>']:
            with self.assertRaises(ValueError):
                weather.parse_cache(xml,'metar')

if __name__ == '__main__':
    unittest.main()
