import { useNavigate } from 'react-router-dom'
import { FOUNDERS } from '@/lib/houseWorlds'

/* =========================================================================
   FoundersLine (v12) — "Pato Durán & Diego Villaseñor · Founders", con los
   dos nombres como PUERTAS a sus mundos reales.

   Era un string literal DUPLICADO en Events.jsx y HouseWorld.jsx: dos copias
   del mismo renglón, las dos texto muerto, y las dos había que mantenerlas a
   mano. Ahora es un componente y los nombres abren perfil.

   Los dos existen de verdad y están verificados, así que caen del lado
   "puerta" de la regla permanente (ver houseWorlds.js). Si algún día uno de
   esos ids dejara de resolver, esto sigue pintando el nombre — sólo que sin
   puerta, que es justo lo que la regla pide.

   Hereda tipografía y color del contenedor (font/color: inherit) para no
   traer su propia voz: el renglón se ve idéntico en las dos pantallas, que
   lo componen distinto (una con marca ◇, otra sin).
   ========================================================================= */
export default function FoundersLine() {
  const navigate = useNavigate()
  return (
    <>
      {FOUNDERS.map((f, i) => (
        <span key={f.id}>
          {i > 0 && ' & '}
          <button className="pressable" onClick={() => navigate(`/user/${f.id}`)}
            aria-label={`Open ${f.name}'s world`}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              font: 'inherit', color: 'inherit', letterSpacing: 'inherit',
              textTransform: 'inherit',
            }}>
            {f.name}
          </button>
        </span>
      ))}
      {' · Founders'}
    </>
  )
}
