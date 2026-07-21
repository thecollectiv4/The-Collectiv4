import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'

/* =========================================================================
   FIRST RUN — la memoria de las dos pantallas que sólo se ven una vez.

   Dos superficies dependen de este archivo y de nada más:
     · <Onboarding/>  — la bienvenida (qué se puede hacer aquí)
     · <Tutorial/>    — el recorrido de 7 marcas sobre la app real

   LA VERDAD VIVE EN LA FILA, EL CACHÉ SÓLO EVITA EL PARPADEO.
   `profiles.onboarding_seen` / `profiles.tutorial_seen` (migración 0049) son
   la fuente de verdad: viajan con la cuenta, no con el navegador. Un miembro
   que entra desde su laptop y luego desde su teléfono NO debe ver la
   bienvenida dos veces, y eso sólo lo puede garantizar el servidor.

   localStorage es un PESTILLO DE UN SOLO SENTIDO: puede decir "ya la vio",
   nunca "no la ha visto". Ese detalle es el que hace que el caché sea
   honesto en vez de una segunda fuente de verdad compitiendo con la primera:

     seen = cachéDiceVisto || filaDiceVisto

   ¿Por qué existe entonces? Por UN caso concreto, y vale la pena escribirlo:
   alguien termina el recorrido sin red. El UPDATE falla. Sin caché, el
   siguiente arranque volvería a lanzarle el tutorial encima — el bucle
   exacto que este archivo tiene prohibido causar. El caché se escribe SIEMPRE
   y de inmediato, aunque el servidor no conteste; la fila se pone al día
   cuando pueda.

   POR DEFECTO SE ASUME "YA VISTO". Ninguna de las dos pantallas aparece
   hasta que hay una respuesta DEFINITIVA de que no. Un estado desconocido
   nunca abre una pantalla modal encima de alguien — misma doctrina que
   AuthContext (identidad sin resolver NO es "sin sesión") y que el badge de
   la campana ("un badge nunca inventa"). El costo de equivocarse hacia
   "visto" es que un miembro nuevo se pierde una bienvenida; el costo de
   equivocarse hacia "no visto" es un modal en la cara de alguien que ya
   estaba adentro, en cada carga. No son simétricos.

   SI 0049 NO ESTÁ DESPLEGADA, ESTO NO ROMPE NADA — Y NO ATRAPA A NADIE.
   Una columna que no existe devuelve 42703 (select) o PGRST204 (update, la
   caché de esquema de PostgREST). Los dos se degradan a "ya visto", que es
   la única salida que no deja a un miembro con la bienvenida en bucle en
   cada carga mientras la migración va en camino.

   LA LECTURA degradada NO escribe el caché, a propósito: es una decisión de
   SESIÓN, no un hecho — el día que 0049 aterrice, el siguiente arranque
   pregunta de nuevo y contesta bien.
   LA ESCRITURA sí lo escribe siempre, y ANTES de poder saber si la columna
   existe (markSeen escribe el pestillo en su primera línea). Es el precio de
   la garantía "sin red también se cierra", y hoy es inalcanzable: si falta
   la columna, la lectura ya degradó a "visto" y no se abre nada que marcar.
   Se vuelve alcanzable en UNA ventana: entre que 0049 aterriza y PostgREST
   recarga su esquema —el SELECT ya funciona en Postgres, el UPDATE todavía
   devuelve PGRST204—. Costo máximo: un pestillo de más en UN navegador, o
   sea una bienvenida perdida. Se prefiere eso a un modal en bucle.
   ========================================================================= */

/* Prefijos namespaced como THEME_KEY ('c4:theme'). El uid va pegado porque
   localStorage es del NAVEGADOR, no de la cuenta: dos personas en la misma
   laptop compartirían el pestillo, y la segunda nunca vería su bienvenida. */
export const ONBOARDING_KEY = 'c4:onboarding-seen'
export const TUTORIAL_KEY = 'c4:tutorial-seen'

const cacheKey = (base, uid) => `${base}:${uid}`

const readCache = (base, uid) => {
  if (!uid) return false
  try { return localStorage.getItem(cacheKey(base, uid)) === '1' } catch { return false }
}

const writeCache = (base, uid) => {
  if (!uid) return
  try { localStorage.setItem(cacheKey(base, uid), '1') } catch { /* modo privado / storage bloqueado: la fila sigue siendo la verdad */ }
}

const clearCache = (base, uid) => {
  if (!uid) return
  try { localStorage.removeItem(cacheKey(base, uid)) } catch { /* idem */ }
}

/* Las dos caras del mismo hueco: 42703 lo tira Postgres al leer una columna
   que no existe; PGRST204 lo tira PostgREST al escribir una que su caché de
   esquema no conoce. El regex es el cinturón por si algún día cambia el
   código pero no el mensaje (mismo criterio que MISSING en social.js). */
