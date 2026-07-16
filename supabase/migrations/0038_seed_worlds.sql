-- =========================================================================
-- 0038 — LA SEMILLA VIVA (El Mundo v9 · D3)
--
-- The 133 existing is_demo shells are empty (0 tastes, ~6 crafts) — so the
-- for-you has nothing to rank and Community feels dead. This plants a fresh
-- batch of ~32 FULLY-built, Houston-credible seed worlds: real crafts (with a
-- primary), public + private tastes, museum pieces, an OFFER with a price,
-- friendships between them, close friends, plans with RSVPs, and buyers on a
-- draft test event. Each carries user_id 'v9seed_<slug>' — its own batch tag.
--
-- SAFETY — the four non-negotiables (all VERIFIED by evidence in the handback):
--   1. NEVER public — is_demo=true, floored by 0033/0034 RLS (anon reads []).
--   2. NEVER counted — 0028/0032 exclude is_demo from every metric.
--   3. Purgable in ONE click — admin_purge_seed() (0037) + the /os button.
--   4. Founder always knows — SHOW SEED toggle + the per-card ◇ seed label.
-- These are QA fixtures, NOT the IRL fraud the canon bans (fake users sold as
-- traction). They are internal, invisible, uncounted, and purgable.
--
-- IDEMPOTENT: re-running is a no-op (guarded on the v9seed_ batch tag).
-- ADDITIVE: inserts only; nothing existing is touched.
-- =========================================================================
begin;

do $seed$
declare
  personas jsonb := $json$
