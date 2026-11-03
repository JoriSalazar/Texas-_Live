# TEXAS/LIVE · Election Desk 2026

Un tablero en español para seguir la elección del 3 de noviembre de 2026 en Texas.

## Uso rápido

1. Abre `index.html` en Chrome, Edge o Firefox (con conexión a internet). O abre el archivo autónomo `texas_live_2026.html`.
2. Pulsa «Actualizar ahora» si quieres consultar inmediatamente.
3. Se intentan recuperar datos oficiales de la Secretaría de Estado y titulares mediante Google News RSS utilizando intermediarios públicos; algunos navegadores o proveedores bloquean estas solicitudes por CORS. **Si una fuente falla, no se muestran cifras simuladas.**
4. Para seguimiento más fiable, despliega `worker.js` como un **Cloudflare Worker** (cuenta gratuita de Cloudflare). Dentro del panel, haz clic en ⚙ y pega la URL de tu Worker (`https://...workers.dev`). El Worker solo admite fuentes predeterminadas y no acepta URLs arbitrarias.

## Cuenta regresiva

- Muestra días, horas, minutos y segundos hasta las **7:00 p. m. CST del 3 de noviembre de 2026**, cierre en la mayor parte de Texas y momento desde el cual pueden comenzar a informarse resultados.
- El Paso y Hudspeth cierran a las **8:00 p. m. hora de Houston**. La primera cifra no tiene hora exacta garantizada.
- Una vez alcanzado el horario, la cuenta regresa a cero y cambia automáticamente a un mensaje de conteo en curso. Funciona aun si falla el feed de noticias o resultados.

## Datos mostrados

- **Senado federal:** James Talarico (D) vs Ken Paxton (R).
- **Gobernación:** Gina Hinojosa (D) vs Greg Abbott (R).
- **Otros cargos:** Vicegobernación y Fiscalía General.
- **Legislatura:** la composición **previa** al día de la elección (88 R/62 D Cámara; 20 R/11 D Senado); botones para consultar los distritos en la cobertura AP/Texas Tribune y en el sitio oficial. **No se presentan esos valores como resultados actuales.**
- **Noticias:** titulares atribuidos exclusivamente a fuentes periodísticas de una lista de medios conocidos, ordenados por publicación, con enlace a la noticia original o a su enlace de Google News.

El sitio no recibe un feed de proyecciones de AP: el liderazgo en votos no equivale a ganar una elección. Los resultados de la Secretaría de Estado son **no oficiales** hasta su certificación.

## Archivos

- `index.html`: interfaz.
- `styles.css`: diseño responsive.
- `app.js`: consultas, procesamiento y actualización automática cada 90 segundos.
- `worker.js`: proxy opcional desplegable en Cloudflare Workers.

## Fuentes verificadas

- Secretaría de Estado de Texas: https://electionresults.sos.state.tx.us/results.html
- The Texas Tribune / AP: https://apps.texastribune.org/features/2026/texas-general-election-live-results-2026/
- Houston Chronicle: https://www.houstonchronicle.com/projects/2026/texas-election-results/
- Texas Public Radio: https://www.tpr.org/2026-10-29/midterm-election-results-south-texas-races

Sitio informativo independiente, no afiliado a la Secretaría de Estado, AP ni medios.
