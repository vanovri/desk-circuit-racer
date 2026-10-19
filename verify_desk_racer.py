"""Independent geometry checks for the full route, car envelope, and gate disks."""
import argparse
import hashlib
import json
import math
from pathlib import Path


def interval_hit(a,b,minimum,maximum):
    if a==b:return (0.,1.) if minimum<=a<=maximum else None
    lo,hi=sorted(((minimum-a)/(b-a),(maximum-a)/(b-a)))
    lo=max(0.,lo);hi=min(1.,hi)
    return (lo,hi) if lo<=hi else None


def segment_collides(a,b,obstacle,padding):
    x=interval_hit(a['x'],b['x'],obstacle['x']-obstacle['width']/2-padding,obstacle['x']+obstacle['width']/2+padding)
    z=interval_hit(a['z'],b['z'],obstacle['z']-obstacle['depth']/2-padding,obstacle['z']+obstacle['depth']/2+padding)
    return x is not None and z is not None and max(x[0],z[0])<=min(x[1],z[1])


def verify_scene(scene):
    if scene.get('schema_version')!=1 or scene.get('length_unit')!='cm':raise ValueError('Expected centimeter scene v1')
    if scene.get('source_kind') not in ('synthetic_example','manual_top_down_annotations'):raise ValueError('Missing provenance')
    if scene.get('data')!=('synthetic' if scene['source_kind']=='synthetic_example' else 'manual_annotations'):raise ValueError('Inconsistent provenance')
    d=scene['desk_dimensions'];r=scene['car_radius'];margin=scene['route_margin'];gate=scene['checkpoint_radius']
    if not all(type(v) in (int,float) and math.isfinite(v) and v>0 for v in (d['width'],d['depth'],r,margin,gate)):raise ValueError('Invalid scene dimensions')
    obstacles=scene['obstacles'];route=scene['route'];checkpoints=scene['checkpoints']
    if len(checkpoints)!=6 or len(route)<7 or route[0]!=route[-1]:raise ValueError('Closed route with six gates required')
    if len({(c['x'],c['z']) for c in checkpoints})!=6:raise ValueError('Duplicate checkpoint position')
    if len({o['id'] for o in obstacles})!=len(obstacles):raise ValueError('Duplicate obstacle ID')
    for o in obstacles:
        if not all(type(o[k]) in (int,float) and math.isfinite(o[k]) for k in ('x','z','width','depth','height')) or min(o['width'],o['depth'],o['height'])<=0:raise ValueError('Invalid obstacle')
        if abs(o['x'])+o['width']/2>d['width']/2 or abs(o['z'])+o['depth']/2>d['depth']/2:raise ValueError('Obstacle outside tabletop')
    for p in route:
        if not all(type(p[k]) in (int,float) and math.isfinite(p[k]) for k in ('x','z')):raise ValueError('Invalid waypoint')
        if abs(p['x'])+r+margin>d['width']/2 or abs(p['z'])+r+margin>d['depth']/2:raise ValueError('Route leaves guarded tabletop')
    for a,b in zip(route,route[1:]):
        if a==b or any(segment_collides(a,b,o,r+margin) for o in obstacles):raise ValueError('Blocked route segment')
    for i,cp in enumerate(checkpoints):
        if type(cp['index']) is not int or cp['index']!=i or not all(type(cp[k]) in (int,float) and math.isfinite(cp[k]) for k in ('x','z')):raise ValueError('Invalid gate')
        if not any(p=={'x':cp['x'],'z':cp['z']} for p in route):raise ValueError('Gate missing from route')
        other=checkpoints[(i+1)%6]
        if math.hypot(cp['x']-other['x'],cp['z']-other['z'])<15:raise ValueError('Gates too close')
        if abs(cp['x'])+r+gate>d['width']/2 or abs(cp['z'])+r+gate>d['depth']/2:raise ValueError('Gate outside tabletop')
        if any(segment_collides(cp,cp,o,r+gate) for o in obstacles):raise ValueError('Gate target disk overlaps a car-expanded obstacle')
    ends=scene['section_ends']
    if len(ends)!=6 or ends!=sorted(set(ends)) or ends[-1]!=len(route)-1:raise ValueError('Invalid route sections')
    for i,end in enumerate(ends):
        cp=checkpoints[(i+1)%6]
        if route[end]!={'x':cp['x'],'z':cp['z']}:raise ValueError('Section ends at the wrong gate')
    return {'status':'pass','waypoints':len(route),'gates':6,'length_cm':sum(math.hypot(b['x']-a['x'],b['z']-a['z']) for a,b in zip(route,route[1:])),
            'checks':['finite geometry','obstacle and car-envelope boundaries','every expanded route segment','complete gate disks','ordered closed route'],
            'scope':'conservative nominal-centimeter arcade geometry, not photo reconstruction or physical vehicle validation'}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--scene',type=Path,default=Path('desk_scene.json'));parser.add_argument('--report',type=Path,default=Path('reports/route.json'));args=parser.parse_args()
    args.report.parent.mkdir(parents=True,exist_ok=True)
    try:
        scene=json.loads(args.scene.read_bytes());result=verify_scene(scene)
        result['scene_canonical_sha256']=hashlib.sha256(json.dumps(scene,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
        args.report.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
    except Exception as error:
        args.report.write_text(json.dumps({'status':'failed','error':str(error)},indent=2)+'\n');raise


if __name__=='__main__':main()