[
  {
    "slug": "marisol-rivera",
    "full_name": "Marisol Rivera",
    "username": "maririvera",
    "discipline": "House DJ · Producer",
    "crafts": [
      "dj",
      "music-producer"
    ],
    "verified": true,
    "tagline": "house music from the east end",
    "bio": "Grew up between Second Ward taquerias and her tio's record crates, and learned to beatmatch on a cracked controller before she owned real gear. Now she builds deep and Latin house sets for EaDo warehouse nights and runs a monthly session for women behind the decks.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "deep house"
      },
      {
        "domain": "music",
        "label": "cumbia"
      },
      {
        "domain": "music",
        "label": "Frank Ocean"
      },
      {
        "domain": "art",
        "label": "Frida Kahlo"
      },
      {
        "domain": "food",
        "label": "barbacoa Sundays"
      }
    ],
    "tastes_private": [
      {
        "domain": "film",
        "label": "Y Tu Mama Tambien"
      },
      {
        "domain": "music",
        "label": "DJ Screw"
      },
      {
        "domain": "style",
        "label": "vintage huaraches"
      }
    ],
    "works": [
      "closing set at a sold-out EaDo warehouse on Canal St",
      "'Ladies of the Low-End' monthly at a Second Ward backyard",
      "edit of a Selena classic that runs every set"
    ],
    "offer": {
      "kind": "service",
      "title": "2-hour DJ set for warehouse or backyard events",
      "price_usd": 400
    }
  },
  {
    "slug": "tobias-fontenot",
    "full_name": "Tobias Fontenot",
    "username": "tobyfontenot",
    "discipline": "Techno DJ · Producer",
    "crafts": [
      "dj",
      "music-producer"
    ],
    "verified": true,
    "tagline": "raw texas techno, no laptop",
    "bio": "Third Ward native who fell for Detroit techno through his uncle's Submerge records. He plays hardware-only sets that lean dark and hypnotic, and presses limited dubplates out of a home studio off Almeda. Believes a room should sweat.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Detroit techno"
      },
      {
        "domain": "music",
        "label": "DJ Screw"
      },
      {
        "domain": "art",
        "label": "Rothko Chapel"
      },
      {
        "domain": "film",
        "label": "Blade Runner 2049"
      },
      {
        "domain": "style",
        "label": "all-black workwear"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Sade"
      },
      {
        "domain": "food",
        "label": "oxtail"
      },
      {
        "domain": "film",
        "label": "Killer of Sheep"
      }
    ],
    "works": [
      "hardware-only closing set at a Navigation Blvd warehouse",
      "dubplate series pressed in a Third Ward bedroom",
      "6am set that emptied the ice machine"
    ],
    "offer": {
      "kind": "service",
      "title": "Hardware techno set, decks and drum machine",
      "price_usd": 500
    }
  },
  {
    "slug": "yesenia-vargas",
    "full_name": "Yesenia Vargas",
    "username": "yenivargas",
    "discipline": "Cumbia DJ · Sonidero",
    "crafts": [
      "dj"
    ],
    "verified": false,
    "tagline": "cumbias till the sun comes up",
    "bio": "Magnolia Park through and through, spinning cumbia rebajada, sonidero, and Latin bass at quinceaneras that turn into block parties. She carries her dad's speaker horns to every gig. The crowd is always three generations deep.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "cumbia rebajada"
      },
      {
        "domain": "music",
        "label": "sonidero"
      },
      {
        "domain": "food",
        "label": "elote"
      },
      {
        "domain": "style",
        "label": "tejana boots"
      },
      {
        "domain": "art",
        "label": "lowrider murals"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Bad Bunny"
      },
      {
        "domain": "film",
        "label": "Selena"
      },
      {
        "domain": "food",
        "label": "mango con chile"
      }
    ],
    "works": [
      "sonidero night at Guadalupe Plaza",
      "cumbia set at a Magnolia Park backyard quince",
      "rebajada edit that made the abuelas dance"
    ],
    "offer": {
      "kind": "service",
      "title": "Cumbia and sonidero DJ set with sound system",
      "price_usd": 350
    }
  },
  {
    "slug": "marcus-thibodeaux",
    "full_name": "Marcus Thibodeaux",
    "username": "marcusthib",
    "discipline": "Producer · Beatmaker",
    "crafts": [
      "music-producer",
      "beatmaker"
    ],
    "verified": true,
    "tagline": "screwed tapes for a new houston",
    "bio": "Sunnyside-raised producer keeping the chopped-and-screwed lineage alive without embalming it. He samples church organs and slabs rolling down MLK, then hands beats to young rappers for free until they eat. UGK is scripture.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "DJ Screw"
      },
      {
        "domain": "music",
        "label": "UGK"
      },
      {
        "domain": "music",
        "label": "Frank Ocean"
      },
      {
        "domain": "food",
        "label": "Frenchy's chicken"
      },
      {
        "domain": "style",
        "label": "gold fronts"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Sade"
      },
      {
        "domain": "art",
        "label": "John Biggers murals"
      },
      {
        "domain": "film",
        "label": "Do the Right Thing"
      }
    ],
    "works": [
      "beat tape 'Slab Sermons Vol. 3'",
      "produced a Sunnyside cypher that hit a million plays",
      "screwed a Solange record for a gallery opening"
    ],
    "offer": {
      "kind": "product",
      "title": "Custom beat with two revisions, exclusive rights",
      "price_usd": 600
    }
  },
  {
    "slug": "danny-vo",
    "full_name": "Danny Vo",
    "username": "dannyvobeats",
    "discipline": "Beatmaker · Producer",
    "crafts": [
      "beatmaker",
      "music-producer"
    ],
    "verified": false,
    "tagline": "boom bap out of alief",
    "bio": "Alief kid who learned MPC off YouTube in the back of his parents' nail salon. He makes dusty boom-bap and lo-fi loops soaked in the Vietnamese oldies his mom played on Sundays. Sells beats to rappers three states over.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "J Dilla"
      },
      {
        "domain": "music",
        "label": "boom bap"
      },
      {
        "domain": "music",
        "label": "Frank Ocean"
      },
      {
        "domain": "food",
        "label": "Viet-Cajun crawfish"
      },
      {
        "domain": "film",
        "label": "In the Mood for Love"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Vietnamese oldies"
      },
      {
        "domain": "art",
        "label": "ukiyo-e"
      },
      {
        "domain": "food",
        "label": "banh mi"
      }
    ],
    "works": [
      "loop pack 'Sunday at the Salon'",
      "beat placement on a Dallas mixtape",
      "flip of a Trinh Cong Son ballad"
    ],
    "offer": {
      "kind": "product",
      "title": "Beat pack of five exclusive instrumentals",
      "price_usd": 250
    }
  },
  {
    "slug": "camila-reyes",
    "full_name": "Camila Reyes",
    "username": "camreyesphoto",
    "discipline": "Event Photographer",
    "crafts": [
      "event-photographer",
      "photographer"
    ],
    "verified": true,
    "tagline": "i shoot the room, not the flyer",
    "bio": "East End photographer who shoots warehouse nights like they're the last one. She works fast on a flash and a prime lens, chasing the sweat and the strangers-becoming-friends moment. Every RBA night lives on her hard drive.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "house"
      },
      {
        "domain": "art",
        "label": "Gordon Parks"
      },
      {
        "domain": "film",
        "label": "City of God"
      },
      {
        "domain": "style",
        "label": "thrifted denim"
      },
      {
        "domain": "food",
        "label": "tacos al pastor"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Sade"
      },
      {
        "domain": "art",
        "label": "Graciela Iturbide"
      },
      {
        "domain": "film",
        "label": "Amores Perros"
      }
    ],
    "works": [
      "photo recap of a 300-cap Navigation warehouse night",
      "portrait series of East End DJs",
      "disposable-cam roll from a Second Ward backyard"
    ],
    "offer": {
      "kind": "service",
      "title": "Full event photo coverage, edited gallery in 72 hours",
      "price_usd": 450
    }
  },
  {
    "slug": "isaiah-kim",
    "full_name": "Isaiah Kim",
    "username": "isaiahkimshoots",
    "discipline": "Portrait Photographer",
    "crafts": [
      "portrait-photographer",
      "photographer"
    ],
    "verified": false,
    "tagline": "faces before they get famous",
    "bio": "Korean-Houstonian portrait shooter working out of a Montrose walk-up. He photographs the city's creatives on medium-format film, one roll, no chimping. Quiet on set, loud in the final frame.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "Roy DeCarava"
      },
      {
        "domain": "film",
        "label": "Moonlight"
      },
      {
        "domain": "music",
        "label": "Frank Ocean"
      },
      {
        "domain": "style",
        "label": "minimal tailoring"
      },
      {
        "domain": "food",
        "label": "pho"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Tame Impala"
      },
      {
        "domain": "art",
        "label": "Rothko Chapel"
      },
      {
        "domain": "film",
        "label": "Paris Is Burning"
      }
    ],
    "works": [
      "medium-format portrait series 'Montrose After Midnight'",
      "cover portrait for a local zine",
      "artist headshots for a Sawyer Yards open studio"
    ],
    "offer": {
      "kind": "service",
      "title": "Film portrait session, one look, ten edited frames",
      "price_usd": 300
    }
  },
  {
    "slug": "brianna-session",
    "full_name": "Brianna Session",
    "username": "brisession",
    "discipline": "Fashion Photographer · Retoucher",
    "crafts": [
      "fashion-photographer",
      "photo-retoucher"
    ],
    "verified": false,
    "tagline": "editorial with a houston accent",
    "bio": "Museum District-based fashion shooter building glossy editorials around Houston designers instead of borrowed New York looks. She retouches every frame herself, late, with the AC cranked. Believes Southern light beats a studio strobe.",
    "tastes_public": [
      {
        "domain": "style",
        "label": "Comme des Garcons"
      },
      {
        "domain": "art",
        "label": "Kehinde Wiley"
      },
      {
        "domain": "music",
        "label": "Solange"
      },
      {
        "domain": "film",
        "label": "Daughters of the Dust"
      },
      {
        "domain": "food",
        "label": "natural wine"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Aaliyah"
      },
      {
        "domain": "art",
        "label": "Gee's Bend quilts"
      },
      {
        "domain": "style",
        "label": "vintage Vogue Italia"
      }
    ],
    "works": [
      "editorial 'Bayou Couture' shot at Buffalo Bayou",
      "lookbook for a Gulfton designer",
      "beauty story lit only by golden hour"
    ],
    "offer": {
      "kind": "service",
      "title": "Half-day editorial shoot with retouched selects",
      "price_usd": 700
    }
  },
  {
    "slug": "ruben-salinas",
    "full_name": "Ruben Salinas",
    "username": "rubensalinasfilm",
    "discipline": "Videographer · Cinematographer",
    "crafts": [
      "videographer",
      "cinematographer"
    ],
    "verified": true,
    "tagline": "recap videos that actually feel like the night",
    "bio": "Near Northside filmmaker who cut his teeth shooting music videos for rappers off Fulton with a borrowed gimbal. His recap edits move like the crowd did. He shoots first and asks about the budget later, which his accountant hates.",
    "tastes_public": [
      {
        "domain": "film",
        "label": "City of God"
      },
      {
        "domain": "music",
        "label": "Travis Scott"
      },
      {
        "domain": "art",
        "label": "graffiti"
      },
      {
        "domain": "style",
        "label": "Dickies"
      },
      {
        "domain": "food",
        "label": "breakfast tacos"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "DJ Screw"
      },
      {
        "domain": "film",
        "label": "Y Tu Mama Tambien"
      },
      {
        "domain": "art",
        "label": "lowrider culture"
      }
    ],
    "works": [
      "one-take recap of an EaDo warehouse rave",
      "music video shot along the Hardy Toll Road",
      "brand film for a Northside sneaker shop"
    ],
    "offer": {
      "kind": "service",
      "title": "Event recap video, 60-90 seconds, 5-day turnaround",
      "price_usd": 550
    }
  },
  {
    "slug": "thao-nguyen",
    "full_name": "Thao Nguyen",
    "username": "thaonguyendp",
    "discipline": "Cinematographer · Colorist",
    "crafts": [
      "cinematographer",
      "colorist"
    ],
    "verified": false,
    "tagline": "moody frames, clean grades",
    "bio": "Alief-raised DP and colorist who treats color like seasoning. She shoots short films and fashion films around Houston's forgotten strip malls, then grades them warm and heavy at night. Her reference folder is all Wong Kar-wai.",
    "tastes_public": [
      {
        "domain": "film",
        "label": "In the Mood for Love"
      },
      {
        "domain": "film",
        "label": "Chungking Express"
      },
      {
        "domain": "art",
        "label": "neon signage"
      },
      {
        "domain": "music",
        "label": "Sade"
      },
      {
        "domain": "food",
        "label": "Viet-Cajun crawfish"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Tame Impala"
      },
      {
        "domain": "style",
        "label": "vintage silk"
      },
      {
        "domain": "film",
        "label": "Moonlight"
      }
    ],
    "works": [
      "fashion film graded in Alief strip-mall neon",
      "short doc on a Vietnamese-Houston fishing family",
      "color grade for a local music video"
    ],
    "offer": {
      "kind": "service",
      "title": "Color grade for short film or music video",
      "price_usd": 400
    }
  },
  {
    "slug": "hector-maldonado",
    "full_name": "Hector Maldonado",
    "username": "hectormurals",
    "discipline": "Muralist · Painter",
    "crafts": [
      "muralist",
      "painter"
    ],
    "verified": true,
    "tagline": "walls that talk back to the block",
    "bio": "Second Ward muralist painting the neighborhood's memory onto its own walls before the developers repaint them beige. Chicano iconography, sun-bleached palettes, and portraits of the elders who fed the block. He primes his own walls at dawn.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "Chicano muralism"
      },
      {
        "domain": "art",
        "label": "Frida Kahlo"
      },
      {
        "domain": "music",
        "label": "cumbia"
      },
      {
        "domain": "food",
        "label": "barbacoa"
      },
      {
        "domain": "style",
        "label": "vaquero western"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Sade"
      },
      {
        "domain": "film",
        "label": "El Norte"
      },
      {
        "domain": "art",
        "label": "Jose Clemente Orozco"
      }
    ],
    "works": [
      "50-foot mural on a Canal Street taqueria wall",
      "Dia de los Muertos ofrenda mural at Guadalupe Plaza",
      "portrait of a neighborhood elder on Navigation"
    ],
    "offer": {
      "kind": "service",
      "title": "Commissioned exterior mural, design plus paint",
      "price_usd": 2000
    }
  },
  {
    "slug": "deja-coleman",
    "full_name": "Deja Coleman",
    "username": "dejacolemanart",
    "discipline": "Painter · Mixed-Media Artist",
    "crafts": [
      "painter",
      "mixed-media-artist"
    ],
    "verified": false,
    "tagline": "black houston in oil and gold leaf",
    "bio": "Third Ward painter working out of a studio near Project Row Houses. She builds portraits of Black Houston in oil, gold leaf, and cut fabric from her grandmother's closet. The work is tender and it does not ask permission.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "Kerry James Marshall"
      },
      {
        "domain": "art",
        "label": "John Biggers"
      },
      {
        "domain": "music",
        "label": "Solange"
      },
      {
        "domain": "film",
        "label": "Daughters of the Dust"
      },
      {
        "domain": "food",
        "label": "gumbo"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Erykah Badu"
      },
      {
        "domain": "art",
        "label": "Gee's Bend quilts"
      },
      {
        "domain": "style",
        "label": "head wraps"
      }
    ],
    "works": [
      "portrait series 'Emancipation' shown near Project Row Houses",
      "mixed-media piece using her grandmother's church fans",
      "live painting at a Juneteenth block party"
    ],
    "offer": {
      "kind": "product",
      "title": "Original mid-size portrait on canvas",
      "price_usd": 1400
    }
  },
  {
    "slug": "kevin-tran",
    "full_name": "Kevin Tran",
    "username": "kevtranone",
    "discipline": "Graffiti Artist · Illustrator",
    "crafts": [
      "graffiti-artist",
      "illustrator"
    ],
    "verified": false,
    "tagline": "letters first, everything else after",
    "bio": "EaDo writer who came up bombing the drainage ditches off the East Freeway and now paints legal walls and brand murals without losing the hand. Wildstyle roots, Vietnamese-Houston pride, zero interest in going soft. Still keeps a black book.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "graffiti"
      },
      {
        "domain": "film",
        "label": "Style Wars"
      },
      {
        "domain": "music",
        "label": "UGK"
      },
      {
        "domain": "style",
        "label": "deadstock sneakers"
      },
      {
        "domain": "food",
        "label": "banh mi"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "DJ Screw"
      },
      {
        "domain": "art",
        "label": "ukiyo-e"
      },
      {
        "domain": "film",
        "label": "Wild Style"
      }
    ],
    "works": [
      "EaDo legal wall production under the East Freeway",
      "hand-painted mural for a Sharpstown sneaker shop",
      "custom lettering for a warehouse party flyer"
    ],
    "offer": {
      "kind": "service",
      "title": "Custom graffiti mural or lettering piece",
      "price_usd": 800
    }
  },
  {
    "slug": "sofia-nguyen-martinez",
    "full_name": "Sofia Nguyen-Martinez",
    "username": "sofiadraws",
    "discipline": "Illustrator · Digital Artist",
    "crafts": [
      "illustrator",
      "digital-artist"
    ],
    "verified": false,
    "tagline": "flyers that make you want to be there",
    "bio": "Sharpstown illustrator, half Vietnamese half Mexican, who designs the flyers half the city's parties run on. Riso-inspired color, hand-drawn type, references only Houston kids will catch. She's the reason your favorite rave looked cool before you walked in.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "riso printing"
      },
      {
        "domain": "music",
        "label": "house"
      },
      {
        "domain": "film",
        "label": "Spirited Away"
      },
      {
        "domain": "style",
        "label": "Y2K graphics"
      },
      {
        "domain": "food",
        "label": "elote"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "cumbia"
      },
      {
        "domain": "art",
        "label": "Mexican loteria cards"
      },
      {
        "domain": "food",
        "label": "Viet-Cajun crawfish"
      }
    ],
    "works": [
      "flyer series for a monthly EaDo techno party",
      "illustrated menu for a Sharpstown pho spot",
      "riso zine of Houston street food"
    ],
    "offer": {
      "kind": "product",
      "title": "Custom event flyer, print and story-ready formats",
      "price_usd": 200
    }
  },
  {
    "slug": "malik-osei",
    "full_name": "Malik Osei",
    "username": "malikoseiink",
    "discipline": "Tattoo Artist · Illustrator",
    "crafts": [
      "tattoo-artist",
      "illustrator"
    ],
    "verified": true,
    "tagline": "fine line, deep meaning",
    "bio": "Heights-based tattooer with a Ghanaian-American hand, known for fine-line adinkra symbols and blackwork that carries a story. He books slow on purpose so every piece gets the time it needs. The chair is a confessional and he keeps it sacred.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "adinkra symbols"
      },
      {
        "domain": "music",
        "label": "Fela Kuti"
      },
      {
        "domain": "style",
        "label": "blackwork tattooing"
      },
      {
        "domain": "film",
        "label": "Sankofa"
      },
      {
        "domain": "food",
        "label": "jollof rice"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Sade"
      },
      {
        "domain": "art",
        "label": "Kerry James Marshall"
      },
      {
        "domain": "food",
        "label": "oxtail"
      }
    ],
    "works": [
      "adinkra sleeve documented on a Heights client",
      "blackwork back piece completed over six sessions",
      "flash sheet themed on West African proverbs"
    ],
    "offer": {
      "kind": "service",
      "title": "Custom fine-line tattoo, half-day session",
      "price_usd": 450
    }
  },
  {
    "slug": "priya-raman",
    "full_name": "Priya Raman",
    "username": "priyaramanink",
    "discipline": "Tattoo Artist",
    "crafts": [
      "tattoo-artist"
    ],
    "verified": false,
    "tagline": "botanical linework, mostly plants",
    "bio": "Montrose tattooer specializing in delicate botanical and South Indian-inspired linework. She grows the plants she tattoos on her studio windowsill. Walk-ins welcome if you bring good energy and a real reason.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "botanical illustration"
      },
      {
        "domain": "music",
        "label": "Tame Impala"
      },
      {
        "domain": "style",
        "label": "henna patterns"
      },
      {
        "domain": "food",
        "label": "dosa"
      },
      {
        "domain": "film",
        "label": "Monsoon Wedding"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Frank Ocean"
      },
      {
        "domain": "art",
        "label": "Mughal miniatures"
      },
      {
        "domain": "food",
        "label": "mango lassi"
      }
    ],
    "works": [
      "botanical half-sleeve of Texas wildflowers",
      "South Indian kolam-inspired hand piece",
      "matching linework set for a Montrose couple"
    ],
    "offer": {
      "kind": "service",
      "title": "Small to medium linework tattoo",
      "price_usd": 250
    }
  },
  {
    "slug": "fernanda-guzman",
    "full_name": "Fernanda Guzman",
    "username": "ferguzman",
    "discipline": "Fashion Designer · Textile Designer",
    "crafts": [
      "fashion-designer",
      "textile-designer"
    ],
    "verified": true,
    "tagline": "clothes cut from where i'm from",
    "bio": "Gulfton designer sewing a line that pulls from her Mexican roots and the swap-meet energy of her block. Deadstock fabric, hand-dyed textiles, silhouettes built for real bodies. Every drop tells a story from Bissonnet.",
    "tastes_public": [
      {
        "domain": "style",
        "label": "deadstock workwear"
      },
      {
        "domain": "art",
        "label": "Mexican textiles"
      },
      {
        "domain": "music",
        "label": "cumbia"
      },
      {
        "domain": "food",
        "label": "tacos al pastor"
      },
      {
        "domain": "film",
        "label": "Roma"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Bad Bunny"
      },
      {
        "domain": "art",
        "label": "Frida Kahlo"
      },
      {
        "domain": "style",
        "label": "vintage charro suits"
      }
    ],
    "works": [
      "capsule collection 'Bissonnet' shown at a Gulfton pop-up",
      "hand-dyed textile series from swap-meet fabric",
      "custom charro-inspired jacket for a DJ"
    ],
    "offer": {
      "kind": "product",
      "title": "Made-to-order custom garment",
      "price_usd": 450
    }
  },
  {
    "slug": "colton-reed",
    "full_name": "Colton Reed",
    "username": "coltonreedmade",
    "discipline": "Fashion Designer · Tailor",
    "crafts": [
      "fashion-designer",
      "tailor"
    ],
    "verified": false,
    "tagline": "texas workwear, made to last",
    "bio": "Heights tailor building heavyweight workwear and western pieces meant to outlive their owner. Selvedge denim, chain-stitch details, no fast fashion in sight. He'll fix a jacket you bought from someone else just so it stops falling apart.",
    "tastes_public": [
      {
        "domain": "style",
        "label": "selvedge denim"
      },
      {
        "domain": "style",
        "label": "western wear"
      },
      {
        "domain": "music",
        "label": "outlaw country"
      },
      {
        "domain": "art",
        "label": "Americana signage"
      },
      {
        "domain": "food",
        "label": "Blood Bros BBQ"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Tame Impala"
      },
      {
        "domain": "film",
        "label": "No Country for Old Men"
      },
      {
        "domain": "style",
        "label": "vintage Wranglers"
      }
    ],
    "works": [
      "waxed canvas chore coat, small-batch run",
      "custom western shirt with chain-stitch yoke",
      "reworked vintage denim jacket for a client"
    ],
    "offer": {
      "kind": "product",
      "title": "Custom-tailored chore coat or western shirt",
      "price_usd": 550
    }
  },
  {
    "slug": "selena-ortiz",
    "full_name": "Selena Ortiz",
    "username": "selenastyles",
    "discipline": "Stylist · Fashion Designer",
    "crafts": [
      "stylist",
      "fashion-designer"
    ],
    "verified": false,
    "tagline": "i dress the night, not the mannequin",
    "bio": "Midtown stylist who pulls looks for the city's DJs, rappers, and warehouse crowd out of thrift racks and local designers only. She styles a shoot like she's telling on somebody. No borrowed clout, all Houston.",
    "tastes_public": [
      {
        "domain": "style",
        "label": "thrifted vintage"
      },
      {
        "domain": "music",
        "label": "Solange"
      },
      {
        "domain": "art",
        "label": "editorial styling"
      },
      {
        "domain": "film",
        "label": "Paris Is Burning"
      },
      {
        "domain": "food",
        "label": "aguas frescas"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "DJ Screw"
      },
      {
        "domain": "style",
        "label": "pachuca zoot suits"
      },
      {
        "domain": "food",
        "label": "elote"
      }
    ],
    "works": [
      "styled a lineup shoot for an EaDo party flyer",
      "thrift-only editorial for a Houston zine",
      "wardrobe for a Northside music video"
    ],
    "offer": {
      "kind": "service",
      "title": "Wardrobe styling for a shoot or performance",
      "price_usd": 350
    }
  },
  {
    "slug": "jalen-brooks",
    "full_name": "Jalen Brooks",
    "username": "jalenbrooks",
    "discipline": "Event Producer · Promoter",
    "crafts": [
      "event-producer",
      "promoter"
    ],
    "verified": true,
    "tagline": "the room is the whole point",
    "bio": "EaDo promoter and producer who's been throwing warehouse nights since before it was cool, losing money on the first ones so the culture could win. He books the lineup, finds the space, and makes strangers feel like regulars. The door is his ministry.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "house"
      },
      {
        "domain": "music",
        "label": "techno"
      },
      {
        "domain": "art",
        "label": "warehouse design"
      },
      {
        "domain": "food",
        "label": "late-night tacos"
      },
      {
        "domain": "style",
        "label": "all black"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "DJ Screw"
      },
      {
        "domain": "film",
        "label": "24 Hour Party People"
      },
      {
        "domain": "food",
        "label": "Turkey Leg Hut"
      }
    ],
    "works": [
      "launched a monthly warehouse series on Navigation",
      "produced a 400-cap Juneteenth block party",
      "curated a rooftop night for Houston selectors only"
    ],
    "offer": {
      "kind": "service",
      "title": "Event production, from venue to lineup to door",
      "price_usd": 1500
    }
  },
  {
    "slug": "ximena-torres",
    "full_name": "Ximena Torres",
    "username": "ximenabooks",
    "discipline": "Promoter · Talent Booker",
    "crafts": [
      "promoter",
      "talent-booker"
    ],
    "verified": false,
    "tagline": "connecting the dots nobody else sees",
    "bio": "East End booker with a phone full of the right numbers and a sixth sense for who's about to blow up. She books local openers onto touring bills so Houston talent gets the stage. If two artists should meet, she already texted them.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "cumbia"
      },
      {
        "domain": "music",
        "label": "house"
      },
      {
        "domain": "art",
        "label": "flyer culture"
      },
      {
        "domain": "style",
        "label": "streetwear"
      },
      {
        "domain": "food",
        "label": "breakfast tacos"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Bad Bunny"
      },
      {
        "domain": "film",
        "label": "Selena"
      },
      {
        "domain": "food",
        "label": "mango con chile"
      }
    ],
    "works": [
      "booked a Houston opener onto a sold-out touring show",
      "curated an all-women-DJ warehouse bill",
      "connected a muralist with a festival stage-design gig"
    ],
    "offer": {
      "kind": "service",
      "title": "Talent booking and lineup curation per event",
      "price_usd": 500
    }
  },
  {
    "slug": "keisha-landry",
    "full_name": "Keisha Landry",
    "username": "keishacooks",
    "discipline": "Chef · Caterer",
    "crafts": [
      "chef",
      "caterer"
    ],
    "verified": false,
    "tagline": "soul food is memory work",
    "bio": "Sunnyside chef cooking Creole-Southern plates the way her grandmother did off Loop 610, gumbo dark as the roux gets. She caters warehouse afters and gallery openings so nobody creates on an empty stomach. Every plate has a name attached to it.",
    "tastes_public": [
      {
        "domain": "food",
        "label": "gumbo"
      },
      {
        "domain": "food",
        "label": "oxtail"
      },
      {
        "domain": "music",
        "label": "Solange"
      },
      {
        "domain": "art",
        "label": "John Biggers"
      },
      {
        "domain": "style",
        "label": "apron over Sunday best"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Erykah Badu"
      },
      {
        "domain": "film",
        "label": "Eve's Bayou"
      },
      {
        "domain": "food",
        "label": "Frenchy's chicken"
      }
    ],
    "works": [
      "pop-up gumbo night at a Third Ward gallery",
      "catered an EaDo warehouse after-party",
      "Sunday supper series for local creatives"
    ],
    "offer": {
      "kind": "service",
      "title": "Catering for events, per-head Creole-Southern menu",
      "price_usd": 900
    }
  },
  {
    "slug": "duc-pham",
    "full_name": "Duc Pham",
    "username": "ducphameats",
    "discipline": "Chef · Food Stylist",
    "crafts": [
      "chef",
      "food-stylist"
    ],
    "verified": false,
    "tagline": "viet-cajun is houston food",
    "bio": "Alief chef building menus at the exact corner where Vietnamese and Cajun Houston meet: crawfish in garlic butter and fish sauce. He pop-ups out of a converted garage and styles food for shoots on the side. This city raised this food and he cooks it proud.",
    "tastes_public": [
      {
        "domain": "food",
        "label": "Viet-Cajun crawfish"
      },
      {
        "domain": "food",
        "label": "banh mi"
      },
      {
        "domain": "music",
        "label": "lo-fi"
      },
      {
        "domain": "art",
        "label": "food photography"
      },
      {
        "domain": "style",
        "label": "kitchen clogs"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Frank Ocean"
      },
      {
        "domain": "film",
        "label": "In the Mood for Love"
      },
      {
        "domain": "food",
        "label": "bun bo Hue"
      }
    ],
    "works": [
      "Viet-Cajun crawfish boil pop-up in an Alief garage",
      "styled a banh mi editorial for a food zine",
      "collab dinner with a Third Ward chef"
    ],
    "offer": {
      "kind": "service",
      "title": "Pop-up dinner or crawfish boil, per-head",
      "price_usd": 600
    }
  },
  {
    "slug": "gabriela-solis",
    "full_name": "Gabriela Solis",
    "username": "gabsolispours",
    "discipline": "Mixologist",
    "crafts": [
      "mixologist"
    ],
    "verified": false,
    "tagline": "agave first, ask questions later",
    "bio": "Montrose bartender building mezcal and agave cocktails around Mexican ingredients most bars won't touch: hoja santa, chicatana salt, tamarind. She runs the bar at gallery openings and warehouse nights. Every drink has a place it comes from.",
    "tastes_public": [
      {
        "domain": "food",
        "label": "mezcal"
      },
      {
        "domain": "food",
        "label": "aguas frescas"
      },
      {
        "domain": "music",
        "label": "cumbia"
      },
      {
        "domain": "art",
        "label": "agave craft"
      },
      {
        "domain": "style",
        "label": "vintage guayabera"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Sade"
      },
      {
        "domain": "film",
        "label": "Y Tu Mama Tambien"
      },
      {
        "domain": "food",
        "label": "tamarind candy"
      }
    ],
    "works": [
      "cocktail program for a Second Ward gallery opening",
      "mezcal bar at an EaDo warehouse night",
      "agua-fresca-spiked cocktail menu for a summer pop-up"
    ],
    "offer": {
      "kind": "service",
      "title": "Craft bar service and cocktail menu for events",
      "price_usd": 500
    }
  },
  {
    "slug": "tierra-wells",
    "full_name": "Tierra Wells",
    "username": "tierramoves",
    "discipline": "Dancer · Choreographer",
    "crafts": [
      "dancer",
      "choreographer"
    ],
    "verified": true,
    "tagline": "movement rooted in the diaspora",
    "bio": "Third Ward dancer and choreographer building work at the meeting point of West African, modern, and Houston majorette traditions. She teaches teens at a community center by day and performs in warehouses by night. The body remembers what words forget.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Fela Kuti"
      },
      {
        "domain": "art",
        "label": "Alvin Ailey"
      },
      {
        "domain": "music",
        "label": "Solange"
      },
      {
        "domain": "film",
        "label": "Daughters of the Dust"
      },
      {
        "domain": "style",
        "label": "African print"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Erykah Badu"
      },
      {
        "domain": "art",
        "label": "John Biggers"
      },
      {
        "domain": "food",
        "label": "jollof rice"
      }
    ],
    "works": [
      "choreographed a live performance at a Third Ward warehouse",
      "majorette-inspired piece for a Juneteenth event",
      "movement workshop for teens at Emancipation Park"
    ],
    "offer": {
      "kind": "service",
      "title": "Choreography and performance for events or film",
      "price_usd": 600
    }
  },
  {
    "slug": "joaquin-mendoza",
    "full_name": "Joaquin Mendoza",
    "username": "joaquinbboy",
    "discipline": "Street Dancer · Choreographer",
    "crafts": [
      "street-dancer",
      "choreographer"
    ],
    "verified": false,
    "tagline": "breaking since the northside cyphers",
    "bio": "Near Northside b-boy who learned to break in gas-station parking-lot cyphers and now battles nationally under the Houston flag. He runs a free Sunday cypher under the freeway so the next kids have somewhere to go. Foundation over flash, always.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "boom bap"
      },
      {
        "domain": "music",
        "label": "funk breaks"
      },
      {
        "domain": "art",
        "label": "graffiti"
      },
      {
        "domain": "style",
        "label": "tracksuits"
      },
      {
        "domain": "food",
        "label": "breakfast tacos"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "DJ Screw"
      },
      {
        "domain": "film",
        "label": "Wild Style"
      },
      {
        "domain": "food",
        "label": "elote"
      }
    ],
    "works": [
      "won a b-boy battle repping Houston",
      "runs a Sunday cypher under the North Loop",
      "performed a breaking set at an EaDo warehouse party"
    ],
    "offer": {
      "kind": "service",
      "title": "Breaking performance or workshop",
      "price_usd": 300
    }
  },
  {
    "slug": "amara-nightingale",
    "full_name": "Amara Nightingale",
    "username": "amaranightingale",
    "discipline": "Drag Performer · Host",
    "crafts": [
      "drag-performer",
      "host-mc"
    ],
    "verified": false,
    "tagline": "montrose royalty, self-appointed",
    "bio": "Montrose drag performer and host who came up on the same stages that built Houston's queer nightlife. Big numbers, sharper jokes, a heart for the baby queens coming up behind her. She'll host your show and read you with love.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "disco"
      },
      {
        "domain": "music",
        "label": "Beyonce"
      },
      {
        "domain": "art",
        "label": "camp aesthetics"
      },
      {
        "domain": "film",
        "label": "Paris Is Burning"
      },
      {
        "domain": "style",
        "label": "couture drag"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Sade"
      },
      {
        "domain": "film",
        "label": "But I'm a Cheerleader"
      },
      {
        "domain": "food",
        "label": "late-night Whataburger"
      }
    ],
    "works": [
      "hosted a Pride warehouse showcase in Montrose",
      "headline drag number at a Midtown club",
      "mentored a first-timer through her debut set"
    ],
    "offer": {
      "kind": "service",
      "title": "Drag performance or event hosting",
      "price_usd": 400
    }
  },
  {
    "slug": "nia-okonkwo",
    "full_name": "Nia Okonkwo",
    "username": "niaokonkwopoet",
    "discipline": "Poet · Writer",
    "crafts": [
      "poet",
      "writer"
    ],
    "verified": true,
    "tagline": "spoken word with a texas drawl",
    "bio": "Third Ward poet and Nigerian-American writer whose spoken word has closed out open mics from Emancipation Ave to the Museum District. She writes about migration, mothers, and the city that raised her voice. Publishes a chapbook every year, sells them by hand.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "spoken word"
      },
      {
        "domain": "music",
        "label": "Erykah Badu"
      },
      {
        "domain": "film",
        "label": "Moonlight"
      },
      {
        "domain": "style",
        "label": "vintage Ankara"
      },
      {
        "domain": "food",
        "label": "jollof rice"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Sade"
      },
      {
        "domain": "art",
        "label": "Gwendolyn Brooks"
      },
      {
        "domain": "food",
        "label": "gumbo"
      }
    ],
    "works": [
      "closed a Third Ward open mic three years running",
      "self-published chapbook 'Emancipation Ave'",
      "commissioned poem for a gallery opening"
    ],
    "offer": {
      "kind": "product",
      "title": "Commissioned custom poem, framed print included",
      "price_usd": 200
    }
  },
  {
    "slug": "hunter-boyd",
    "full_name": "Hunter Boyd",
    "username": "hunterboydzines",
    "discipline": "Writer · Zine Maker",
    "crafts": [
      "writer",
      "zine-maker"
    ],
    "verified": false,
    "tagline": "documenting the scene before it forgets itself",
    "bio": "Montrose writer and zine-maker who's been quietly chronicling Houston's underground since the blog days. He makes cut-and-paste zines out of show flyers, interviews, and bad photos of good nights. Somebody has to write it down.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "zine culture"
      },
      {
        "domain": "music",
        "label": "punk"
      },
      {
        "domain": "film",
        "label": "24 Hour Party People"
      },
      {
        "domain": "style",
        "label": "thrifted band tees"
      },
      {
        "domain": "food",
        "label": "kolaches"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "DJ Screw"
      },
      {
        "domain": "art",
        "label": "riso printing"
      },
      {
        "domain": "food",
        "label": "breakfast tacos"
      }
    ],
    "works": [
      "quarterly zine 'Bayou City Underground'",
      "oral-history interview series with Houston promoters",
      "liner-notes essay for a local mixtape"
    ],
    "offer": {
      "kind": "product",
      "title": "Zine issue plus a written feature on your project",
      "price_usd": 150
    }
  },
  {
    "slug": "elena-castillo",
    "full_name": "Elena Castillo",
    "username": "elenacastillo",
    "discipline": "Curator · Gallerist",
    "crafts": [
      "curator",
      "gallerist"
    ],
    "verified": true,
    "tagline": "giving houston artists a real wall",
    "bio": "Sawyer Yards curator running a small independent gallery that only shows Houston artists, half of them first-timers. She fought for the lease and pays artists before she pays herself. The opening-night crowd is the actual point.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "contemporary Houston art"
      },
      {
        "domain": "art",
        "label": "Chicano muralism"
      },
      {
        "domain": "music",
        "label": "house"
      },
      {
        "domain": "food",
        "label": "natural wine"
      },
      {
        "domain": "style",
        "label": "gallery minimalism"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Sade"
      },
      {
        "domain": "film",
        "label": "Daughters of the Dust"
      },
      {
        "domain": "art",
        "label": "Menil Collection"
      }
    ],
    "works": [
      "curated a first-time-artists group show at Sawyer Yards",
      "solo debut for a Third Ward painter",
      "warehouse art-and-music night with live muralists"
    ],
    "offer": {
      "kind": "service",
      "title": "Exhibition curation and gallery show production",
      "price_usd": 1200
    }
  },
  {
    "slug": "terrance-ellison",
    "full_name": "Terrance Ellison",
    "username": "terranceellison",
    "discipline": "Artist Manager · Talent Booker",
    "crafts": [
      "artist-manager",
      "talent-booker"
    ],
    "verified": false,
    "tagline": "building careers, not just moments",
    "bio": "Midtown manager who guides a small roster of Houston DJs and producers from bedroom to booking fees without selling their souls. He negotiates the deals artists are too polite to fight for. Loyalty over volume, every time.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "house"
      },
      {
        "domain": "music",
        "label": "UGK"
      },
      {
        "domain": "art",
        "label": "album cover design"
      },
      {
        "domain": "style",
        "label": "clean streetwear"
      },
      {
        "domain": "food",
        "label": "Turkey Leg Hut"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "DJ Screw"
      },
      {
        "domain": "film",
        "label": "Do the Right Thing"
      },
      {
        "domain": "food",
        "label": "oxtail"
      }
    ],
    "works": [
      "took a bedroom producer to their first paid festival slot",
      "negotiated a residency for a Houston DJ",
      "built a release plan for a local rapper's debut EP"
    ],
    "offer": {
      "kind": "service",
      "title": "Artist management retainer, monthly",
      "price_usd": 800
    }
  },
  {
    "slug": "ana-lucia-fuentes",
    "full_name": "Ana Lucia Fuentes",
    "username": "analuciafuentes",
    "discipline": "Creative Director · Brand Designer",
    "crafts": [
      "creative-director",
      "brand-designer"
    ],
    "verified": true,
    "tagline": "identity work for people who mean it",
    "bio": "East End creative director building brand identities for Houston's independent spaces: taquerias, record shops, warehouse parties. Bilingual by default, rooted in barrio design language, allergic to corporate polish. She makes small businesses look like the movements they are.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "graphic design"
      },
      {
        "domain": "style",
        "label": "vernacular signage"
      },
      {
        "domain": "music",
        "label": "cumbia"
      },
      {
        "domain": "food",
        "label": "taqueria culture"
      },
      {
        "domain": "film",
        "label": "Amores Perros"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Frank Ocean"
      },
      {
        "domain": "art",
        "label": "Mexican loteria cards"
      },
      {
        "domain": "style",
        "label": "vintage matchbook design"
      }
    ],
    "works": [
      "full brand identity for an East End record shop",
      "logo and flyer system for a warehouse party series",
      "bilingual menu design for a Magnolia Park taqueria"
    ],
    "offer": {
      "kind": "service",
      "title": "Brand identity package, logo and core assets",
      "price_usd": 1500
    }
  }
]
  $json$::jsonb;
  p          jsonb;
  v_id       uuid;
  v_uidsent  text;
  cslug      text;
  cpos       int;
  tj         jsonb;
  tpos       int;
  w          text;
  founder_pato  uuid := 'c255c33b-60d5-4e53-a81a-2f89d7f5ad1b';
  founder_diego uuid := 'ec009f34-14c7-430c-b527-900d5a88ba70';
  test_event    uuid := 'f4ce9f44-a9ca-425e-aebb-2144bff8e738';   -- blindaje-test (draft — not public)
