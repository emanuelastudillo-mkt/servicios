ARCHIVOS PARA GITHUB PAGES

Subí estos 2 archivos en la raíz del repositorio:

1) index.html
2) data.json

El dashboard ya no lee Google Sheets en vivo. Lee data.json, por eso la carga es inmediata.

Estructura mínima de data.json:

{
  "updatedAt": "2026-06-11T00:00:00-03:00",
  "services": [
    {
      "id": "gestion-meta-ads",
      "title": "Gestión Meta Ads",
      "description": "Descripción breve",
      "category": "Publicidad",
      "costo": 30000,
      "presupuestoMinimo": 70000,
      "presupuestoMaximo": 150000,
      "kind": "normal"
    },
    {
      "id": "auditoria",
      "title": "Auditoría",
      "costo": 25000,
      "presupuestoMinimo": 0,
      "presupuestoMaximo": 0,
      "kind": "auditoria"
    },
    {
      "id": "dashboard",
      "title": "Dashboard",
      "costo": 0,
      "presupuestoMinimo": 0,
      "presupuestoMaximo": 0,
      "kind": "dashboard"
    }
  ],
  "codes": [
    { "code": "PROMO10", "type": "percent", "value": 10, "active": true },
    { "code": "DESCUENTO5000", "type": "fixed", "value": 5000, "active": true }
  ]
}

Notas:
- Auditoría se bonifica con 1 servicio pago.
- Dashboard se bonifica con 2 servicios pagos.
- El precio tachado de Auditoría sale del campo costo en data.json.
- El campo presupuestoMinimo se suma para calcular Inversión mínima en Meta.
- Los descuentos se aplican solo sobre el costo de servicios, no sobre inversión en Meta.
