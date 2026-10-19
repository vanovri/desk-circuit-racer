import copy
import json
from pathlib import Path
import unittest

from desk_spatial_mapper import map_scene
from verify_desk_racer import verify_scene

SOURCE=json.loads((Path(__file__).resolve().parents[1]/'examples/detections.json').read_text())


class MapperTests(unittest.TestCase):
    def test_mapping_is_reproducible_and_all_segments_pass_independent_referee(self):
        a=map_scene(SOURCE);self.assertEqual(a,map_scene(SOURCE));self.assertEqual(verify_scene(a)['status'],'pass')
        self.assertEqual(a,json.loads((Path(__file__).resolve().parents[1]/'desk_scene.json').read_text()))
        self.assertEqual(len(a['obstacles']),7);self.assertGreater(len(a['route']),6)

    def test_invalid_boxes_units_and_provenance_are_rejected(self):
        for mutate in (lambda s:s.update(source_kind='ai_reconstruction'),
                       lambda s:s['detections'][0].update(box_2d=[0,0,1001,100]),
                       lambda s:s['detections'][0].update(box_2d=[0,0,0,100]),
                       lambda s:s['detections'][0].update(label='unknown'),
                       lambda s:s['detections'][0].update(box_2d=[0,0,float('nan'),100])):
            source=copy.deepcopy(SOURCE);mutate(source)
            with self.assertRaises(ValueError):map_scene(source)

    def test_blocked_whole_table_rejected_instead_of_fake_route(self):
        source={'source_kind':'synthetic_example','detections':[{'label':'books','box_2d':[0,0,1000,1000]}]}
        with self.assertRaises(ValueError):map_scene(source)

    def test_referee_catches_segment_crossing_despite_free_endpoints(self):
        scene=map_scene(SOURCE)
        # Insert a new obstacle halfway along an otherwise free straight segment.
        a,b=max(zip(scene['route'],scene['route'][1:]),key=lambda pair:(pair[0]['x']-pair[1]['x'])**2+(pair[0]['z']-pair[1]['z'])**2)
        scene['obstacles'].append({'id':'blocker','x':(a['x']+b['x'])/2,'z':(a['z']+b['z'])/2,'width':1,'depth':1,'height':1})
        with self.assertRaisesRegex(ValueError,'Blocked route segment'):verify_scene(scene)

    def test_referee_rejects_wrong_section_ends(self):
        scene=map_scene(SOURCE);scene['section_ends'][0]=0
        with self.assertRaises(ValueError):verify_scene(scene)


if __name__=='__main__':unittest.main()
