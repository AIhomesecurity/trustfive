import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOfficialGeoJSON} from '../../scripts/geo/inspect-boundary-geojson.mjs';

const feature=(coords,code='E08000001',type='Polygon')=>({
 type:'Feature',properties:{LAD26CD:code,LAD26NM:'Official fixture district'},
 geometry:{type,coordinates:coords}
});
const collection=(...features)=>({type:'FeatureCollection',features});

test('Unselected official district never becomes approved and lists source codes',()=>{
 const data=collection(feature([[[0,51],[0.01,51],[0,51.01],[0,51]]]));
 const result=inspectOfficialGeoJSON(data);
 assert.equal(result.status,'SELECT_OFFICIAL_GEOGRAPHY_CODE');
 assert.equal(result.approved,false);
 assert.equal(result.choices[0].code,'E08000001');
});
test('Small valid WGS84 official ring yields review-only coordinates, never auto approval',()=>{
 const data=collection(feature([[[0,51],[0.01,51],[0,51.01],[0,51]]]));
 const report=inspectOfficialGeoJSON(data,'E08000001');
 assert.equal(report.status,'GEOMETRY_READY_FOR_HUMAN_REVIEW');
 assert.equal(report.approved,false);
 assert.equal(report.unclosedVertexCount,3);
 assert.equal(report.reviewVertices,'0,51\n0.01,51\n0,51.01');
});
test('Ambiguous or missing GSS code is rejected',()=>{
 const ring=[[[0,51],[0.01,51],[0,51.01],[0,51]]];
 assert.throws(()=>inspectOfficialGeoJSON(collection(feature(ring),feature(ring)),'E08000001'),/one unambiguous/);
 assert.throws(()=>inspectOfficialGeoJSON(collection(feature(ring)),'E08000002'),/one unambiguous/);
});
test('Complex multi-part, holes, non-WGS84 and high-detail council boundaries require GIS review',()=>{
 const basic=[[0,51],[0.01,51],[0,51.01],[0,51]];
 const multi=inspectOfficialGeoJSON(collection(feature([[basic]],'E08000002','MultiPolygon')),'E08000002');
 assert.equal(multi.status,'MANUAL_GIS_REVIEW_REQUIRED');
 assert.equal(multi.reviewVertices,null);
 const holes=inspectOfficialGeoJSON(collection(feature([basic,basic])),'E08000001');
 assert.equal(holes.status,'MANUAL_GIS_REVIEW_REQUIRED');
 const detail=Array.from({length:31},(_,i)=>[i/1000,51+i/100000]);
 detail.push(detail[0]);
 const tooMany=inspectOfficialGeoJSON(collection(feature([detail])),'E08000001');
 assert.equal(tooMany.status,'MANUAL_GIS_REVIEW_REQUIRED');
 assert.equal(tooMany.reviewVertices,null);
 const projected=inspectOfficialGeoJSON(collection(feature([[[530000,180000],[530001,180000],[530000,180001],[530000,180000]]])),'E08000001');
 assert.equal(projected.status,'MANUAL_GIS_REVIEW_REQUIRED');
});
test('Malformed null vertices fail closed without throwing or leaking invented coordinates',()=>{
 const r=inspectOfficialGeoJSON(collection(feature([[[0,51],null,[0,51.01],[0,51]]])),'E08000001');
 assert.equal(r.status,'MANUAL_GIS_REVIEW_REQUIRED');
 assert.equal(r.reviewVertices,null);
});