const MISSING_COLUMN = /column .* does not exist|could not find the .* column|schema cache/i
const isMissingColumn = (error) => {
  if (!error) return false
  return error.code === '42703' || error.code === 'PGRST204' || MISSING_COLUMN.test(error.message || '')
}

/* ── LECTURA ──────────────────────────────────────────────────────────────
   UNA sola consulta para las dos banderas. Devuelve SIEMPRE una forma
   completa; nunca lanza. `degraded` dice por qué no se pudo saber, para que
   quien llame pueda distinguir "no ha visto nada" de "no se pudo preguntar".

     degraded: null      → la fila contestó, los booleanos son reales
               'schema'  → 0049 todavía no está en el proyecto
               'error'   → red / RLS / lo que sea: se asume visto por hoy
               'no-row'  → la fila del perfil aún no nace (se crea perezosa
                           en la primera visita a /profile). Eso SÍ es un
                           miembro nuevo de verdad: no ha visto nada. */
export async function fetchFirstRun(uid) {
  if (!uid) return { onboardingSeen: true, tutorialSeen: true, degraded: 'anon' }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_seen,tutorial_seen')
      .eq('id', uid)
      .maybeSingle()

    if (error) {
      return { onboardingSeen: true, tutorialSeen: true, degraded: isMissingColumn(error) ? 'schema' : 'error' }
    }
    if (!data) {
      // sin fila = cuenta recién creada que todavía no pasó por /profile.
      // Es el único caso en que "no visto" se afirma sin haber leído un
      // booleano, y es correcto: no hay dónde haber guardado un visto.
      return { onboardingSeen: false, tutorialSeen: false, degraded: 'no-row' }
    }
    return {
      onboardingSeen: data.onboarding_seen === true,
      tutorialSeen: data.tutorial_seen === true,
      degraded: null,
    }
  } catch {
    return { onboardingSeen: true, tutorialSeen: true, degraded: 'error' }
  }
}

/* ── ESCRITURA ────────────────────────────────────────────────────────────
   El caché se escribe PRIMERO y sin condiciones: es la garantía de que la
   pantalla no vuelve, aunque el servidor no conteste nunca. El UPDATE pasa
   por profiles_self_update (0001: `auth.uid() = id` en using Y en with
   check) y no toca ninguna columna con trigger — ni verified, ni
   deleted_at, ni protected, ni precios.

   Nunca lanza: esto corre al CERRAR una pantalla de bienvenida, y un error
   ahí no puede impedir que la pantalla se cierre. */
async function markSeen(uid, column, cacheBase) {
  if (!uid) return { ok: false, degraded: 'anon' }
  writeCache(cacheBase, uid)
  try {
    const { data, error } = await supabase
      .from('profiles').update({ [column]: true }).eq('id', uid).select('id')

    if (error) return { ok: false, degraded: isMissingColumn(error) ? 'schema' : 'error' }
    if (data && data.length > 0) return { ok: true, degraded: null }

    /* Cero filas afectadas = la fila del perfil aún no existe (nace perezosa
       en la primera visita a /profile — ver AuthContext). Misma puerta que
       usa social.js cuando un follow choca contra la FK 23503: el servidor
       crea la fila mínima y se reintenta una vez. */
    const { error: seedError } = await supabase.rpc('ensure_own_profile')
    if (seedError) return { ok: false, degraded: 'no-row' }

    const retry = await supabase
      .from('profiles').update({ [column]: true }).eq('id', uid).select('id')
    if (retry.error) return { ok: false, degraded: isMissingColumn(retry.error) ? 'schema' : 'error' }
    return { ok: Boolean(retry.data && retry.data.length), degraded: retry.data?.length ? null : 'no-row' }
  } catch {
    return { ok: false, degraded: 'error' }
  }
}

export const markOnboardingSeen = (uid) => markSeen(uid, 'onboarding_seen', ONBOARDING_KEY)
export const markTutorialSeen = (uid) => markSeen(uid, 'tutorial_seen', TUTORIAL_KEY)

/* ── REPETIR EL RECORRIDO ─────────────────────────────────────────────────
   Sin consumidor todavía: hoy no hay ningún botón en la app que llame a
   esto. Existe porque el pestillo local es de un solo sentido y sin una
   puerta de vuelta NADIE —ni un fundador haciendo QA— podría volver a ver
   el recorrido sin borrar localStorage a mano. Cuando Settings quiera una
   fila "Replay the tour", esto es lo que llama.
   Ojo: hay que limpiar el caché ADEMÁS de la fila, o el pestillo local
   seguiría diciendo "visto" y la fila en false no serviría de nada.

   ⚠ QUIEN LA CABLEE TIENE QUE SABER ESTO: esto limpia la fila y el caché,
   pero NO el estado `dismissed` de useFirstRun, que es de SESIÓN. Llamada
   sola desde una fila de Settings, el recorrido no reaparece hasta recargar
   — y una fila que se pulsa y no hace nada visible es justo el control que
   la ley de Settings.jsx prohíbe. Quien la monte tiene que recargar (o
   levantar el recorrido a mano) en el mismo gesto, y decirlo en la fila. */
