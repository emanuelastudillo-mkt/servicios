export type City = { id: string; name: string; country: string; lat: number; lon: number; demand: number; fee: number };
export const CITIES: City[] = [
  { id: 'EZE', name: 'Buenos Aires', country: 'Argentina', lat: -34.82, lon: -58.54, demand: 1.2, fee: 850 },
  { id: 'SCL', name: 'Santiago', country: 'Chile', lat: -33.39, lon: -70.79, demand: 1.05, fee: 750 },
  { id: 'GRU', name: 'São Paulo', country: 'Brasil', lat: -23.44, lon: -46.47, demand: 1.55, fee: 1100 },
  { id: 'LIM', name: 'Lima', country: 'Perú', lat: -12.02, lon: -77.11, demand: 1.05, fee: 680 },
  { id: 'BOG', name: 'Bogotá', country: 'Colombia', lat: 4.70, lon: -74.15, demand: 1.15, fee: 800 },
  { id: 'MEX', name: 'Ciudad de México', country: 'México', lat: 19.44, lon: -99.07, demand: 1.5, fee: 1200 },
  { id: 'MIA', name: 'Miami', country: 'Estados Unidos', lat: 25.80, lon: -80.29, demand: 1.55, fee: 1600 },
  { id: 'JFK', name: 'Nueva York', country: 'Estados Unidos', lat: 40.64, lon: -73.78, demand: 1.85, fee: 2100 },
  { id: 'LAX', name: 'Los Ángeles', country: 'Estados Unidos', lat: 33.94, lon: -118.41, demand: 1.6, fee: 1800 },
  { id: 'MAD', name: 'Madrid', country: 'España', lat: 40.47, lon: -3.57, demand: 1.6, fee: 1400 },
  { id: 'LHR', name: 'Londres', country: 'Reino Unido', lat: 51.47, lon: -0.45, demand: 1.9, fee: 2400 },
  { id: 'CDG', name: 'París', country: 'Francia', lat: 49.00, lon: 2.55, demand: 1.7, fee: 1900 },
  { id: 'FCO', name: 'Roma', country: 'Italia', lat: 41.80, lon: 12.25, demand: 1.3, fee: 1300 },
  { id: 'DXB', name: 'Dubái', country: 'Emiratos Árabes Unidos', lat: 25.25, lon: 55.36, demand: 1.8, fee: 1900 },
  { id: 'JNB', name: 'Johannesburgo', country: 'Sudáfrica', lat: -26.14, lon: 28.25, demand: 1.1, fee: 950 },
  { id: 'DEL', name: 'Nueva Delhi', country: 'India', lat: 28.56, lon: 77.10, demand: 1.6, fee: 1100 },
  { id: 'SIN', name: 'Singapur', country: 'Singapur', lat: 1.36, lon: 103.99, demand: 1.7, fee: 1800 },
  { id: 'HND', name: 'Tokio', country: 'Japón', lat: 35.55, lon: 139.78, demand: 1.8, fee: 2000 },
  { id: 'ICN', name: 'Seúl', country: 'Corea del Sur', lat: 37.46, lon: 126.44, demand: 1.5, fee: 1500 },
  { id: 'SYD', name: 'Sídney', country: 'Australia', lat: -33.94, lon: 151.18, demand: 1.4, fee: 1800 },
];
export const AIRCRAFT = [
  { id: 'e195', name: 'Embraer E195-E2', family: 'Regional', seats: 132, range: 4800, price: 38e6, fuel: 1750, speed: 820, maintenance: 290000, description: 'Menos asientos. Más oportunidades regionales.' },
  { id: 'a320', name: 'Airbus A320neo', family: 'Medio alcance', seats: 180, range: 6300, price: 57e6, fuel: 2400, speed: 840, maintenance: 390000, description: 'El equilibrio entre capacidad y eficiencia.' },
  { id: 'a321', name: 'Airbus A321XLR', family: 'Largo alcance', seats: 206, range: 8700, price: 76e6, fuel: 2750, speed: 840, maintenance: 490000, description: 'Cruza océanos con un avión de pasillo único.' },
  { id: 'b789', name: 'Boeing 787-9', family: 'Intercontinental', seats: 290, range: 14000, price: 138e6, fuel: 5100, speed: 900, maintenance: 800000, description: 'Tu próximo salto a las grandes rutas del mundo.' },
] as const;
export const EVENTS = [
  { title: 'Un horizonte estable', text: 'El mercado abre el año sin alteraciones. Es un buen momento para consolidar tu red.', demand: 1, fuel: 1 },
  { title: 'Escapadas en alza', text: 'El turismo impulsa las reservas. La demanda crece un 12% este trimestre.', demand: 1.12, fuel: 1 },
  { title: 'Presión sobre el combustible', text: 'La energía se encarece. El costo del combustible sube un 18% este trimestre.', demand: 1, fuel: 1.18 },
  { title: 'Competencia de tarifas', text: 'Una campaña de descuentos reduce la demanda disponible un 10% este trimestre.', demand: 0.9, fuel: 1 },
  { title: 'Más viajes corporativos', text: 'Las empresas vuelven a viajar. La demanda aumenta un 8% este trimestre.', demand: 1.08, fuel: 1.03 },
  { title: 'Alivio energético', text: 'El combustible baja un 12% este trimestre. Una oportunidad para mejorar márgenes.', demand: 1, fuel: 0.88 },
];
export const city = (id: string) => CITIES.find(c => c.id === id)!;
export const aircraft = (id: string) => AIRCRAFT.find(a => a.id === id)!;
