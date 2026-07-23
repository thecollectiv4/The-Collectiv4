-- =========================================================================
-- 0056 — LOS FEMENINOS DEL OFICIO (v17 · fase 2)
--
-- El audit del 16 jul lo cachó con nombre y apellido: "cocinera" devuelve
-- "nothing by that name". El seed de 0020 sólo carga las formas masculinas
-- en español (cocinero, pintor, fotografo…) y el match de search_crafts es
-- needle-como-substring-del-alias — 'cocinera' no es substring de
-- 'cocinero', así que la mujer que nombra su oficio en su idioma rebota en
-- la primera pregunta de la casa.
--
-- CAMBIO MÍNIMO, NO REESCRITURA: updates dirigidos sobre crafts.aliases —
-- las variantes femeninas obvias de los aliases ES que ya existen. Nada de
-- tocar search_crafts (la función que usa TODO picker), nada de re-correr
-- el upsert completo de 0020 (141 filas de blast radius por 18 palabras).
--
-- Idempotente: cada update se guarda con `not (… = any(aliases))`.
-- ACL: cero cambios — es data. search_crafts ya estaba concedida a
-- anon+authenticated (0020:208-209) y esta migración no mueve ni un grant;
-- lo único que cambia para anon es que el buscador ahora también reconoce
-- a las que siempre estuvieron.
-- =========================================================================

do $$
declare
  pair record;
begin
  for pair in
    select * from (values
      ('painter',          'pintora'),
      ('illustrator',      'ilustradora'),
      ('sculptor',         'escultora'),
      ('tattoo-artist',    'tatuadora'),
      ('photographer',     'fotografa'),
      ('writer',           'escritora'),
      ('dancer',           'bailarina'),
      ('chef',             'cocinera'),
      ('baker',            'panadera'),
      ('music-producer',   'productora'),
      ('graphic-designer', 'disenadora grafica'),
      ('graphic-designer', 'disenadora'),
      ('fashion-designer', 'disenadora de moda'),
      ('jewelry-designer', 'joyera'),
      ('event-producer',   'productora de eventos'),
      ('event-curator',    'curadora'),
      ('curator',          'curadora'),
      ('copywriter',       'redactora'),
      ('copy-editor',      'editora'),
      ('video-editor',     'editora')
    ) as t(slug, alias)
  loop
    update public.crafts
       set aliases = aliases || array[pair.alias]
     where slug = pair.slug
       and not (pair.alias = any(aliases));
  end loop;
end $$;
