"""Map supplied top-down annotations to a nominal-centimeter arcade scene.

No vision model, photo inference, or metric perspective reconstruction is used.
"""
import argparse
import hashlib
import heapq
import json
import math
from pathlib import Path

CATALOG={'monitor':(36,'34434b'),'keyboard':(3.2,'46534e'),'mouse':(3.5,'8d9991'),
         'mug':(11.5,'c27250'),'books':(9,'7f96a0'),'lamp':(32,'d0ba79'),'controller':(3.8,'56795d')}


def finite(value): return type(value) in (int,float) and math.isfinite(value)


def segment_box(a,b,box,padding):
    """Inclusive line/slab intersection with an expanded axis-aligned footprint."""
    lower=0.;upper=1.
    for axis,size in (('x','width'),('z','depth')):
        minimum=box[axis]-box[size]/2-padding;maximum=box[axis]+box[size]/2+padding
        delta=b[axis]-a[axis]
        if abs(delta)<1e-12:
            if not minimum<=a[axis]<=maximum:return False
        else:
            t1=(minimum-a[axis])/delta;t2=(maximum-a[axis])/delta
            lower=max(lower,min(t1,t2));upper=min(upper,max(t1,t2))
            if lower>upper:return False
    return True


def clear(a,b,scene,padding):
    desk=scene['desk_dimensions']
    if any(abs(p['x'])>desk['width']/2-padding or abs(p['z'])>desk['depth']/2-padding for p in (a,b)):return False
    return not any(segment_box(a,b,o,padding) for o in scene['obstacles'])


def nearest(anchor,scene,padding):
    w=scene['desk_dimensions']['width'];d=scene['desk_dimensions']['depth']
    cells=[{'x':x,'z':z} for x in range(math.ceil(-w/2+padding),math.floor(w/2-padding)+1)
           for z in range(math.ceil(-d/2+padding),math.floor(d/2-padding)+1)]
    cells.sort(key=lambda p:((p['x']-anchor[0])**2+(p['z']-anchor[1])**2,p['x'],p['z']))
    for point in cells:
        if clear(point,point,scene,padding):return point
    raise ValueError('No free checkpoint cell with the requested clearance')


def route_between(start,end,scene,padding):
    origin=(start['x'],start['z']);goal=(end['x'],end['z'])
    queue=[(0.,0.,origin)];cost={origin:0.};previous={}
    while queue:
        _,g,current=heapq.heappop(queue)
        if g>cost[current]+1e-9:continue
        if current==goal:
            path=[goal]
            while path[-1]!=origin:path.append(previous[path[-1]])
            path.reverse()
            # Remove redundant collinear cells without bending through obstacles.
            result=[]
            for point in path:
                while len(result)>=2 and ((result[-1][0]-result[-2][0])*(point[1]-result[-1][1])
                      ==(result[-1][1]-result[-2][1])*(point[0]-result[-1][0])):result.pop()
                result.append(point)
            return [{'x':x,'z':z} for x,z in result]
        for dx,dz in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
            point=(current[0]+dx,current[1]+dz)
            a={'x':current[0],'z':current[1]};b={'x':point[0],'z':point[1]}
            if not clear(a,b,scene,padding):continue
            candidate=g+math.hypot(dx,dz)
            if candidate+1e-9<cost.get(point,math.inf):
                cost[point]=candidate;previous[point]=current
                heapq.heappush(queue,(candidate+math.dist(point,goal),candidate,point))
    raise ValueError('No complete route connects the checkpoints at this car clearance')


def map_scene(source,desk_width_cm=160.,desk_depth_cm=100.):
    if not isinstance(source,dict):raise ValueError('Annotation document must be an object')
    if source.get('source_kind') not in ('synthetic_example','manual_top_down_annotations'):
        raise ValueError('Explicit annotation provenance is required')
    if any(not finite(v) or not 80<=v<=300 for v in (desk_width_cm,desk_depth_cm)):
        raise ValueError('Nominal desk dimensions must be finite and 80..300 cm')
    detections=source.get('detections')
    if not isinstance(detections,list) or not 1<=len(detections)<=24:raise ValueError('Expected 1..24 annotated objects')
    obstacles=[]
    for index,item in enumerate(detections):
        if not isinstance(item,dict):raise ValueError('Each annotation must be an object')
        label=item.get('label');box=item.get('box_2d')
        if label not in CATALOG or not isinstance(box,list) or len(box)!=4 or not all(finite(v) for v in box):raise ValueError('Invalid annotated box or category')
        ymin,xmin,ymax,xmax=box
        if not 0<=xmin<xmax<=1000 or not 0<=ymin<ymax<=1000:raise ValueError('Boxes must be ordered inside 0..1000')
        height,color=CATALOG[label]
        obstacles.append({'id':f'{label}_{index}','category':label,'x':((xmin+xmax)/2000-.5)*desk_width_cm,
                          'z':((ymin+ymax)/2000-.5)*desk_depth_cm,'width':(xmax-xmin)/1000*desk_width_cm,
                          'depth':(ymax-ymin)/1000*desk_depth_cm,'height':height,'color_hex':color})
    scene={'schema_version':1,'length_unit':'cm','data':'synthetic' if source['source_kind']=='synthetic_example' else 'manual_annotations',
           'source_kind':source['source_kind'],'projection_assumption':source.get('projection_assumption','top-down approximation'),
           'desk_dimensions':{'width':desk_width_cm,'depth':desk_depth_cm},'car_radius':4.5,'route_margin':1.,
           'obstacles':obstacles,'checkpoint_radius':2.2}
    anchors=[(-.41*desk_width_cm,.36*desk_depth_cm),(-.41*desk_width_cm,-.32*desk_depth_cm),
             (0,-.20*desk_depth_cm),(.43*desk_width_cm,-.32*desk_depth_cm),
             (.41*desk_width_cm,.34*desk_depth_cm),(0,.38*desk_depth_cm)]
    checkpoints=[nearest(anchor,scene,scene['car_radius']+scene['checkpoint_radius']) for anchor in anchors]
    if len({(c['x'],c['z']) for c in checkpoints})!=6:raise ValueError('Distinct checkpoints could not be placed')
    if any(math.hypot(a['x']-b['x'],a['z']-b['z'])<15 for a,b in zip(checkpoints,checkpoints[1:]+checkpoints[:1])):
        raise ValueError('Checkpoints need at least 15 nominal cm of separation')
    scene['checkpoints']=[{'index':i,**p} for i,p in enumerate(checkpoints)]
    route=[];ends=[]
    for i in range(6):
        section=route_between(checkpoints[i],checkpoints[(i+1)%6],scene,scene['car_radius']+scene['route_margin'])
        if route:section=section[1:]
        route.extend(section);ends.append(len(route)-1)
    scene['route']=route;scene['section_ends']=ends
    scene['annotations_sha256']=hashlib.sha256(json.dumps(source,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return scene


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,default=Path(__file__).parent/'examples/detections.json')
    parser.add_argument('--output',type=Path,default=Path(__file__).parent/'desk_scene.json')
    args=parser.parse_args();scene=map_scene(json.loads(args.input.read_text(encoding='utf-8')))
    if args.input.resolve()==args.output.resolve():parser.error('Input annotations and output scene must differ')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(scene,indent=2,allow_nan=False)+'\n',encoding='utf-8',newline='\n')
    print(f"Generated {len(scene['obstacles'])} objects and {len(scene['route'])} verified-clear route waypoints")


if __name__=='__main__':main()
