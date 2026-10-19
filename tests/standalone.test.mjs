import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync(new URL('../desk_racer.html',import.meta.url),'utf8');
test('standalone embeds exact scene, styles and scripts without external runtime assets',()=>{
  const match=html.match(/<script id="scene-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match);assert.deepEqual(JSON.parse(match[1]),JSON.parse(fs.readFileSync(new URL('../desk_scene.json',import.meta.url))));
  assert.ok(html.includes('<style>'));assert.equal(/<script[^>]+src=/.test(html),false);
  assert.equal(html.includes('type="importmap"'),false);assert.ok(html.includes('Three.js'));
});
test('embedded bundle parses as a normal script and license notices remain present',()=>{
  const script=html.match(/<script>([\s\S]*?)<\/script>/);assert.ok(script);new vm.Script(script[1]);
  assert.ok(html.includes('Permission is hereby granted'));
});
