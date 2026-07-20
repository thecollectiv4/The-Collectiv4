/* =========================================================================
   EL VOCABULARIO SOCIAL — una sola fuente para cómo se NOMBRA cada vínculo.

   ⚠️  ESTA ES UNA PROPUESTA, PENDIENTE DE APROBACIÓN DE DIEGO.
       Es llamada de producto, no de código. Este archivo existe para que
       cambiarla cueste UN archivo y no veinte: si Diego quiere otras
       palabras, se editan aquí abajo y toda la app las obedece. Nada más
       en el código escribe estas etiquetas a mano.

   ─── QUÉ HABÍA (auditado en la DB y en la UI, jul 2026) ───────────────────

   Dos relaciones reales en Postgres, CUATRO palabras encima:

   `follows`      (0017) — DIRECCIONAL. PK (follower_id, followee_id).
                  Sin aceptación: sigues y ya. RLS deja leer la arista a
                  terceros cuando AMBOS mundos son públicos (0034), así que
                  contarla y listarla en público es legítimo.

   `friendships`  (0023) — MUTUA. status pending → accepted, un solo renglón
                  por par. RLS: SÓLO los dos participantes la ven. La
                  migración lo dice con todas sus letras: "PRIVATE by
                  architecture… a friend list is nobody's directory".

   Y la UI las nombraba así:

     · "FOLLOW"     → botón en reposo            (follows)
     · "CONNECTED"  → el MISMO botón, ya activo  (follows)   ← colisión
     · "CONNECTED"  → el conteo de sus seguidores(follows)   ← colisión
     · "FOLLOWING"  → a cuántos sigue esa persona(follows)
     · "amigos"     → el vínculo mutuo           (friendships)

   Dos problemas, no uno:

   1. "CONNECTED" nombraba DOS cosas distintas a diez píxeles de distancia:
      mi estado direccional hacia ti, y tu número de seguidores. Con
      cualquier definición eso está mal — no hace falta decidir nada de
      producto para saberlo.
   2. La palabra que SUENA mutua ("connected") estaba puesta sobre la
      relación direccional, mientras la relación que SÍ es mutua se llamaba
      "amigos" — en español y en minúsculas, sola contra una UI en inglés.

   ─── LA PROPUESTA ─────────────────────────────────────────────────────────

   Cada palabra nombra UNA cosa, y la palabra que suena mutua se usa para lo
   que de verdad es mutuo:

     FOLLOWING  — tú sigues a alguien. Direccional, sin permiso, público.
     FOLLOWERS  — quién sigue a esa persona. Público.
     CONNECTED  — el vínculo MUTUO aceptado (lo que hoy es "amigos").
                  Se pide y se acepta. La lista es PRIVADA.

   Consecuencia deliberada: "CONNECTED" CAMBIA DE SIGNIFICADO respecto a lo
   que está hoy en pantalla. Hoy quiere decir "yo te sigo"; en la propuesta
   quiere decir "nos aceptamos". Es el corazón de la decisión de Diego, y por
   eso va marcado y no dado por hecho.

   ─── LO QUE NO ES NEGOCIABLE (arquitectura, no gusto) ─────────────────────

   La lista de CONNECTED de OTRA persona no se puede abrir, se llame como se
   llame. La RLS de friendships no tiene rama pública: el servidor no la
   entrega. Sólo se puede abrir la PROPIA (my_circle), y eso ya vive en
   Messages. Cualquier "ver los amigos de Fulano" exigiría cambiar esa
   política — o sea tirar una decisión de privacidad tomada a propósito.
   Si Diego lo quiere, es otra conversación, con su migración.
   ========================================================================= */

/* Las etiquetas. Cambiar AQUÍ cambia toda la app. */
export const VOCAB = {
  // follows — direccional
  followAction: 'FOLLOW',        // botón en reposo: aún no lo sigues
  followingState: 'FOLLOWING',   // botón activo: ya lo sigues
  followers: 'FOLLOWERS',        // conteo/lista de quién lo sigue
  following: 'FOLLOWING',        // conteo/lista de a quién sigue

  // friendships — mutua, privada
  connected: 'CONNECTED',        // el vínculo aceptado (antes "amigos")
  connectAction: '+ CONNECT',    // pedirlo
  connectPending: 'REQUESTED',   // lo pediste, falta que acepten
  connectIncoming: 'ACCEPT?',    // te lo pidieron a ti
}

/* Las frases largas viven aquí también: si mañana "CONNECTED" se llama de
   otro modo, estas oraciones no se quedan hablando del mundo viejo. */
export const VOCAB_PHRASE = {
  followersOf: (n) => `${n} ${VOCAB.followers.toLowerCase()}`,
  followingOf: (n) => `${n} ${VOCAB.following.toLowerCase()}`,
  ownFollowers: 'connected to your world',
  removeConnection: '¿deshacer la conexión?',
  // por qué la lista de conexiones de alguien más no se abre — se dice, no
  // se deja como puerta muerta (Ley 9)
  connectionsArePrivate: 'las conexiones son privadas — sólo las ven las dos personas.',
}
