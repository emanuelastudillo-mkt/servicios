'use client';
import { useEffect, useState } from 'react';
import { CITIES, city } from '@/lib/catalog';

type Props = { hub: string; destinations: string[]; selected: string; onSelect: (id: string) => void };
const project = (lon: number, lat: number) => [(lon + 180) * 3, (82 - lat) * 3];
export function WorldMap({ hub, destinations, selected, onSelect }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  const [mapError, setMapError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(new URL('./world.geojson', document.baseURI)).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => {
      const geo = data as { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
      const shapes: string[] = [];
      for (const f of geo.features) {
        const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
        for (const rings of polys) shapes.push(rings.map((ring: number[][]) => ring.map(([lon,lat], i) => `${i ? 'L' : 'M'}${project(lon,lat).map(n=>n.toFixed(1)).join(',')}`).join(' ') + 'Z').join(' '));
      }
      if (active) setPaths(shapes);
    }).catch(() => { if (active) setMapError(true); });
    return () => { active = false; };
  }, []);
  const origin = city(hub);
  const [ox, oy] = project(origin.lon, origin.lat);
  return <div className="world-map"><div className="map-caption"><span className="live-dot"/> RED GLOBAL <span className="map-caption-secondary">20 aeropuertos · 6 continentes</span></div>
    <svg viewBox="0 0 1080 480" role="img" aria-label="Mapa mundial de aeropuertos. Elegí un destino para planificar una ruta.">
      <defs><pattern id="grid" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M 54 0 L 0 0 0 54" fill="none" stroke="#263c4d" strokeWidth="0.6"/></pattern><radialGradient id="ocean"><stop stopColor="#172f42"/><stop offset="1" stopColor="#0d1f2d"/></radialGradient></defs>
      <rect width="1080" height="480" fill="url(#ocean)"/><rect width="1080" height="480" fill="url(#grid)"/>
      <g fill="#293f4d" stroke="#3b5361" strokeWidth="0.6" fillRule="evenodd">{paths.map((d,i)=><path key={i} d={d}/>)}</g>
      {[...new Set([...destinations, selected])].filter(id => id !== hub).map(id => {
        const c = city(id); if (!c) return null;
        let [x,y] = project(c.lon,c.lat); if (Math.abs(x-ox)>540) x += x>ox ? -1080 : 1080;
        const d = `M${ox},${oy} Q${(ox+x)/2},${Math.min(oy,y)-Math.abs(ox-x)*.18-22} ${x},${y}`;
        return <g key={id}>{[-1080,0,1080].map(shift=><path key={shift} transform={`translate(${shift},0)`} d={d} fill="none" stroke={id===selected?'#b6f178':'#6ad8bf'} strokeWidth={id===selected?2:1.6} strokeDasharray={destinations.includes(id)?undefined:'5 5'} opacity={id===selected?1:.65}/>)}</g>;
      })}
      {CITIES.map(c => { const [x,y] = project(c.lon,c.lat); const active = c.id===hub || destinations.includes(c.id); return <g key={c.id} className="airport" role="button" tabIndex={0} aria-label={`${c.name}, ${c.id}${c.id===hub?', base principal':''}`} onClick={()=>onSelect(c.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(c.id);}}} transform={`translate(${x},${y})`}>
        <circle r="13" fill="transparent"/><circle className="airport-halo" r={c.id===hub?13:8} fill={c.id===selected?'#b6f178':'#6ad8bf'} opacity={c.id===hub?.17:.08}/><circle r={c.id===hub?5:3.2} fill={c.id===selected?'#c8ff94':active?'#77e9c7':'#9badb7'} stroke="#132938" strokeWidth="1.5"/>
        {(active || c.id===selected || ['JFK','MAD','DXB','HND','SYD','LAX','SIN','JNB'].includes(c.id)) && <text x="9" y={c.id==='SCL'?15:-9} fill={active?'#d9eee7':'#a7bac7'} fontSize="11" fontFamily="monospace" fontWeight={active?700:400}>{c.id===hub?`${c.id} · BASE`:c.id}</text>}<title>{`${c.name} · ${c.country}`}</title>
      </g>;})}
      <text x="530" y="215" className="ocean-label">ATLÁNTICO</text><text x="130" y="290" className="ocean-label">PACÍFICO</text><text x="770" y="350" className="ocean-label">ÍNDICO</text>
    </svg>
    <div className="map-footer"><span><i/> Tus rutas <i className="dashed"/> Destino seleccionado</span><span>{mapError?'Cartografía no disponible · los aeropuertos siguen activos':'Elegí un aeropuerto en el mapa'} <span aria-hidden="true">↗</span></span></div>
  </div>;
}
