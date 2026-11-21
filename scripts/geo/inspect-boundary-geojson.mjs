#!/usr/bin/env node
/** Inspect authoritative downloaded GeoJSON before a human territory review.
 * This tool never writes to the database or approves a polygon. No guesses,
 * network calls, geometry clipping/simplification or fake territory records.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const codeKeys=['LAD26CD','LAD25CD','LAD24CD','LAD23CD','LADCD','code','Code','GSS_CODE'];
const nameKeys=['LAD26NM','LAD25NM','LAD24NM','LAD23NM','LADNM','name','Name'];
function value(properties,keys){for(const key of keys)if(typeof properties?.[key]==='string'&&properties[key].trim())return properties[key].trim();return null;}
function finiteWgs84(point){
 return Array.isArray(point)&&point.length>=2&&
  typeof point[0]==='number'&&typeof point[1]==='number'&&
  Number.isFinite(point[0])&&Number.isFinite(point[1])&&
  Math.abs(point[0])<=180&&Math.abs(point[1])<=90;
}
export function inspectOfficialGeoJSON(input,chosenCode=null){
 if(!input||input.type!=='FeatureCollection'||!Array.isArray(input.features))throw Error('Expected an official GeoJSON FeatureCollection');
 const choices=input.features.map((feature,i)=>({
  index:i,code:value(feature?.properties,codeKeys),name:value(feature?.properties,nameKeys),
  geometryType:feature?.geometry?.type||null
 }));
 const selected=chosenCode?choices.filter(x=>x.code===chosenCode):[];
 if(!chosenCode)return {status:'SELECT_OFFICIAL_GEOGRAPHY_CODE',choices,approved:false};
 if(selected.length!==1)throw Error('Expected one unambiguous official feature code; found '+selected.length);
 const {index,code,name}=selected[0],geometry=input.features[index].geometry;
 const reasons=[];
 if(geometry?.type!=='Polygon')reasons.push('Complex/multipart geometry requires independent GIS review');
 const rings=geometry?.type==='Polygon'?geometry.coordinates:[];
 if(!Array.isArray(rings)||rings.length!==1)reasons.push('Polygon holes and multipart territory are not supported by the current 30-vertex admin input');
 const ring=Array.isArray(rings?.[0])?rings[0]:[];
 if(ring.length<4||!ring.every(finiteWgs84))reasons.push('Invalid or non-WGS84 longitude/latitude coordinates');
 const closed=ring.length>2&&ring[0][0]===ring[ring.length-1][0]&&ring[0][1]===ring[ring.length-1][1];
 if(!closed)reasons.push('GeoJSON exterior ring is not closed');
 const vertices=closed?ring.slice(0,-1):ring;
 if(vertices.length<3||vertices.length>30)reasons.push('Current PostgreSQL polygon intake supports 3–30 unique surveyed vertices; DO NOT truncate an authoritative outline');
 if(new Set(vertices.map(v=>v[0]+','+v[1])).size!==vertices.length)reasons.push('Repeated boundary vertices require independent GIS review');
 if(vertices.some(v=>Array.isArray(v)&&v.length>2))reasons.push('Extra dimensions require review before longitude/latitude conversion');
 return {
  status:reasons.length?'MANUAL_GIS_REVIEW_REQUIRED':'GEOMETRY_READY_FOR_HUMAN_REVIEW',
  approved:false,officialCode:code,officialName:name,
  geometryType:geometry?.type||null,ringCount:Array.isArray(rings)?rings.length:null,
  inputVertexCount:ring.length,unclosedVertexCount:vertices.length,
  reasons,
  // Only supply a reviewed-order preview for small single rings. This output
  // is NOT a TrustFive approval and must not be auto-imported into staging.
  reviewVertices:reasons.length?null:vertices.map(v=>v[0]+','+v[1]).join('\n')
 };
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const [file,code]=process.argv.slice(2);
 if(!file){
  process.stderr.write('Usage: node scripts/geo/inspect-boundary-geojson.mjs ./official.geojson [official-LAD-code]\n');
  process.exit(2);
 }
 try{
  const bytes=readFileSync(file);
  const report=inspectOfficialGeoJSON(JSON.parse(bytes.toString('utf8')),code||null);
  process.stdout.write(JSON.stringify({
   sourceSha256:createHash('sha256').update(bytes).digest('hex'),
   reviewOnly:true,...report
  },null,2)+'\n');
  if(report.status==='MANUAL_GIS_REVIEW_REQUIRED')process.exitCode=3;
 }catch(error){process.stderr.write('Boundary inspection failed: '+error.message+'\n');process.exitCode=2;}
}