export async function replayTour(uid) {
  if (!uid) return { ok: false }
  clearCache(TUTORIAL_KEY, uid)
  try {
    const { error } = await supabase.from('profiles').update({ tutorial_seen: false }).eq('id', uid)
    return { ok: !error }
  } catch { return { ok: false } }
}

export function clearFirstRunCache(uid) {
  clearCache(ONBOARDING_KEY, uid)
  clearCache(TUTORIAL_KEY, uid)
}

/* ── EL HOOK QUE MONTA LAS DOS PANTALLAS ──────────────────────────────────
   Un solo consumidor previsto: Layout. Devuelve dos booleanos y dos cierres.

   LA SECUENCIA ES PARTE DEL CONTRATO: el tutorial no puede abrirse encima
   de la bienvenida. `needsTutorial` exige que onboarding ya esté visto, así
   que al cerrar la bienvenida el recorrido entra solo, en orden, sin que
   Layout tenga que coordinar nada.

   Y "SKIP" QUIERE DECIR SKIP. Quien pulsa Skip en la bienvenida NO recibe a
   continuación un recorrido de siete pasos: sería la lectura más hostil
   posible de su gesto. Terminar la bienvenida abre el recorrido; saltarla
   cierra los dos. Por eso completeOnboarding lleva un argumento — es la
   diferencia entre "seguí" y "no, gracias", y son respuestas distintas.
   La puerta de vuelta para quien se arrepienta es replayTour().

   `dismissed` es estado de SESIÓN, no persistencia: quien cierra una de las
   dos no la vuelve a ver mientras la pestaña siga viva, aunque el UPDATE
   haya fallado. Sin esto, un fallo de red reabriría el modal en el siguiente
   render. */
export function useFirstRun() {
  const { user, loading } = useAuth()
  const uid = user?.id || null

  // el default es VISTO — nada se abre sobre nadie hasta tener un "no" firme
  const [state, setState] = useState({ ready: false, onboardingSeen: true, tutorialSeen: true, degraded: null })
  const [dismissed, setDismissed] = useState({ onboarding: false, tutorial: false })

  useEffect(() => {
    // identidad sin resolver ≠ sin sesión: se espera a loading===false
    // siempre, y un anónimo simplemente no tiene primera vez.
    if (loading || !uid) {
      setState({ ready: false, onboardingSeen: true, tutorialSeen: true, degraded: null })
      setDismissed({ onboarding: false, tutorial: false })
      return undefined
    }
    let alive = true
    // el pestillo local entra en la respuesta, nunca la reemplaza
    const cachedOnboarding = readCache(ONBOARDING_KEY, uid)
    const cachedTutorial = readCache(TUTORIAL_KEY, uid)
    fetchFirstRun(uid).then((row) => {
      if (!alive) return
      setState({
        ready: true,
        onboardingSeen: cachedOnboarding || row.onboardingSeen,
        tutorialSeen: cachedTutorial || row.tutorialSeen,
        degraded: row.degraded,
      })
    })
    return () => { alive = false }
  }, [loading, uid])

  /* startTour=false es SKIP (o Escape) en la bienvenida: se marcan las DOS
     banderas. Ver la nota de arriba — encadenar siete pasos detrás de un
     "saltar" es contestar lo contrario de lo que la persona pidió. */
  const completeOnboarding = useCallback((startTour = true) => {
    setDismissed((d) => ({ ...d, onboarding: true, tutorial: !startTour }))
    setState((s) => ({ ...s, onboardingSeen: true, tutorialSeen: s.tutorialSeen || !startTour }))
    markOnboardingSeen(uid)   // fire-and-forget: el caché ya cerró el pestillo
    if (!startTour) markTutorialSeen(uid)
  }, [uid])

  /* persist=false es el checkbox "Don't show this again" DESMARCADO. No es
     decoración: no se escribe NADA (ni caché ni fila), así que el recorrido
     vuelve en el siguiente arranque — que es literalmente lo que la casilla
     desmarcada promete. Un control que se puede mover y no hace nada es peor
     que uno que no existe (la ley de Settings). */
  const completeTutorial = useCallback((persist = true) => {
    setDismissed((d) => ({ ...d, tutorial: true }))
    if (!persist) return
    setState((s) => ({ ...s, tutorialSeen: true }))
    markTutorialSeen(uid)
  }, [uid])

  return {
    ready: state.ready,
    degraded: state.degraded,
    needsOnboarding: state.ready && !state.onboardingSeen && !dismissed.onboarding,
    needsTutorial: state.ready && state.onboardingSeen && !state.tutorialSeen && !dismissed.tutorial,
    completeOnboarding,
    completeTutorial,
  }
}
