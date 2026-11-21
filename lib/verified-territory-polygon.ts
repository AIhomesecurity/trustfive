/** Convert an independently surveyed review boundary into PostgreSQL polygon
 * input. Never calculate, infer or invent an administrative boundary from a
 * customer postcode, address or city name.
 *
 * Input format: one longitude,latitude pair per line, at least three distinct
 * vertices, maximum thirty. Do not repeat the first vertex to close the shape.
 */
type Point={lon:number;lat:number};
function cross(a:Point,b:Point,c:Point):number{
 return (b.lon-a.lon)*(c.lat-a.lat)-(b.lat-a.lat)*(c.lon-a.lon);
}
function onSegment(a:Point,b:Point,c:Point):boolean{
 return c.lon>=Math.min(a.lon,b.lon)-1e-10&&c.lon<=Math.max(a.lon,b.lon)+1e-10
  &&c.lat>=Math.min(a.lat,b.lat)-1e-10&&c.lat<=Math.max(a.lat,b.lat)+1e-10;
}
function intersects(a:Point,b:Point,c:Point,d:Point):boolean{
 const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
 if(x*y<0&&z*w<0)return true;
 const e=1e-12;
 return (Math.abs(x)<e&&onSegment(a,b,c))||(Math.abs(y)<e&&onSegment(a,b,d))
   ||(Math.abs(z)<e&&onSegment(c,d,a))||(Math.abs(w)<e&&onSegment(c,d,b));
}

export function verifiedTerritoryPolygon(raw:string):string{
 const rows=raw.trim().split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 if(rows.length<3||rows.length>30)throw Error('Provide 3–30 surveyed boundary vertices');
 const points:Point[]=rows.map((line,index)=>{
  if(!/^-?\d{1,3}(?:\.\d{1,8})?\s*,\s*-?\d{1,2}(?:\.\d{1,8})?$/.test(line))
   throw Error('Boundary point '+(index+1)+' must be longitude, latitude');
  const [lon,lat]=line.split(',').map(Number);
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90)
   throw Error('Boundary point '+(index+1)+' is outside world coordinate bounds');
  return {lon,lat};
 });
 const keys=new Set(points.map(p=>p.lon+','+p.lat));
 if(keys.size!==points.length)throw Error('Do not repeat boundary vertices or the closing point');
 // Shoelace area is a sanity check only, not a substitute for human evidence.
 const area=Math.abs(points.reduce((sum,a,i)=>{
  const b=points[(i+1)%points.length];return sum+a.lon*b.lat-b.lon*a.lat;
 },0))/2;
 if(area<1e-10)throw Error('Boundary vertices must enclose a nonzero area');
 // Reject self-intersecting polygons. The server will also reject overlapping
 // reviewed territory bounding boxes under a serialised advisory lock.
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  for(let j=i+1;j<points.length;j++){
   if(j===i+1||(i===0&&j===points.length-1))continue;
   const c=points[j],d=points[(j+1)%points.length];
   if(intersects(a,b,c,d))throw Error('Boundary crosses itself; review the vertex order');
  }
 }
 return '(('+points.map(p=>p.lon+','+p.lat).join('),(')+'))';
}
