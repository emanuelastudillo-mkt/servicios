# Satellite and elevation data

Satellite imagery: **Sentinel-2 cloudless – https://s2maps.eu by EOX IT Services GmbH
(Contains modified Copernicus Sentinel data 2016 & 2017)**.

The 2016 edition is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
See [EOX Maps](https://maps.eox.at/) and
[EOX's edition-specific licensing](https://www.eox.at/2025/03/sentinel-2-cloudless-2024/).
Only the `s2cloudless` 2016 layer is used. Newer noncommercial editions are not used.
Changes: geographic crop, reprojection to the game's map bounds, WebP compression,
3D draping, lighting and vertical exaggeration. Imagery is historical, not live.

Elevation: [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/),
accessed 2026-10-08 from the public `elevation-tiles-prod` Terrarium archive.
See [MAPZEN-SOURCES.md](MAPZEN-SOURCES.md) for the upstream attribution and license
requirements (NASA SRTM, USGS, GMTED, ETOPO and regional providers).
Changes: bilinear resampling to a 257 × 257 grid, metre quantization, clamping
bathymetry to sea level in the display and vertical exaggeration.
The displayed heights are a visual geographic layer; race rules and simulated
altitudes continue to use the game data.

The route is a designed sporting course, not a navigable road network. Downloaded
data and their source URLs, bounds, resolution and hashes are recorded per circuit
in the accompanying JSON files. No tile provider is contacted while playing.

3D rendering: Three.js, MIT license, included in [THREE-LICENSE.txt](THREE-LICENSE.txt).
