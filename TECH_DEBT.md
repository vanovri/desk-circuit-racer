# desk-circuit-racer performance and technical debt

Crosschecked 2026-11-08 against the current working tree.

Reviewed 2026-11-08. These are proposals, not applied production changes. Line numbers refer to the reviewed working tree. No runtime speedup is claimed without measurement.

## 1. Avoid sorting every grid cell for each gate

Location: `desk_spatial_mapper.py:42-47`.

Six calls materialize and sort the same grid by a different anchor. The selection itself needs only a minimum. This proposal removes O(G log G) sorting and the grid list allocation, but evaluates clearance for all cells instead of stopping early after sorting. Benchmark it against a reusable free-cell cache before adoption. Keep coordinate tie-breaking unchanged.

Proposed change:

```diff
--- a/desk_spatial_mapper.py
+++ b/desk_spatial_mapper.py
@@ -39,11 +39,11 @@
 
 def nearest(anchor,scene,padding):
     w=scene['desk_dimensions']['width'];d=scene['desk_dimensions']['depth']
-    cells=[{'x':x,'z':z} for x in range(math.ceil(-w/2+padding),math.floor(w/2-padding)+1)
-           for z in range(math.ceil(-d/2+padding),math.floor(d/2-padding)+1)]
-    cells.sort(key=lambda p:((p['x']-anchor[0])**2+(p['z']-anchor[1])**2,p['x'],p['z']))
-    for point in cells:
-        if clear(point,point,scene,padding):return point
+    cells=({'x':x,'z':z} for x in range(math.ceil(-w/2+padding),math.floor(w/2-padding)+1)
+           for z in range(math.ceil(-d/2+padding),math.floor(d/2-padding)+1))
+    free=(point for point in cells if clear(point,point,scene,padding))
+    point=min(free,key=lambda p:((p['x']-anchor[0])**2+(p['z']-anchor[1])**2,p['x'],p['z']),default=None)
+    if point is not None:return point
     raise ValueError('No free checkpoint cell with the requested clearance')
 
 
```

Validation: Run nearest-cell oracle and mapping tests at 80, 160, and 300 cm with sparse and dense obstacles. Compare exact checkpoint coordinates and timings.

## 2. Validate route shape before deriving mutable state

Location: `web/engine.mjs:18-19`.

`web/app.mjs` loads JSON from an embedded block or fetch and immediately calls `createState`. Missing or non-finite route coordinates can produce exceptions or NaN state before a clear diagnostic. This entry-point check makes the route contract explicit. It should complement validation for checkpoints, dimensions, and obstacles rather than be treated as a complete scene validator.

Proposed change:

```diff
--- a/web/engine.mjs
+++ b/web/engine.mjs
@@ -15,6 +15,9 @@
 }
 function segmentDistance(a,b,p){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(a.x+t*dx-p.x,a.z+t*dz-p.z);}
 export function createState(scene){
+  if(!Array.isArray(scene?.route)||scene.route.length<2||
+     scene.route.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.z)))
+    throw new TypeError('Scene route requires at least two finite points');
   const start=scene.route[0],next=scene.route[1];
   return {x:start.x,z:start.z,angle:Math.atan2(next.z-start.z,next.x-start.x),speed:0,time:0,lapStart:0,lap:1,
     nextCheckpoint:1,bestLap:null,impacts:0,hit:null,contactUntil:0,active:false,guidedWaypoint:1};
```

Validation: Add malformed route tests for empty/one-point arrays, null points, booleans, and NaN. Existing valid guided-lap and frame-partition tests must remain unchanged.
