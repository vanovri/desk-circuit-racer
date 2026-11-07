"""Route selection oracle and the real annotation-to-referee CLI boundary."""
import json
import math
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from desk_spatial_mapper import clear, nearest, route_between
from verify_desk_racer import verify_scene


def test_nearest_matches_exhaustive_distance_and_coordinate_tiebreak():
    scene = {'desk_dimensions': {'width': 12, 'depth': 10},
             'obstacles': [{'x': 0, 'z': 0, 'width': 2, 'depth': 2}]}
    anchor, padding = (0.5, 0.5), 1.0
    free = [{'x': x, 'z': z} for x in range(-5, 6) for z in range(-4, 5)
            if clear({'x': x, 'z': z}, {'x': x, 'z': z}, scene, padding)]
    expected = min(free, key=lambda p: (math.dist((p['x'], p['z']), anchor), p['x'], p['z']))
    assert nearest(anchor, scene, padding) == expected


def test_route_around_barrier_has_clear_segments_and_keeps_endpoints():
    scene = {'desk_dimensions': {'width': 20, 'depth': 20},
             'obstacles': [{'x': 0, 'z': 0, 'width': 2, 'depth': 8}]}
    start, end = {'x': -6, 'z': 0}, {'x': 6, 'z': 0}
    route = route_between(start, end, scene, 1.0)
    assert route[0] == start and route[-1] == end
    assert len(route) > 2
    assert all(clear(a, b, scene, 1.0) for a, b in zip(route, route[1:]))


def test_cli_generated_scene_passes_independent_referee(tmp_path):
    output = tmp_path / 'scene export' / 'desk.json'
    result = subprocess.run([sys.executable, str(ROOT / 'desk_spatial_mapper.py'),
                             '--input', str(ROOT / 'examples/detections.json'), '--output', str(output)],
                            capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
    scene = json.loads(output.read_text(encoding='utf-8'))
    report = verify_scene(scene)
    assert report['status'] == 'pass'
    assert report['gates'] == 6


def test_bad_annotation_does_not_replace_an_existing_scene(tmp_path):
    source, output = tmp_path / 'bad.json', tmp_path / 'scene.json'
    source.write_text('{}', encoding='utf-8')
    output.write_text('preserve previous scene', encoding='utf-8')
    result = subprocess.run([sys.executable, str(ROOT / 'desk_spatial_mapper.py'),
                             '--input', str(source), '--output', str(output)],
                            capture_output=True, text=True, timeout=15)
    assert result.returncode != 0
    assert output.read_text(encoding='utf-8') == 'preserve previous scene'
