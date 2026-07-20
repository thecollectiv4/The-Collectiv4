/* =========================================================================
   LOS MUNDOS DE LA CASA — los ids de las personas REALES que aparecen
   citadas dentro de datos escritos a mano (lineups viejos, artistas
   destacados, la firma de los fundadores).

   ─── LA REGLA PERMANENTE (decisión de Diego, jul 2026) ────────────────────

       Nombre CON perfil real  →  es PUERTA a su perfil.
       Nombre SIN perfil real  →  es TEXTO NORMAL. Punto.

   Nada de perfiles placeholder, nada de tarjetas "reclama tu mundo", nada
   de mecanismo de claim. Si la persona no existe en la plataforma, su
   nombre no lleva a ningún lado y ya. Es lo honesto y además cierra de raíz
   el hoyo de suplantación: no se puede reclamar lo que no existe.

   ─── POR QUÉ ESTE ARCHIVO EXISTE ──────────────────────────────────────────

   Los datos viejos citan a la gente por NOMBRE ARTÍSTICO, y el nombre
   artístico casi nunca coincide con lo que dice el perfil:

     · "MADOU"            → el perfil dice full_name "Nate", username NULL
     · "Diego Villaseñor" → el perfil dice full_name "diego", user diegovill__
     · "Pato Durán"       → el perfil dice full_name "Pato Duran" (sin acento)

   O sea: no hay UNA llave de texto que sirva parejo. Nate no tiene username;
   el apellido de Diego no está en su perfil. El único identificador uniforme
   es el id. Vive AQUÍ y no regado en cinco archivos para que se actualice en
   un solo lugar.

   DEGRADA HONESTO: si un id deja de resolver (perfil borrado, purgado, o
   marcado is_demo), resolveLineupWorlds no devuelve nada y el nombre se
   vuelve texto normal — que es exactamente la regla de arriba. El sistema
   cae del lado correcto solo.

   NO es un registro de gente: son tres ids de personas que YA existen y ya
   están verificadas. Nadie se agrega aquí sin tener perfil real primero.
   ========================================================================= */

/* Verificados en la DB (verified=true, is_demo=false, deleted_at null). */
export const PATO = 'c255c33b-60d5-4e53-a81a-2f89d7f5ad1b'   // full_name "Pato Duran" · @patoduranc
export const DIEGO = 'ec009f34-14c7-430c-b527-900d5a88ba70'  // full_name "diego" · @diegovill__
export const NATE = '6b6b56e2-8d8c-44e2-88e5-242383a263bf'   // full_name "Nate" · toca en lineup como MADOU

/* Los dos fundadores, en el orden en que firman. El texto vivía como string
   literal duplicado en Events.jsx y HouseWorld.jsx — dos copias que ya
   habían que mantener a mano. */
export const FOUNDERS = [
  { id: PATO, name: 'Pato Durán' },
  { id: DIEGO, name: 'Diego Villaseñor' },
]