begin
  -- idempotent guard: only plant the batch once
  if exists (select 1 from public.profiles where user_id like 'v9seed\_%') then
    raise notice 'v9 seed batch already present — skipping';
    return;
  end if;

  ---------------------------------------------------------------------------
  -- 1–5 · per persona: profile + crafts + tastes + museum pieces + the offer
  ---------------------------------------------------------------------------
  for p in select value from jsonb_array_elements(personas) loop
    v_uidsent := 'v9seed_' || (p->>'slug');

    insert into public.profiles
      (user_id, is_demo, full_name, username, city, discipline, tagline, bio, verified, taste, media, created_at)
    values (
      v_uidsent, true, p->>'full_name', p->>'username', 'Houston',
      p->>'discipline', p->>'tagline', p->>'bio', coalesce((p->>'verified')::boolean, false),
      -- legacy public taste (SOUND / SCREEN / INFLUENCES on the card + museum)
      jsonb_strip_nulls(jsonb_build_object(
        'music',      (select jsonb_agg(x->>'label') from jsonb_array_elements(p->'tastes_public') x where x->>'domain' = 'music'),
        'films',      (select jsonb_agg(x->>'label') from jsonb_array_elements(p->'tastes_public') x where x->>'domain' = 'film'),
        'influences', (select jsonb_agg(x->>'label') from jsonb_array_elements(p->'tastes_public') x where x->>'domain' in ('art','style','food'))
      )),
      -- legacy media gallery (the Community card's "work" count)
      coalesce((select jsonb_agg(jsonb_build_object('caption', wv, 'url', '')) from jsonb_array_elements_text(p->'works') wv), '[]'::jsonb),
      now() - (floor(random() * 80)::int || ' days')::interval
    )
    returning id into v_id;

    -- crafts (first slug = primary)
    cpos := 0;
    for cslug in select value from jsonb_array_elements_text(p->'crafts') loop
      insert into public.profile_crafts (profile_id, craft_id, is_primary, position)
      select v_id, c.id, (cpos = 0), cpos from public.crafts c where c.slug = cslug
      on conflict (profile_id, craft_id) do nothing;
      cpos := cpos + 1;
    end loop;

    -- tastes: public then private (norm via the app's own normalizer, so
    -- the matching engine sees them exactly as a real member's)
    tpos := 0;
    for tj in select value from jsonb_array_elements(coalesce(p->'tastes_public','[]'::jsonb)) loop
      insert into public.profile_tastes (profile_id, domain, label, is_public, position)
      values (v_id, case when (tj->>'domain') in ('music','film') then tj->>'domain' else 'interest' end, tj->>'label', true, tpos)
      on conflict (profile_id, domain, norm) do nothing;   -- norm GENERATED; domains map to music/film/interest
      tpos := tpos + 1;
    end loop;
    for tj in select value from jsonb_array_elements(coalesce(p->'tastes_private','[]'::jsonb)) loop
      insert into public.profile_tastes (profile_id, domain, label, is_public, position)
      values (v_id, case when (tj->>'domain') in ('music','film') then tj->>'domain' else 'interest' end, tj->>'label', false, tpos)
      on conflict (profile_id, domain, norm) do nothing;   -- norm GENERATED; domains map to music/film/interest
      tpos := tpos + 1;
    end loop;

    -- works → world_posts (the museum's dated timeline)
    for w in select value from jsonb_array_elements_text(coalesce(p->'works','[]'::jsonb)) loop
      insert into public.world_posts (profile_id, caption, images, created_at)
      values (v_id, w, '[]'::jsonb, now() - (floor(random() * 50)::int || ' days')::interval);
    end loop;

    -- THE OFFER (kind: product→piece; price usd→cents, floored at the 100 min)
    if (p ? 'offer') and (p->'offer' is not null) and (p->'offer'->>'title') is not null then
      insert into public.listings (profile_id, kind, title, price_cents, currency, status)
      values (
        v_id,
        case when (p->'offer'->>'kind') = 'product' then 'piece' else 'service' end,
        left(p->'offer'->>'title', 120),
        greatest(100, coalesce((p->'offer'->>'price_usd')::int, 50) * 100),
        'usd', 'live'
      );
    end if;
  end loop;

  ---------------------------------------------------------------------------
  -- 6 · the social web — friendships, close friends, follows (all seed↔seed,
  --     plus PENDING requests to the founders so they can test ACCEPT)
  ---------------------------------------------------------------------------
  -- accepted friendships: each seed befriends the next three (a dense circle)
  insert into public.friendships (requester_id, addressee_id, status, responded_at)
  select a.id, b.id, 'accepted', now()
  from (select id, row_number() over (order by user_id) rn from public.profiles where user_id like 'v9seed\_%') a
  join (select id, row_number() over (order by user_id) rn from public.profiles where user_id like 'v9seed\_%') b
    on b.rn in (a.rn + 1, a.rn + 2, a.rn + 3)
  where a.id <> b.id
  on conflict (requester_id, addressee_id) do nothing;

  -- pending requests waiting on Pato (the launch test: open Messages, ACCEPT)
  insert into public.friendships (requester_id, addressee_id, status)
  select id, founder_pato, 'pending'
  from (select id from public.profiles where user_id like 'v9seed\_%' order by user_id limit 6) s
  where id <> founder_pato
  on conflict (requester_id, addressee_id) do nothing;
  -- and a few waiting on Diego
  insert into public.friendships (requester_id, addressee_id, status)
  select id, founder_diego, 'pending'
  from (select id from public.profiles where user_id like 'v9seed\_%' order by user_id offset 6 limit 3) s
  where id <> founder_diego
  on conflict (requester_id, addressee_id) do nothing;

  -- close friends: each seed pulls its first accepted friend into close
  insert into public.close_friends (owner_id, friend_id)
  select distinct on (f.requester_id) f.requester_id, f.addressee_id
  from public.friendships f
  join public.profiles a on a.id = f.requester_id and a.user_id like 'v9seed\_%'
  where f.status = 'accepted'
  order by f.requester_id, f.addressee_id
  on conflict (owner_id, friend_id) do nothing;

  -- follows among the seed (mirrors the accepted graph) — never to a founder,
  -- so no real follower count is touched
  insert into public.follows (follower_id, followee_id)
  select f.requester_id, f.addressee_id
  from public.friendships f
  join public.profiles a on a.id = f.requester_id and a.user_id like 'v9seed\_%'
  join public.profiles b on b.id = f.addressee_id and b.user_id like 'v9seed\_%'
  where f.status = 'accepted'
  on conflict (follower_id, followee_id) do nothing;

  ---------------------------------------------------------------------------
  -- 7 · plans with rooms + RSVPs (seed↔seed; shows the kickback model alive)
  ---------------------------------------------------------------------------
  insert into public.plans (creator_id, title, spot, detail, starts_at, status, visibility)
  select c.id, x.title, x.spot, x.detail, now() + (x.days || ' days')::interval, 'live', x.vis
  from (select id, row_number() over (order by user_id) rn from public.profiles where user_id like 'v9seed\_%' limit 4) c
  join (values
    (1, 'warehouse set · saturday', 'EaDo warehouse',    'bring cash for the bar. doors at 10.', '2', 'public'),
    (2, 'gallery pull-up',          'Museum District',   'soft opening — come thru early.',      '5', 'friends'),
    (3, 'fucho + tacos sunday',     'Memorial Park',     'loser buys. cleats optional.',         '4', 'close'),
    (4, 'late studio session',      'Third Ward',        'open decks after midnight.',           '1', 'friends')
  ) x(rn, title, spot, detail, days, vis) on x.rn = c.rn;

  -- a room for each seed plan (mirrors create_plan's thread)
  insert into public.threads (kind, plan_id, title, created_by)
  select 'plan', pl.id, left(pl.title, 60), pl.creator_id
  from public.plans pl
  where pl.creator_id in (select id from public.profiles where user_id like 'v9seed\_%')
    and not exists (select 1 from public.threads th where th.plan_id = pl.id);

  -- the creator is IN their own plan
  insert into public.plan_members (plan_id, profile_id, status, responded_at)
  select pl.id, pl.creator_id, 'in', now()
  from public.plans pl
  where pl.creator_id in (select id from public.profiles where user_id like 'v9seed\_%')
  on conflict (plan_id, profile_id) do nothing;

  -- invite a few seed friends into each plan, with a spread of RSVPs
  insert into public.plan_members (plan_id, profile_id, status, invited_by)
  select pl.id, s.id,
    (array['in','maybe','invited','in'])[(1 + (s.rn % 4))::int],
    pl.creator_id
  from public.plans pl
  join public.profiles c on c.id = pl.creator_id and c.user_id like 'v9seed\_%'
  cross join lateral (
    select id, row_number() over (order by user_id) rn
    from public.profiles where user_id like 'v9seed\_%' and id <> pl.creator_id
    order by user_id limit 4
  ) s
  on conflict (plan_id, profile_id) do nothing;

  -- every plan member joins the plan's room
  insert into public.thread_members (thread_id, profile_id)
  select th.id, pm.profile_id
  from public.plan_members pm
  join public.plans pl on pl.id = pm.plan_id and pl.creator_id in (select id from public.profiles where user_id like 'v9seed\_%')
  join public.threads th on th.plan_id = pl.id
  on conflict do nothing;

  ---------------------------------------------------------------------------
  -- 8 · buyers on a DRAFT test event (proves the cohort path; excluded from
  --     every count by is_demo — guardrail 2)
  ---------------------------------------------------------------------------
  insert into public.tickets (event_id, buyer_id, buyer_email, buyer_name, quantity, price_paid, status)
  select test_event, s.id, coalesce(s.username, 'seed') || '@seed.local', s.full_name, 1, 2500, 'confirmed'
  from (select id, username, full_name from public.profiles where user_id like 'v9seed\_%' order by user_id limit 10) s;

  raise notice 'v9 seed batch planted';
end;
$seed$;

commit;

-- =====================================================================
-- VERIFY (after push):
--   -- planted:  select count(*) from profiles where user_id like 'v9seed\_%';   -- ~32
--   -- invisible: (anon) GET /rest/v1/profiles?is_demo=eq.true                    -> []
--   -- pending to founder: select count(*) from friendships
--   --   where addressee_id='<pato>' and status='pending';                        -- ~6
--   -- purge: select admin_purge_seed();   (owner) -> soft-deletes the whole seed
-- =====================================================================
