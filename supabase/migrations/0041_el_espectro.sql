-- =========================================================================
-- 0041 — EL ESPECTRO (El Mundo v10 · D0)
--
-- v9's seed proved "every Houston CREATIVE is a world" (32 worlds, 0038).
-- The founder's written thesis says more: "we're building for anyone
-- seeking real connection and real life." This batch opens the seed to the
-- full range of HUMAN — Houston-anchored, three new tiers:
--   · iconos    — archetype-level figures (the architect who left the firm,
--                 the chef who turned a stand into an institution...) —
--                 ARCHETYPES ONLY, never a real person, never a real name.
--   · oficio    — serious craft that is NOT creative-industry: architects,
--                 engineers, lawyers, doctors, teachers. Their crafts array
--                 is EMPTY on purpose — the taxonomy (0020) has no slot for
--                 them. That absence is a finding, not an oversight.
--   · normales  — the guy who just wants to play fucho on Sundays, the
--                 show-goer, the sneaker collector, the newcomer. THE
--                 thesis test: if the platform serves them AND the
--                 architect, the thesis holds.
-- The seed stopped being a QA fixture in v10: it is a DESIGN INSTRUMENT.
-- You fill the world with the full range of humanity, walk it as each of
-- them, and the product's gaps scream on their own (see the Caminata doc).
--
-- SAFETY — the four non-negotiables, inherited by construction:
--   1. NEVER public   — is_demo=true, floored by 0033/0034/0039 RLS.
--   2. NEVER counted  — 0028/0032 exclude is_demo from every metric.
--   3. Purgable in ONE click — admin_purge_seed() (0037) covers every
--      is_demo row, this batch included. Nothing here escapes it.
--   4. Founder always knows — SHOW SEED + per-card ◇ label (Community
--      since v9; the for-you since 0040).
-- Batch tag: user_id 'v10seed_<slug>'. IDEMPOTENT (guarded on the tag).
-- ADDITIVE: inserts only; v9's batch and all real rows are untouched.
-- NO REAL NAMES: every persona is invented; adversarially screened.
-- =========================================================================
begin;

do $seed$
declare
  personas jsonb := $json$
[
  {
    "slug": "ramiro-cepeda",
    "full_name": "Ramiro Cepeda",
    "username": "ramirocepeda",
    "discipline": "Architect - Brand Founder",
    "crafts": [
      "founder"
    ],
    "verified": true,
    "tagline": "left the firm. kept the drawings.",
    "bio": "Ten years drawing towers for a firm that never put his name on anything. Now he runs Umbral Works out of an East End warehouse, making furniture and small buildings for people he actually knows. The drafting table came with him.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Cumbia rebajada"
      },
      {
        "domain": "art",
        "label": "Brutalism"
      },
      {
        "domain": "style",
        "label": "Raw denim and work boots"
      },
      {
        "domain": "food",
        "label": "Tacos de trompo"
      },
      {
        "domain": "place",
        "label": "Marfa road trips"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Cumbias at full volume, windows down"
      },
      {
        "domain": "food",
        "label": "Whataburger at 2am"
      },
      {
        "domain": "film",
        "label": "Romantic comedies from the 90s"
      }
    ],
    "works": [
      "walked out of the firm on a tuesday, signed the warehouse lease that friday",
      "first chair sold before the finish had dried",
      "designed his cousin's taqueria for free, calls it his best work"
    ],
    "offer": {
      "kind": "service",
      "title": "Warehouse afternoon: your space or your brand, worked through on paper",
      "price_usd": 600
    }
  },
  {
    "slug": "norma-alvarenga",
    "full_name": "Norma Alvarenga",
    "username": "normaalvarenga",
    "discipline": "Chef - Pupuseria Owner",
    "crafts": [
      "chef"
    ],
    "verified": true,
    "tagline": "same masa since the parking lot",
    "bio": "Started with one griddle and a folding table in a Gulfton parking lot. Twenty-two years later the pupuseria seats eighty and the line still wraps the building on Sundays. She is still the one mixing masa at five in the morning.",
    "tastes_public": [
      {
        "domain": "food",
        "label": "Loroco"
      },
      {
        "domain": "music",
        "label": "Cumbia"
      },
      {
        "domain": "film",
        "label": "Cinema Paradiso"
      },
      {
        "domain": "place",
        "label": "Galveston seawall"
      },
      {
        "domain": "art",
        "label": "Hand-painted signs"
      }
    ],
    "tastes_private": [
      {
        "domain": "film",
        "label": "Telenovelas"
      },
      {
        "domain": "sport",
        "label": "Astros on the radio"
      },
      {
        "domain": "music",
        "label": "Norteno on the drive home"
      }
    ],
    "works": [
      "fed the whole block free the day the loan was paid off",
      "twenty-two years, one recipe, zero shortcuts",
      "the health inspector eats there on his day off"
    ],
    "offer": {
      "kind": "service",
      "title": "Pupusa spread for twenty, delivered hot from the original griddle",
      "price_usd": 350
    }
  },
  {
    "slug": "obiora-ezenwa",
    "full_name": "Obiora Ezenwa",
    "username": "obioraezenwa",
    "discipline": "Founder - Sold the Company, Still Here",
    "crafts": [
      "founder"
    ],
    "verified": true,
    "tagline": "sold the company, kept the city",
    "bio": "Built freight software from a Westchase office park to three hundred employees, then signed the papers and sat in the parking garage for an hour. Now he writes first checks for Houston founders and coaches his son's soccer team in Katy. The sale was the start of the real work.",
    "tastes_public": [
      {
        "domain": "film",
        "label": "Interstellar"
      },
      {
        "domain": "music",
        "label": "Afrobeats"
      },
      {
        "domain": "sport",
        "label": "Premier League at 6am"
      },
      {
        "domain": "place",
        "label": "Terry Hershey trail"
      },
      {
        "domain": "food",
        "label": "Suya"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Gospel on Sunday drives"
      },
      {
        "domain": "film",
        "label": "Nollywood classics"
      },
      {
        "domain": "food",
        "label": "Gas station kolaches"
      }
    ],
    "works": [
      "grew to three hundred employees without leaving houston",
      "wired the sale money and drove straight to his mother's house",
      "first checks into nine houston companies since the exit"
    ],
    "offer": {
      "kind": "service",
      "title": "Ninety minutes on your company, no deck required",
      "price_usd": 250
    }
  },
  {
    "slug": "hanh-pham",
    "full_name": "Hanh Pham",
    "username": "hanhletters",
    "discipline": "Graphic Designer - The City's Handwriting",
    "crafts": [
      "graphic-designer"
    ],
    "verified": true,
    "tagline": "you've seen the work. you just didn't know it was mine.",
    "bio": "Alief kid who lettered her uncle's banh mi menu at fifteen and never stopped. Her logos hang over washaterias, taquerias, and half the club flyers this city has ever reposted. People quote the work every day and cannot name her. She mostly prefers it that way.",
    "tastes_public": [
      {
        "domain": "film",
        "label": "Studio Ghibli"
      },
      {
        "domain": "art",
        "label": "Sign painting"
      },
      {
        "domain": "music",
        "label": "City pop"
      },
      {
        "domain": "style",
        "label": "Vintage tees"
      },
      {
        "domain": "place",
        "label": "Bellaire strip malls"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Sad karaoke ballads"
      },
      {
        "domain": "food",
        "label": "Midnight instant noodles, doctored"
      },
      {
        "domain": "film",
        "label": "Kdrama finales"
      }
    ],
    "works": [
      "lettered her uncle's banh mi menu at fifteen",
      "the flyer everyone reposts every summer is hers",
      "quietly redrew a hundred shop signs across alief"
    ],
    "offer": {
      "kind": "service",
      "title": "Logo and hand-lettering for your shop, start to finish",
      "price_usd": 1500
    }
  },
  {
    "slug": "sylvester-broussard",
    "full_name": "Sylvester Broussard",
    "username": "broussardcuts",
    "discipline": "Barber - Shop Owner, Third Ward",
    "crafts": [],
    "verified": true,
    "tagline": "everybody's equal in the chair",
    "bio": "Twenty-seven years cutting heads in the same Third Ward shop. Councilmen, pastors, rappers, kids before their first job interview, everybody waits their turn and everybody talks. He knows more about this city than any newspaper, and he charges less.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Zydeco"
      },
      {
        "domain": "sport",
        "label": "Friday night football"
      },
      {
        "domain": "food",
        "label": "Boudin"
      },
      {
        "domain": "place",
        "label": "Emancipation Park"
      },
      {
        "domain": "style",
        "label": "Pressed and creased"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Slow jams at closing time"
      },
      {
        "domain": "film",
        "label": "Sunday westerns"
      },
      {
        "domain": "food",
        "label": "Pralines he says are for customers"
      }
    ],
    "works": [
      "same chair, same corner, twenty-seven years",
      "cut three generations of the same families",
      "the chair has settled more disputes than the courthouse"
    ],
    "offer": null
  },
  {
    "slug": "woodrow-chatman",
    "full_name": "Woodrow Chatman",
    "username": "mrchatman",
    "discipline": "Band Director - 31 Years in Acres Homes",
    "crafts": [],
    "verified": true,
    "tagline": "half this city learned to count to four in my room",
    "bio": "Thirty-one years directing band in Acres Homes. His former kids are touring drummers, producers, sound engineers, and one school principal who still calls him sir. He retires every June and is back on the practice field every August.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Jazz"
      },
      {
        "domain": "music",
        "label": "Funk"
      },
      {
        "domain": "sport",
        "label": "Track meets"
      },
      {
        "domain": "place",
        "label": "Friday night stadiums"
      },
      {
        "domain": "food",
        "label": "Barbecue after the game"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Smooth jazz, no apologies"
      },
      {
        "domain": "film",
        "label": "Drumline every time it airs"
      },
      {
        "domain": "food",
        "label": "Cafeteria peach cobbler"
      }
    ],
    "works": [
      "thirty-one years of halftime shows without a repeat",
      "former students on tours, in studios, behind boards",
      "comes out of retirement every august, on schedule"
    ],
    "offer": null
  },
  {
    "slug": "ezekiel-mouton",
    "full_name": "Ezekiel Mouton",
    "username": "zekemouton",
    "discipline": "Retired Boxer - Youth Gym, Hiram Clarke",
    "crafts": [],
    "verified": true,
    "tagline": "the ring is the easy part",
    "bio": "Eleven years as a professional and he kept every lesson except the anger. His Hiram Clarke gym takes any kid who shows up twice, gloves free, report cards checked monthly. Three state-ranked amateurs so far and not one kid lost to the streets.",
    "tastes_public": [
      {
        "domain": "sport",
        "label": "Boxing"
      },
      {
        "domain": "music",
        "label": "Southern soul"
      },
      {
        "domain": "place",
        "label": "Hiram Clarke"
      },
      {
        "domain": "food",
        "label": "Rodeo turkey legs"
      },
      {
        "domain": "film",
        "label": "Old fight footage"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Love ballads in the truck"
      },
      {
        "domain": "food",
        "label": "Banana pudding"
      },
      {
        "domain": "film",
        "label": "Cartoons with the grandkids"
      }
    ],
    "works": [
      "eleven years pro, retired with his health and his memory",
      "gloves free for any kid who shows up twice",
      "three state-ranked amateurs, zero kids lost"
    ],
    "offer": null
  },
  {
    "slug": "herlinda-casares",
    "full_name": "Herlinda Casares",
    "username": "casaresfotos",
    "discipline": "Photographer - Three Decades of Portraits",
    "crafts": [
      "photographer",
      "portrait-photographer"
    ],
    "verified": true,
    "tagline": "your family album probably has my name on the back",
    "bio": "Magnolia Park families have hired her for thirty years: quinceaneras, weddings, funerals, the whole arc of a life. Half the framed photos on the mantels of the East End came out of her camera bag. She still shoots the portraits on film.",
    "tastes_public": [
      {
        "domain": "film",
        "label": "Y Tu Mama Tambien"
      },
      {
        "domain": "music",
        "label": "Boleros"
      },
      {
        "domain": "place",
        "label": "Magnolia Park"
      },
      {
        "domain": "art",
        "label": "Hand-tinted photographs"
      },
      {
        "domain": "food",
        "label": "Menudo on Sunday"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Rancheras that make her cry"
      },
      {
        "domain": "sport",
        "label": "Saturday lucha libre"
      },
      {
        "domain": "food",
        "label": "Pan dulce twice a day"
      }
    ],
    "works": [
      "thirty years of quinceaneras, weddings, and funerals",
      "still shoots every portrait on film",
      "half the mantels in the east end hold her photos"
    ],
    "offer": null
  },
  {
    "slug": "cedric-ledet",
    "full_name": "Cedric Ledet",
    "username": "ledetcustoms",
    "discipline": "Car Builder - Slab Culture Keeper",
    "crafts": [],
    "verified": true,
    "tagline": "candy paint is fine art. texas knew first.",
    "bio": "Thirty years painting and building slabs out of a Kashmere Gardens garage. Museums call it folk art now; he calls it Tuesday. Plenty of the candy paint rolling down 288 traces back to his shop or somebody he taught.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Screwed and chopped"
      },
      {
        "domain": "art",
        "label": "Candy paint"
      },
      {
        "domain": "place",
        "label": "MacGregor Park on Sunday"
      },
      {
        "domain": "style",
        "label": "Gold grills, starched jeans"
      },
      {
        "domain": "food",
        "label": "Fried catfish"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Quiet storm while wet sanding"
      },
      {
        "domain": "film",
        "label": "Car chase movies"
      },
      {
        "domain": "food",
        "label": "Blue Bell from the tub"
      }
    ],
    "works": [
      "thirty years of candy paint out of one garage",
      "a museum asked for a car, he lent them two",
      "taught a generation to pour paint and be patient"
    ],
    "offer": null
  },
  {
    "slug": "yasmin-tabrizi",
    "full_name": "Yasmin Tabrizi",
    "username": "yasmintabrizi",
    "discipline": "Gallerist - Montrose, 25 Years",
    "crafts": [
      "gallerist",
      "curator"
    ],
    "verified": true,
    "tagline": "i hang the work before the world agrees",
    "bio": "Twenty-five years running a Montrose gallery out of a converted bungalow. She showed half this city's now-collected artists when they were still trading paintings for rent. Collectors trust her eye; artists trust her math.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "Outsider art"
      },
      {
        "domain": "place",
        "label": "Rothko Chapel"
      },
      {
        "domain": "music",
        "label": "Persian classical"
      },
      {
        "domain": "film",
        "label": "In the Mood for Love"
      },
      {
        "domain": "food",
        "label": "Tahdig"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Radio pop in the car"
      },
      {
        "domain": "food",
        "label": "Late night queso"
      },
      {
        "domain": "film",
        "label": "Trashy heist movies"
      }
    ],
    "works": [
      "gave forty artists their first solo show",
      "sold the first canvas of a kid who now hangs in museums",
      "pays artists within the week, always has"
    ],
    "offer": null
  },
  {
    "slug": "renata-olguin",
    "full_name": "Renata Olguin",
    "username": "renataolguin",
    "discipline": "Architect",
    "crafts": [],
    "verified": true,
    "tagline": "the porch is the building",
    "bio": "Licensed architect who grew up over her family's panaderia in the East End. She draws schools and small restaurants by day and sketches strip malls she wants to save by night. Believes a good porch does more for a block than any rendering.",
    "tastes_public": [
      {
        "domain": "film",
        "label": "Cinema Paradiso"
      },
      {
        "domain": "art",
        "label": "Barragan pinks"
      },
      {
        "domain": "place",
        "label": "East End"
      },
      {
        "domain": "food",
        "label": "Barbacoa Sundays"
      },
      {
        "domain": "music",
        "label": "Cumbia sonidera"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Juan Gabriel ballads"
      },
      {
        "domain": "food",
        "label": "Whataburger at 2am"
      },
      {
        "domain": "film",
        "label": "Telenovela finales"
      }
    ],
    "works": [
      "got a taqueria addition through permitting in one round",
      "measured every original doorframe before the remodel touched it",
      "keeps a sketchbook of east end strip malls worth saving"
    ],
    "offer": {
      "kind": "service",
      "title": "One-hour residential design consult",
      "price_usd": 180
    }
  },
  {
    "slug": "khoa-diep",
    "full_name": "Khoa Diep",
    "username": "khoadiep",
    "discipline": "Architect",
    "crafts": [],
    "verified": false,
    "tagline": "strip malls are cathedrals if you look right",
    "bio": "Grew up bussing tables at his parents' pho spot off Bellaire. Now he redraws aging strip malls into clinics, cafes, and prayer rooms. Thinks the best architecture in Houston hides behind bad signage.",
    "tastes_public": [
      {
        "domain": "place",
        "label": "Bellaire at night"
      },
      {
        "domain": "food",
        "label": "Bun rieu"
      },
      {
        "domain": "art",
        "label": "Hand-painted signage"
      },
      {
        "domain": "film",
        "label": "In the Mood for Love"
      },
      {
        "domain": "music",
        "label": "Vietnamese bolero"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "City pop"
      },
      {
        "domain": "sport",
        "label": "Sunday badminton"
      },
      {
        "domain": "food",
        "label": "Cup noodles at the office"
      }
    ],
    "works": [
      "redrew a fading strip mall into a community clinic",
      "photographed 200 hand-painted signs before they vanished",
      "still folds a mean takeout box"
    ],
    "offer": null
  },
  {
    "slug": "darnell-boudreaux",
    "full_name": "Darnell Boudreaux",
    "username": "darnellboudreaux",
    "discipline": "Structural Engineer",
    "crafts": [],
    "verified": false,
    "tagline": "somebody has to check the math",
    "bio": "Third Ward raised, five generations deep. He checks the math that keeps med center towers standing and sleeps fine because of it. Weekends are for his granddad's zydeco records and brisket done slow.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Zydeco"
      },
      {
        "domain": "food",
        "label": "Brisket done slow"
      },
      {
        "domain": "sport",
        "label": "Texans on Sundays"
      },
      {
        "domain": "place",
        "label": "Emancipation Park"
      },
      {
        "domain": "art",
        "label": "Shotgun house porches"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Frankie Beverly at cookouts"
      },
      {
        "domain": "film",
        "label": "Hallmark movies with his wife"
      },
      {
        "domain": "food",
        "label": "Gas station boudin"
      }
    ],
    "works": [
      "stamped the retrofit that kept a 60s tower standing",
      "walked the slab pour at 4am and caught the void",
      "teaches a bridge-building unit at his old middle school"
    ],
    "offer": null
  },
  {
    "slug": "wade-kessler",
    "full_name": "Wade Kessler",
    "username": "wadekessler",
    "discipline": "Petroleum Engineer",
    "crafts": [],
    "verified": false,
    "tagline": "decline curves by day, encores by night",
    "bio": "Reservoir engineer in the Energy Corridor, ten years in. He runs decline curves all day and still thinks the best data set in Houston is a live crowd. Has not missed a show he cared about at White Oak since 2021.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Shoegaze"
      },
      {
        "domain": "music",
        "label": "Post-punk"
      },
      {
        "domain": "place",
        "label": "White Oak Music Hall"
      },
      {
        "domain": "food",
        "label": "Crawfish season"
      },
      {
        "domain": "sport",
        "label": "Astros radio broadcasts"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Emo revival"
      },
      {
        "domain": "film",
        "label": "Rom-coms on planes"
      },
      {
        "domain": "style",
        "label": "Same five black tees"
      }
    ],
    "works": [
      "caught 43 shows last year and kept the stubs",
      "optimized a well pad nobody thought had more in it",
      "drove to marfa just to hear silence"
    ],
    "offer": null
  },
  {
    "slug": "meera-deshpande",
    "full_name": "Meera Deshpande",
    "username": "meeradesh",
    "discipline": "Chemical Engineer",
    "crafts": [],
    "verified": false,
    "tagline": "the best incident report is a blank one",
    "bio": "Process safety engineer on the ship channel. Her whole job is the disaster that never happens, and she likes it that way. Sugar Land kid, first chair violin at fifteen, still practices on Sundays.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Hindustani classical"
      },
      {
        "domain": "food",
        "label": "Her mother's puran poli"
      },
      {
        "domain": "place",
        "label": "Sugar Land town square"
      },
      {
        "domain": "film",
        "label": "3 Idiots"
      },
      {
        "domain": "sport",
        "label": "Cricket World Cup"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Item songs from 2009"
      },
      {
        "domain": "food",
        "label": "Kolaches from the gas station"
      },
      {
        "domain": "film",
        "label": "Reality dating shows"
      }
    ],
    "works": [
      "shut a unit down on a hunch and was right",
      "violin at her cousin's wedding, no rehearsal",
      "wrote the safety memo people actually read"
    ],
    "offer": null
  },
  {
    "slug": "joyce-yuen",
    "full_name": "Joyce Yuen",
    "username": "joyceyuen",
    "discipline": "Flight Systems Engineer, Clear Lake",
    "crafts": [],
    "verified": true,
    "tagline": "sat console, kept quiet, vehicle flew",
    "bio": "Flight systems engineer down in Clear Lake. She has sat console overnight for vehicles most people will never hear of and cried once when a burn went clean. Watches Interstellar every launch week, no exceptions.",
    "tastes_public": [
      {
        "domain": "film",
        "label": "Interstellar"
      },
      {
        "domain": "place",
        "label": "Galveston seawall at dawn"
      },
      {
        "domain": "music",
        "label": "Film scores"
      },
      {
        "domain": "food",
        "label": "Dim sum with her grandmother"
      },
      {
        "domain": "art",
        "label": "Mission patches"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "K-pop workout playlists"
      },
      {
        "domain": "film",
        "label": "Disaster movies she fact-checks"
      },
      {
        "domain": "food",
        "label": "Buc-ees on road trips"
      }
    ],
    "works": [
      "sat console for a docking at 3am and kept her voice flat",
      "her checklist edit flew to orbit",
      "explains orbits with a hair tie and two oranges"
    ],
    "offer": null
  },
  {
    "slug": "marisol-interiano",
    "full_name": "Marisol Interiano",
    "username": "marisolinteriano",
    "discipline": "Immigration Lawyer",
    "crafts": [],
    "verified": true,
    "tagline": "papers change lives. she reads every line",
    "bio": "Salvadoran, Gulfton raised, first in her family with a bar card. She spends her days in immigration court and her evenings translating for whoever calls. Keeps a box of tissues and a box of pan dulce in her office. Both get used.",
    "tastes_public": [
      {
        "domain": "food",
        "label": "Pupusas de queso con loroco"
      },
      {
        "domain": "music",
        "label": "Cumbia at family parties"
      },
      {
        "domain": "place",
        "label": "Gulfton"
      },
      {
        "domain": "film",
        "label": "Documentaries"
      },
      {
        "domain": "art",
        "label": "Her clients' kids' drawings"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Bad Bunny in the car"
      },
      {
        "domain": "film",
        "label": "Courtroom dramas she yells at"
      },
      {
        "domain": "food",
        "label": "Vending machine hot fries"
      }
    ],
    "works": [
      "won an asylum case everyone said was dead",
      "gave the notario fraud talk at three churches this spring",
      "her mother's citizenship ceremony, front row"
    ],
    "offer": null
  },
  {
    "slug": "simone-guidry",
    "full_name": "Simone Guidry",
    "username": "simoneguidry",
    "discipline": "Public Defender",
    "crafts": [],
    "verified": false,
    "tagline": "everybody deserves somebody in their corner",
    "bio": "Public defender at the criminal courthouse downtown. Hundred-case load, zero quit. Creole on her daddy's side, Fifth Ward on her mama's, and she reads police reports looking for the note that does not fit.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Neo-soul"
      },
      {
        "domain": "food",
        "label": "Gumbo season"
      },
      {
        "domain": "place",
        "label": "Frenchtown"
      },
      {
        "domain": "film",
        "label": "12 Angry Men"
      },
      {
        "domain": "style",
        "label": "Thrifted blazers"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Trap while filing motions"
      },
      {
        "domain": "food",
        "label": "Cold pizza breakfast"
      },
      {
        "domain": "sport",
        "label": "Boxing gym at 6am"
      }
    ],
    "works": [
      "hung a jury with one cross-examination",
      "keeps every thank-you letter from clients",
      "argued a motion the morning after a flood"
    ],
    "offer": null
  },
  {
    "slug": "emeka-adiele",
    "full_name": "Emeka Adiele",
    "username": "emekapaints",
    "discipline": "ER Physician",
    "crafts": [],
    "verified": true,
    "tagline": "chaos is a rhythm once you hear it",
    "bio": "Emergency physician at the Medical Center, nights mostly. Igbo name, Alief upbringing, steady hands. On Sundays he paints small canvases of the bayou and tells nobody at work.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Jazz"
      },
      {
        "domain": "music",
        "label": "Highlife"
      },
      {
        "domain": "art",
        "label": "Impressionists"
      },
      {
        "domain": "food",
        "label": "Egusi soup"
      },
      {
        "domain": "place",
        "label": "Buffalo Bayou at sunrise"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Afrobeats gym sets"
      },
      {
        "domain": "film",
        "label": "Medical dramas, hate-watching"
      },
      {
        "domain": "food",
        "label": "Skittles in his scrub pocket"
      }
    ],
    "works": [
      "worked the night of the freeze and slept after",
      "hung one painting in the break room, anonymous",
      "coached his nephew's soccer team to one win"
    ],
    "offer": null
  },
  {
    "slug": "dima-haddad",
    "full_name": "Dima Haddad",
    "username": "dimahaddad",
    "discipline": "Pediatrician",
    "crafts": [],
    "verified": false,
    "tagline": "small patients, big opinions",
    "bio": "Pediatrician on the southwest side with a waiting room in four languages. Beirut born, Houston made, twenty years of ear infections and first steps. She keeps stickers in her coat like other people keep business cards.",
    "tastes_public": [
      {
        "domain": "food",
        "label": "Her teta's kibbeh"
      },
      {
        "domain": "music",
        "label": "Fairuz mornings"
      },
      {
        "domain": "place",
        "label": "Rice Village on foot"
      },
      {
        "domain": "film",
        "label": "Old Egyptian comedies"
      },
      {
        "domain": "art",
        "label": "Calligraphy"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Umm Kulthum, full length"
      },
      {
        "domain": "food",
        "label": "Chocolate hidden from her kids"
      },
      {
        "domain": "style",
        "label": "Crocs and proud"
      }
    ],
    "works": [
      "caught a rare diagnosis a scan missed",
      "vaccinated a whole daycare in one afternoon",
      "her exam room wall is 300 crayon drawings deep"
    ],
    "offer": null
  },
  {
    "slug": "kristine-villanueva",
    "full_name": "Kristine Villanueva",
    "username": "kristine.rn",
    "discipline": "ICU Nurse",
    "crafts": [],
    "verified": false,
    "tagline": "night shift raised me",
    "bio": "Night-shift ICU nurse, third of four sisters, all nurses like their mother. She has held more hands at 3am than anyone she knows. Karaoke machine in the garage, videoke scores settled like court rulings.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Karaoke ballads"
      },
      {
        "domain": "food",
        "label": "Lumpia at every gathering"
      },
      {
        "domain": "place",
        "label": "Galveston day trips"
      },
      {
        "domain": "film",
        "label": "Filipino teleseryes"
      },
      {
        "domain": "sport",
        "label": "Boxing pay-per-views"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Air Supply, no shame"
      },
      {
        "domain": "food",
        "label": "Spam and rice at 4am"
      },
      {
        "domain": "film",
        "label": "Korean dramas till sunrise"
      }
    ],
    "works": [
      "talked a family through the worst night of their lives",
      "perfect attendance through two hurricanes",
      "garage videoke champion three christmases running"
    ],
    "offer": null
  },
  {
    "slug": "ismael-cardenas",
    "full_name": "Ismael Cardenas",
    "username": "mrcardenasart",
    "discipline": "HISD Art Teacher",
    "crafts": [],
    "verified": false,
    "tagline": "every kid draws until somebody tells them to stop",
    "bio": "Art teacher at an East End elementary, twelve years in the same room. He spends his own money on tempera and has no regrets he will admit to. Shows his fifth graders Studio Ghibli on the last day, every year.",
    "tastes_public": [
      {
        "domain": "film",
        "label": "Studio Ghibli"
      },
      {
        "domain": "art",
        "label": "Student work, honestly"
      },
      {
        "domain": "music",
        "label": "Chente on Saturday mornings"
      },
      {
        "domain": "food",
        "label": "Elote after the game"
      },
      {
        "domain": "place",
        "label": "Moody Park"
      }
    ],
    "tastes_private": [
      {
        "domain": "art",
        "label": "His own unfinished canvases"
      },
      {
        "domain": "music",
        "label": "Metal from high school"
      },
      {
        "domain": "film",
        "label": "Anime deeper than Ghibli"
      }
    ],
    "works": [
      "his classroom mural has survived twelve summers",
      "took 30 kids to a museum, lost zero",
      "sold nothing, taught thousands"
    ],
    "offer": null
  },
  {
    "slug": "nelson-argueta",
    "full_name": "Nelson Argueta",
    "username": "coachargueta",
    "discipline": "High School Math Teacher",
    "crafts": [],
    "verified": false,
    "tagline": "show your work, mark your man",
    "bio": "Algebra by day, soccer after the last bell. Came from San Salvador at nine, learned English off box scores and lesson plans. His varsity squad speaks five languages and defends like one wall.",
    "tastes_public": [
      {
        "domain": "sport",
        "label": "Sunday league soccer"
      },
      {
        "domain": "music",
        "label": "Cumbia"
      },
      {
        "domain": "food",
        "label": "Pupusas after a win"
      },
      {
        "domain": "place",
        "label": "Sharpstown"
      },
      {
        "domain": "film",
        "label": "Underdog sports movies"
      }
    ],
    "tastes_private": [
      {
        "domain": "sport",
        "label": "Fantasy premier league"
      },
      {
        "domain": "food",
        "label": "Teacher lounge donuts"
      },
      {
        "domain": "music",
        "label": "Boleros when grading"
      }
    ],
    "works": [
      "district title with a squad of freshmen",
      "tutored a kid from failing to engineering school",
      "still runs the cones himself"
    ],
    "offer": null
  },
  {
    "slug": "reggie-duplechain",
    "full_name": "Reggie Duplechain",
    "username": "reggiecpa",
    "discipline": "CPA",
    "crafts": [],
    "verified": false,
    "tagline": "your books tell the truth. let's hear it",
    "bio": "CPA with an office in Midtown and roots in Acres Homes. He does taxes for barbers, taco trucks, and touring DJs, and he has seen it all arrive in a shoebox of receipts. Believes a clean ledger is a form of self-respect.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "Entrepreneurship"
      },
      {
        "domain": "music",
        "label": "UGK on the drive home"
      },
      {
        "domain": "food",
        "label": "Smoked turkey legs"
      },
      {
        "domain": "sport",
        "label": "Golf, badly"
      },
      {
        "domain": "place",
        "label": "Acres Homes"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Zydeco from his uncle's yard"
      },
      {
        "domain": "film",
        "label": "Westerns on saturday"
      },
      {
        "domain": "style",
        "label": "Gators for tax season"
      }
    ],
    "works": [
      "kept a food truck alive through an audit",
      "teaches a free tax basics class every january",
      "his uncle's trail ride does its books right now"
    ],
    "offer": null
  },
  {
    "slug": "claire-voss",
    "full_name": "Claire Voss",
    "username": "clairevoss",
    "discipline": "Urban Planner",
    "crafts": [],
    "verified": false,
    "tagline": "houston is a great city trapped in a parking lot",
    "bio": "Transit planner who moved here for the job and stayed for the city everyone underestimates. She counts sidewalk widths on vacation. Wants Houston walkable before her knees give out.",
    "tastes_public": [
      {
        "domain": "place",
        "label": "Heights hike and bike trail"
      },
      {
        "domain": "art",
        "label": "Old transit maps"
      },
      {
        "domain": "music",
        "label": "Indie folk"
      },
      {
        "domain": "food",
        "label": "Farmers market peaches"
      },
      {
        "domain": "film",
        "label": "Documentaries about cities"
      }
    ],
    "tastes_private": [
      {
        "domain": "sport",
        "label": "Roller derby, retired"
      },
      {
        "domain": "food",
        "label": "Drive-thru she won't name"
      },
      {
        "domain": "music",
        "label": "Country radio, secretly"
      }
    ],
    "works": [
      "got one crosswalk built. it took three years",
      "walks every new sidewalk the week it pours",
      "her bus route memo made it to a council agenda"
    ],
    "offer": null
  },
  {
    "slug": "grant-mabry",
    "full_name": "Grant Mabry",
    "username": "grantmabry",
    "discipline": "Landscape Architect",
    "crafts": [],
    "verified": false,
    "tagline": "plant natives or keep mowing, your call",
    "bio": "Landscape architect who thinks in watersheds. He has spent a decade putting prairie back into medians and drainage ditches, one stubborn acre at a time. His truck bed is always full of mulch and opinions.",
    "tastes_public": [
      {
        "domain": "place",
        "label": "Buffalo Bayou Park"
      },
      {
        "domain": "art",
        "label": "Land art"
      },
      {
        "domain": "food",
        "label": "Tomatoes off his own vine"
      },
      {
        "domain": "music",
        "label": "Willie on the porch"
      },
      {
        "domain": "sport",
        "label": "Fly fishing the Guadalupe"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Yacht rock while weeding"
      },
      {
        "domain": "film",
        "label": "Nature docs he falls asleep to"
      },
      {
        "domain": "food",
        "label": "Gas station taquitos"
      }
    ],
    "works": [
      "turned a detention pond into a pocket prairie",
      "his median planting survived two droughts",
      "gives away milkweed like other people give advice"
    ],
    "offer": {
      "kind": "service",
      "title": "Backyard native planting plan, one visit",
      "price_usd": 240
    }
  },
  {
    "slug": "itzel-guerra",
    "full_name": "Itzel Guerra",
    "username": "itzelguerra",
    "discipline": "Medical Student",
    "crafts": [],
    "verified": false,
    "tagline": "step one down, everything else pending",
    "bio": "Third-year med student at the Medical Center, first in her family past high school. She studies flashcards on the light rail and resets her brain on dance floors. Wants peds, keeps an open mind.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "House"
      },
      {
        "domain": "place",
        "label": "The light rail, honestly"
      },
      {
        "domain": "food",
        "label": "Her abuela's caldo"
      },
      {
        "domain": "sport",
        "label": "Intramural volleyball"
      },
      {
        "domain": "film",
        "label": "Coming-of-age movies"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Corridos tumbados"
      },
      {
        "domain": "food",
        "label": "Hot cheetos study fuel"
      },
      {
        "domain": "style",
        "label": "Scrubs as a personality"
      }
    ],
    "works": [
      "passed step one, cried, danced that weekend",
      "translated at the free clinic every saturday",
      "first white coat in the family photo"
    ],
    "offer": null
  },
  {
    "slug": "kaveh-alborzi",
    "full_name": "Kaveh Alborzi",
    "username": "kavehalborzi",
    "discipline": "Philosophy Lecturer",
    "crafts": [],
    "verified": true,
    "tagline": "the unexamined feed is not worth scrolling",
    "bio": "Philosophy lecturer. He teaches Stoics to twenty-year-olds and learns more from their questions than his notes. Keeps office hours at a Montrose coffee shop because doors intimidate people.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "Philosophy"
      },
      {
        "domain": "music",
        "label": "Persian classical"
      },
      {
        "domain": "food",
        "label": "Tahdig worth fighting over"
      },
      {
        "domain": "place",
        "label": "Rothko Chapel"
      },
      {
        "domain": "film",
        "label": "Slow cinema"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Googoosh"
      },
      {
        "domain": "film",
        "label": "Action movies, gleefully"
      },
      {
        "domain": "sport",
        "label": "Table tennis, ruthless"
      }
    ],
    "works": [
      "his intro course has a waitlist every fall",
      "wrote a book eleven people read and one loved",
      "hosts a free socrates cafe the first sunday of the month"
    ],
    "offer": null
  },
  {
    "slug": "aurelio-zepeda",
    "full_name": "Aurelio Zepeda",
    "username": "aureliozepeda",
    "discipline": "Firefighter",
    "crafts": [],
    "verified": false,
    "tagline": "run toward it. that's the whole job",
    "bio": "Firefighter out of a Magnolia Park station, fourteen years on trucks. He cooks for the shift, coaches his daughter's softball team, and prays before every tour. The job taught him what matters. The neighborhood already knew.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "Faith"
      },
      {
        "domain": "food",
        "label": "Station house carne guisada"
      },
      {
        "domain": "sport",
        "label": "Softball with his daughter"
      },
      {
        "domain": "music",
        "label": "Ramon Ayala on the grill"
      },
      {
        "domain": "place",
        "label": "Magnolia Park"
      }
    ],
    "tastes_private": [
      {
        "domain": "film",
        "label": "Firefighter movies he mocks"
      },
      {
        "domain": "music",
        "label": "Christian rock in the truck"
      },
      {
        "domain": "food",
        "label": "Menudo only when his mom makes it"
      }
    ],
    "works": [
      "pulled a family of five out during the freeze",
      "cooks for 12 firefighters on a budget of nothing",
      "his daughter's team went undefeated, he cried"
    ],
    "offer": null
  },
  {
    "slug": "tamika-renfro",
    "full_name": "Tamika Renfro",
    "username": "tamikarenfro",
    "discipline": "School Social Worker",
    "crafts": [],
    "verified": false,
    "tagline": "kids don't need saving, they need showing up",
    "bio": "School social worker in Sunnyside, born and raised three streets from her office. She keeps snacks, bus fare, and a straight face for whatever walks in. Twenty years of small saves nobody ever hears about.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Gospel Sundays"
      },
      {
        "domain": "food",
        "label": "Soul food after church"
      },
      {
        "domain": "place",
        "label": "Sunnyside"
      },
      {
        "domain": "film",
        "label": "Feel-good movies, unapologetic"
      },
      {
        "domain": "art",
        "label": "Quilting with her aunties"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "90s R&B slow jams"
      },
      {
        "domain": "sport",
        "label": "Wrestling pay-per-views"
      },
      {
        "domain": "food",
        "label": "Chili cheese fritos"
      }
    ],
    "works": [
      "kept a kid in school through a whole eviction",
      "her office fridge feeds more than her house",
      "twenty years, same neighborhood, same phone number"
    ],
    "offer": null
  },
  {
    "slug": "beto-carranza",
    "full_name": "Beto Carranza",
    "username": "betofucho",
    "discipline": "Sunday league striker",
    "crafts": [],
    "verified": false,
    "tagline": "if the game is at 8, i'm there at 7:40",
    "bio": "Fixes AC units all week so his Sundays stay free. Striker for a 7v7 team out of Magnolia Park that has never once had matching jerseys. Keeps his boots in the trunk in case somebody needs a tenth man.",
    "tastes_public": [
      {
        "domain": "sport",
        "label": "Pickup soccer"
      },
      {
        "domain": "food",
        "label": "Tacos de trompo"
      },
      {
        "domain": "music",
        "label": "Cumbias"
      },
      {
        "domain": "place",
        "label": "Mason Park fields"
      },
      {
        "domain": "film",
        "label": "Rocky movies"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Old Juan Gabriel songs"
      },
      {
        "domain": "film",
        "label": "Telenovelas with his mom"
      },
      {
        "domain": "food",
        "label": "Cold pizza breakfast"
      }
    ],
    "works": [
      "sunday league hat trick, still not over it",
      "runs the 60-man fucho whatsapp, never misses a poll",
      "taught his daughter to juggle before she could read"
    ],
    "offer": null
  },
  {
    "slug": "imani-broussard",
    "full_name": "Imani Broussard",
    "username": "imani.atthefunction",
    "discipline": "At every show, plays nothing",
    "crafts": [],
    "verified": false,
    "tagline": "somebody has to be the crowd",
    "bio": "Front row at everything from warehouse house nights to backyard punk. Plays no instrument, sells no art, remembers every opener's name. The scene runs on people like her and she knows it.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "House"
      },
      {
        "domain": "music",
        "label": "Neo soul"
      },
      {
        "domain": "place",
        "label": "EaDo"
      },
      {
        "domain": "art",
        "label": "Concert posters"
      },
      {
        "domain": "food",
        "label": "Late night pho"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Pop punk from middle school"
      },
      {
        "domain": "film",
        "label": "Reality dating shows"
      },
      {
        "domain": "style",
        "label": "Same black tee, five copies"
      }
    ],
    "works": [
      "caught 43 shows last year, kept every wristband",
      "drove to austin on a tuesday for a set, back for the 6am shift",
      "the door guy at three venues knows her by name"
    ],
    "offer": null
  },
  {
    "slug": "deshawn-pruitt",
    "full_name": "Deshawn Pruitt",
    "username": "deshawnsoles",
    "discipline": "Sneaker collector",
    "crafts": [],
    "verified": false,
    "tagline": "wears size 10.5, hoards size 10.5",
    "bio": "Thirty-one pairs deep and remembers which ones came from camping out versus apps. Works logistics at the port and spends lunch breaks refreshing drop calendars. Slowly learning to let pairs go.",
    "tastes_public": [
      {
        "domain": "style",
        "label": "Retro Jordans"
      },
      {
        "domain": "music",
        "label": "Houston rap"
      },
      {
        "domain": "sport",
        "label": "Rockets basketball"
      },
      {
        "domain": "food",
        "label": "Turkey legs"
      },
      {
        "domain": "place",
        "label": "Sunnyside"
      }
    ],
    "tastes_private": [
      {
        "domain": "style",
        "label": "Toothbrush for the soles"
      },
      {
        "domain": "music",
        "label": "Slow jams while cleaning kicks"
      },
      {
        "domain": "film",
        "label": "Sneaker docs on repeat"
      }
    ],
    "works": [
      "camped out nine hours in 2019, still his grail",
      "turned a $180 pair into rent money once, no shame",
      "keeps og boxes stacked like a museum wall"
    ],
    "offer": {
      "kind": "product",
      "title": "Jordan 4 Military Black, size 10.5, worn twice, OG box and extra laces",
      "price_usd": 285
    }
  },
  {
    "slug": "karen-iraheta",
    "full_name": "Karen Iraheta",
    "username": "karenontheaux",
    "discipline": "Wants to learn to mix",
    "crafts": [],
    "verified": false,
    "tagline": "give me the aux and i'll show you",
    "bio": "Dental assistant from Gulfton whose pregame playlists have their own reputation. Stands behind the booth at house nights just watching hands. Nobody has offered her the decks yet, so she keeps showing up.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "House"
      },
      {
        "domain": "music",
        "label": "Cumbia rebajada"
      },
      {
        "domain": "art",
        "label": "Party flyers"
      },
      {
        "domain": "food",
        "label": "Pupusas"
      },
      {
        "domain": "place",
        "label": "Gulfton"
      }
    ],
    "tastes_private": [
      {
        "domain": "film",
        "label": "Y Tu Mama Tambien"
      },
      {
        "domain": "style",
        "label": "Thrifted band tees"
      },
      {
        "domain": "music",
        "label": "Imaginary setlists on the bus"
      }
    ],
    "works": [
      "made the 42-song blend that runs every pregame",
      "watched the same set three nights in a row to learn the hands",
      "saved $400 toward a controller she hasn't bought yet"
    ],
    "offer": null
  },
  {
    "slug": "regina-elizondo",
    "full_name": "Regina Elizondo",
    "username": "regia.enhouston",
    "discipline": "New in town",
    "crafts": [],
    "verified": false,
    "tagline": "monterrey raised, houston curious",
    "bio": "Moved from Monterrey in March for an energy job she almost turned down. Misses the mountains and is negotiating with the flatness. Collecting people faster than furniture.",
    "tastes_public": [
      {
        "domain": "food",
        "label": "Carne asada done right"
      },
      {
        "domain": "music",
        "label": "Norteno classics"
      },
      {
        "domain": "art",
        "label": "Entrepreneurship"
      },
      {
        "domain": "place",
        "label": "Buffalo Bayou at sunset"
      },
      {
        "domain": "sport",
        "label": "Padel"
      }
    ],
    "tastes_private": [
      {
        "domain": "food",
        "label": "Judges every tortilla quietly"
      },
      {
        "domain": "film",
        "label": "Rom coms in spanish"
      },
      {
        "domain": "place",
        "label": "Homesick for the cerro"
      }
    ],
    "works": [
      "said yes to the transfer in a parking lot phone call",
      "first cookout invite came from her mechanic",
      "learned houston has five weathers a day, the hard way"
    ],
    "offer": null
  },
  {
    "slug": "chidera-nwosu",
    "full_name": "Chidera Nwosu",
    "username": "chidera.fromlagos",
    "discipline": "New in town",
    "crafts": [],
    "verified": false,
    "tagline": "lagos energy on a grad student budget",
    "bio": "Chemical engineering PhD student who landed from Lagos with two suitcases and a rice cooker. Finds his people through church, football, and whoever laughs at his jokes. The heat feels like home, the distances do not.",
    "tastes_public": [
      {
        "domain": "film",
        "label": "Interstellar"
      },
      {
        "domain": "art",
        "label": "Faith"
      },
      {
        "domain": "music",
        "label": "Afrobeats"
      },
      {
        "domain": "sport",
        "label": "Premier league sundays"
      },
      {
        "domain": "food",
        "label": "Jollof rice, his mother's"
      }
    ],
    "tastes_private": [
      {
        "domain": "film",
        "label": "Nollywood comfort movies"
      },
      {
        "domain": "food",
        "label": "Suya cravings at midnight"
      },
      {
        "domain": "music",
        "label": "Country radio, reluctantly"
      }
    ],
    "works": [
      "defended his proposal, called his mum before his advisor emailed",
      "found a sunday league that plays like lagos",
      "hosted jollof night for his whole cohort"
    ],
    "offer": null
  },
  {
    "slug": "erin-maloney",
    "full_name": "Erin Maloney",
    "username": "erin.on.contract",
    "discipline": "New in town",
    "crafts": [],
    "verified": false,
    "tagline": "13-week contract, week 19 and counting",
    "bio": "ICU travel nurse from Columbus who took a med center contract on a whim. The contract was 13 weeks and she is on week 19. Something about this city will not let her book the next one.",
    "tastes_public": [
      {
        "domain": "sport",
        "label": "Pickleball"
      },
      {
        "domain": "place",
        "label": "Memorial Park"
      },
      {
        "domain": "food",
        "label": "Breakfast tacos, a convert"
      },
      {
        "domain": "music",
        "label": "Live anything"
      },
      {
        "domain": "art",
        "label": "Museum free thursdays"
      }
    ],
    "tastes_private": [
      {
        "domain": "film",
        "label": "Medical dramas, critiquing"
      },
      {
        "domain": "food",
        "label": "Skyline chili defense"
      },
      {
        "domain": "music",
        "label": "2000s pop punk"
      }
    ],
    "works": [
      "extended the contract instead of taking hawaii",
      "learned breakfast tacos are a food group",
      "found her third place at a coffee shop and never left"
    ],
    "offer": null
  },
  {
    "slug": "vivian-trinh",
    "full_name": "Vivian Trinh",
    "username": "vivruns",
    "discipline": "Sunrise runner",
    "crafts": [],
    "verified": false,
    "tagline": "5am miles before the city wakes up",
    "bio": "Pharmacist in Alief who runs the bayou loop before the heat gets a vote. Ran her first marathon in january, cried at mile 24, signed up for another the same week. Believes every problem shrinks at mile three.",
    "tastes_public": [
      {
        "domain": "sport",
        "label": "Marathon training"
      },
      {
        "domain": "place",
        "label": "Buffalo Bayou trails"
      },
      {
        "domain": "food",
        "label": "Banh mi post-run"
      },
      {
        "domain": "music",
        "label": "180 bpm playlists"
      },
      {
        "domain": "film",
        "label": "Sports documentaries"
      }
    ],
    "tastes_private": [
      {
        "domain": "food",
        "label": "Entire pint after long runs"
      },
      {
        "domain": "music",
        "label": "Paris by night reruns"
      },
      {
        "domain": "sport",
        "label": "Checks strava at red lights"
      }
    ],
    "works": [
      "first marathon in january, cried at mile 24",
      "runs the loop at 5am, waves at the same six people",
      "talked her dad into a 5k, he beat her"
    ],
    "offer": null
  },
  {
    "slug": "terrell-gaines",
    "full_name": "Terrell Gaines",
    "username": "tgbuckets",
    "discipline": "Pickup hoops regular",
    "crafts": [],
    "verified": false,
    "tagline": "got next since 2009",
    "bio": "Middle school counselor with a jumper that shows up on weekends. Has run the same saturday court for fifteen years and can tell you who is beefing before they know it themselves. Calls his own fouls, mostly.",
    "tastes_public": [
      {
        "domain": "sport",
        "label": "Pickup basketball"
      },
      {
        "domain": "music",
        "label": "UGK and everything after"
      },
      {
        "domain": "place",
        "label": "Third Ward"
      },
      {
        "domain": "food",
        "label": "Soul food sundays"
      },
      {
        "domain": "style",
        "label": "Vintage rockets gear"
      }
    ],
    "tastes_private": [
      {
        "domain": "film",
        "label": "Love and Basketball, yearly"
      },
      {
        "domain": "music",
        "label": "Slow jams after losses"
      },
      {
        "domain": "food",
        "label": "Kolaches by the dozen"
      }
    ],
    "works": [
      "fifteen years holding down the same saturday court",
      "coached the counselors team to a title only he remembers",
      "once scored 31 and mentions it sparingly"
    ],
    "offer": null
  },
  {
    "slug": "ramiro-salas",
    "full_name": "Ramiro Salas",
    "username": "ramiro.45s",
    "discipline": "Vinyl collector, strictly listening",
    "crafts": [],
    "verified": false,
    "tagline": "the records stay home and so do i, mostly",
    "bio": "Postal carrier with 800 records and zero interest in playing them for strangers. Hunts jazz and salsa dura pressings at estate sales across the east side. His living room is the venue and the guest list is small.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Jazz"
      },
      {
        "domain": "music",
        "label": "Salsa dura pressings"
      },
      {
        "domain": "art",
        "label": "Album cover art"
      },
      {
        "domain": "place",
        "label": "East End"
      },
      {
        "domain": "food",
        "label": "Cafe de olla"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Buys doubles, tells no one"
      },
      {
        "domain": "style",
        "label": "White gloves for first plays"
      },
      {
        "domain": "film",
        "label": "Rewatches high fidelity"
      }
    ],
    "works": [
      "found a mint pressing in a garage sale dollar bin",
      "800 records, alphabetized twice a year",
      "says no every time someone asks him to dj"
    ],
    "offer": null
  },
  {
    "slug": "alice-cheung",
    "full_name": "Alice Cheung",
    "username": "alice.eats.bellaire",
    "discipline": "Eats the whole city",
    "crafts": [],
    "verified": false,
    "tagline": "the spreadsheet has 212 restaurants and no end",
    "bio": "Accountant whose real ledger is a spreadsheet of 212 restaurants, ranked and annotated. Grew up above her family's Bellaire kitchen table arguing about which dumpling house fell off. Will drive forty minutes for the right bowl.",
    "tastes_public": [
      {
        "domain": "food",
        "label": "Regional chinese deep cuts"
      },
      {
        "domain": "food",
        "label": "Crawfish season"
      },
      {
        "domain": "place",
        "label": "Asiatown strip malls"
      },
      {
        "domain": "music",
        "label": "City pop while cooking"
      },
      {
        "domain": "film",
        "label": "Food documentaries"
      }
    ],
    "tastes_private": [
      {
        "domain": "food",
        "label": "Fast food fried chicken"
      },
      {
        "domain": "sport",
        "label": "Walks to justify dessert"
      },
      {
        "domain": "film",
        "label": "Cooking shows she never cooks from"
      }
    ],
    "works": [
      "the 212-row restaurant spreadsheet, color coded",
      "convinced four strangers to split a whole fish",
      "once flew home early for crawfish season"
    ],
    "offer": null
  },
  {
    "slug": "omar-haddad",
    "full_name": "Omar Haddad",
    "username": "omar.lastrow",
    "discipline": "Film buff, back row center",
    "crafts": [],
    "verified": false,
    "tagline": "credits mean you sit until the lights",
    "bio": "Pharmacy tech from Montrose who plans his weeks around repertory screenings. Saw Cinema Paradiso at fifteen and never fully recovered. Believes the theater is the last sacred room left.",
    "tastes_public": [
      {
        "domain": "film",
        "label": "Cinema Paradiso"
      },
      {
        "domain": "film",
        "label": "Interstellar"
      },
      {
        "domain": "place",
        "label": "Museum district"
      },
      {
        "domain": "music",
        "label": "Film scores"
      },
      {
        "domain": "food",
        "label": "His mother's kibbeh"
      }
    ],
    "tastes_private": [
      {
        "domain": "film",
        "label": "Fast and furious, all of them"
      },
      {
        "domain": "food",
        "label": "Gas station slushes"
      },
      {
        "domain": "music",
        "label": "Scores while grocery shopping"
      }
    ],
    "works": [
      "saw cinema paradiso at fifteen, never recovered",
      "keeps every ticket stub in a shoebox marked by year",
      "dragged six friends to a 3-hour subtitle film, five thanked him"
    ],
    "offer": null
  },
  {
    "slug": "ayana-fields",
    "full_name": "Ayana Fields",
    "username": "ayanagrows",
    "discipline": "Apartment jungle keeper",
    "crafts": [],
    "verified": false,
    "tagline": "63 plants, one bedroom, no regrets",
    "bio": "HR coordinator whose one-bedroom in Montrose holds 63 plants and counting. Names the difficult ones after her exes so the survival stakes feel right. Trades cuttings on her stoop like contraband.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "Botanical prints"
      },
      {
        "domain": "place",
        "label": "Community garden plots"
      },
      {
        "domain": "music",
        "label": "Soul while watering"
      },
      {
        "domain": "food",
        "label": "Farmers market hauls"
      },
      {
        "domain": "style",
        "label": "Overalls with pockets"
      }
    ],
    "tastes_private": [
      {
        "domain": "film",
        "label": "Plant rescue videos at 1am"
      },
      {
        "domain": "music",
        "label": "Sad girl playlists"
      },
      {
        "domain": "food",
        "label": "Cereal for dinner"
      }
    ],
    "works": [
      "revived a fern everyone pronounced dead",
      "63 plants in a one-bedroom, physics disagrees",
      "trades cuttings on the stoop like contraband"
    ],
    "offer": null
  },
  {
    "slug": "luisa-camacho",
    "full_name": "Luisa Camacho",
    "username": "luisabaila",
    "discipline": "Salsa social regular",
    "crafts": [],
    "verified": false,
    "tagline": "the floor knows me even when the week doesn't",
    "bio": "Colombian paralegal who has not missed a thursday social in three years. Does not compete, does not perform, just dances until her feet file a complaint. The week can do whatever it wants after that.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Salsa dura"
      },
      {
        "domain": "music",
        "label": "Vallenato on sundays"
      },
      {
        "domain": "place",
        "label": "Thursday socials"
      },
      {
        "domain": "food",
        "label": "Arepas after midnight"
      },
      {
        "domain": "style",
        "label": "Dance shoes in the tote"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Bachata, don't tell the purists"
      },
      {
        "domain": "film",
        "label": "Dance movie marathons"
      },
      {
        "domain": "food",
        "label": "Aguardiente on birthdays only"
      }
    ],
    "works": [
      "three years of thursdays, zero missed",
      "taught her abuela's steps to a stranger from ohio",
      "wore through four pairs of dance shoes"
    ],
    "offer": null
  },
  {
    "slug": "arjun-mehta",
    "full_name": "Arjun Mehta",
    "username": "arjun.sends",
    "discipline": "Weeknight wall climber",
    "crafts": [],
    "verified": false,
    "tagline": "chalk on the steering wheel again",
    "bio": "Actuary who found out at 29 that his brain shuts up on the wall. Climbs three nights a week, projects V5s, falls with increasing grace. Drives to the hill country when the walls feel too plastic.",
    "tastes_public": [
      {
        "domain": "sport",
        "label": "Bouldering"
      },
      {
        "domain": "place",
        "label": "Hill country weekends"
      },
      {
        "domain": "food",
        "label": "Post-climb tacos"
      },
      {
        "domain": "music",
        "label": "Lo-fi on the drive"
      },
      {
        "domain": "film",
        "label": "Climbing documentaries"
      }
    ],
    "tastes_private": [
      {
        "domain": "sport",
        "label": "Watches climbing comps at work"
      },
      {
        "domain": "food",
        "label": "Protein bar snob"
      },
      {
        "domain": "style",
        "label": "Same three t-shirts"
      }
    ],
    "works": [
      "first v5 after four months of falling",
      "learned to fall before he learned to send",
      "recruited half his office to the gym"
    ],
    "offer": null
  },
  {
    "slug": "huy-dang",
    "full_name": "Huy Dang",
    "username": "huycooks",
    "discipline": "Home cook chasing his mom's pho",
    "crafts": [],
    "verified": false,
    "tagline": "batch 37 and the broth still isn't hers",
    "bio": "IT help desk by day, stockpot by weekend. Thirty-seven batches of pho chasing a broth his mom refuses to write down. She says the recipe is in the hands, and he is starting to believe her.",
    "tastes_public": [
      {
        "domain": "food",
        "label": "Pho, the long way"
      },
      {
        "domain": "food",
        "label": "Alief strip mall gems"
      },
      {
        "domain": "music",
        "label": "Kitchen radio"
      },
      {
        "domain": "place",
        "label": "Alief"
      },
      {
        "domain": "film",
        "label": "Kung fu movies during simmer"
      }
    ],
    "tastes_private": [
      {
        "domain": "food",
        "label": "Instant noodles anyway"
      },
      {
        "domain": "music",
        "label": "Karaoke ballads alone"
      },
      {
        "domain": "film",
        "label": "Cooking anime"
      }
    ],
    "works": [
      "batch 37, closest one yet, mom said almost",
      "fed twelve people from one stockpot",
      "burned batch 4 into the family group chat forever"
    ],
    "offer": null
  },
  {
    "slug": "grady-wilcox",
    "full_name": "Grady Wilcox",
    "username": "gradypours",
    "discipline": "Home espresso obsessive",
    "crafts": [],
    "verified": false,
    "tagline": "dialing in is a lifestyle not a step",
    "bio": "High school chemistry teacher who treats espresso like a lab he finally controls. Roasts small batches in his garage in the Heights and logs every variable. Plays jazz records while dialing in, swears it changes the shot.",
    "tastes_public": [
      {
        "domain": "food",
        "label": "Single origin everything"
      },
      {
        "domain": "music",
        "label": "Jazz"
      },
      {
        "domain": "place",
        "label": "The Heights"
      },
      {
        "domain": "art",
        "label": "Latte art attempts"
      },
      {
        "domain": "style",
        "label": "Denim apron guy"
      }
    ],
    "tastes_private": [
      {
        "domain": "food",
        "label": "Drinks drip at work, quietly"
      },
      {
        "domain": "music",
        "label": "Yacht rock on saturdays"
      },
      {
        "domain": "sport",
        "label": "Disc golf, badly"
      }
    ],
    "works": [
      "roasted a batch good enough that a cafe asked twice",
      "the garage smells like ethiopia and he is proud",
      "spreadsheet of 214 shots, all annotated"
    ],
    "offer": null
  },
  {
    "slug": "mikaela-ramos",
    "full_name": "Mikaela Ramos",
    "username": "mika.on.the.mic",
    "discipline": "Karaoke room regular",
    "crafts": [],
    "verified": false,
    "tagline": "room 4, friday, you know the song",
    "bio": "Pediatric nurse from Sharpstown with a voice too big for the day job. Books the same karaoke room every friday like a standing reservation with herself. Never auditioned for anything and never will.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Power ballads"
      },
      {
        "domain": "music",
        "label": "OPM classics"
      },
      {
        "domain": "food",
        "label": "Lumpia at every party"
      },
      {
        "domain": "place",
        "label": "Sharpstown"
      },
      {
        "domain": "film",
        "label": "Musicals, all of them"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Practices runs in the car"
      },
      {
        "domain": "film",
        "label": "Talent shows on mute"
      },
      {
        "domain": "food",
        "label": "Halo-halo for breakfast"
      }
    ],
    "works": [
      "cleared a 96 on the machine, witnesses exist",
      "friday room 4 for six years running",
      "sang at her cousin's wedding, made the titas cry"
    ],
    "offer": null
  },
  {
    "slug": "elijah-sparks",
    "full_name": "Elijah Sparks",
    "username": "elijah.at.the.menil",
    "discipline": "Museum wanderer",
    "crafts": [],
    "verified": false,
    "tagline": "sundays are for standing still",
    "bio": "Bank teller from Third Ward who spends sundays at the Menil like other people do brunch. Sits with one painting for twenty minutes and calls it cheaper than therapy. Reads philosophy on the lawn until the light goes.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "Philosophy"
      },
      {
        "domain": "art",
        "label": "Rothko Chapel silence"
      },
      {
        "domain": "place",
        "label": "Museum district"
      },
      {
        "domain": "music",
        "label": "Ambient on headphones"
      },
      {
        "domain": "film",
        "label": "Slow cinema"
      }
    ],
    "tastes_private": [
      {
        "domain": "art",
        "label": "Sketches badly, keeps them"
      },
      {
        "domain": "music",
        "label": "Trap in the car, loud"
      },
      {
        "domain": "food",
        "label": "Vending machine honey buns"
      }
    ],
    "works": [
      "twenty minutes in front of one painting, twice a month",
      "read the stoics on the menil lawn in a heat advisory",
      "took his little brother, who pretended to hate it"
    ],
    "offer": null
  },
  {
    "slug": "cassie-ferro",
    "full_name": "Cassie Ferro",
    "username": "cassie.and.biscuit",
    "discipline": "Dog park regular",
    "crafts": [],
    "verified": false,
    "tagline": "biscuit made more friends here than i did",
    "bio": "Insurance adjuster whose rescue mutt Biscuit runs the 5pm shift at the dog park. She came for the dog's social life and accidentally built her own. Knows every dog's name and maybe six humans'.",
    "tastes_public": [
      {
        "domain": "place",
        "label": "Dog parks at golden hour"
      },
      {
        "domain": "sport",
        "label": "Slow jogs with biscuit"
      },
      {
        "domain": "food",
        "label": "Dog-friendly patios"
      },
      {
        "domain": "music",
        "label": "Country radio windows down"
      },
      {
        "domain": "art",
        "label": "Pet portrait commissions"
      }
    ],
    "tastes_private": [
      {
        "domain": "film",
        "label": "Dog movies, cries every time"
      },
      {
        "domain": "food",
        "label": "Shares her fries with the dog"
      },
      {
        "domain": "style",
        "label": "Leash matches her shoes"
      }
    ],
    "works": [
      "biscuit's gotcha day party drew 14 dogs",
      "learned every dog's name before the owners'",
      "organized the 5pm crew group chat"
    ],
    "offer": null
  },
  {
    "slug": "yesenia-cepeda",
    "full_name": "Yesenia Cepeda",
    "username": "yesithrifts",
    "discipline": "Serial thrifter",
    "crafts": [],
    "verified": false,
    "tagline": "$4 rack or nothing",
    "bio": "Receptionist who has not paid retail since 2019 and dresses better than everyone who does. Works the Long Point thrift circuit every saturday with a coffee and a plan. Finds you a jacket if you tell her your size once.",
    "tastes_public": [
      {
        "domain": "style",
        "label": "90s western wear"
      },
      {
        "domain": "place",
        "label": "Long point thrift circuit"
      },
      {
        "domain": "music",
        "label": "Tejano on the drive"
      },
      {
        "domain": "food",
        "label": "Elotes"
      },
      {
        "domain": "art",
        "label": "Mending and patching"
      }
    ],
    "tastes_private": [
      {
        "domain": "style",
        "label": "Hoards vintage buttons"
      },
      {
        "domain": "film",
        "label": "Telenovela fashion notes"
      },
      {
        "domain": "food",
        "label": "Drive-thru after big finds"
      }
    ],
    "works": [
      "found dead-stock ropers in her exact size for $9",
      "closet is 90 percent secondhand and 100 percent hers",
      "talked a stranger out of buying the wrong jacket"
    ],
    "offer": null
  },
  {
    "slug": "curtis-boone",
    "full_name": "Curtis Boone",
    "username": "curtis.plays.e4",
    "discipline": "Park chess regular",
    "crafts": [],
    "verified": false,
    "tagline": "sit down, clock's running",
    "bio": "Retired bus operator who holds a table at the park most evenings, blitz only. Teaches kids openings and hustles grown men who underestimate the hat. Says jazz and chess are the same argument in different rooms.",
    "tastes_public": [
      {
        "domain": "sport",
        "label": "Blitz chess"
      },
      {
        "domain": "music",
        "label": "Jazz"
      },
      {
        "domain": "place",
        "label": "Hermann Park"
      },
      {
        "domain": "food",
        "label": "Oxtails when they're right"
      },
      {
        "domain": "film",
        "label": "Westerns"
      }
    ],
    "tastes_private": [
      {
        "domain": "sport",
        "label": "Online chess under a fake name"
      },
      {
        "domain": "music",
        "label": "Smooth jazz, unapologetic"
      },
      {
        "domain": "food",
        "label": "Butterscotch candies"
      }
    ],
    "works": [
      "beat a rated player who laughed at the hat",
      "taught 30 years of kids the sicilian",
      "holds table three most evenings, weather permitting"
    ],
    "offer": null
  },
  {
    "slug": "lalo-zamarripa",
    "full_name": "Lalo Zamarripa",
    "username": "lalo.on.the.jetty",
    "discipline": "Weekend jetty fisherman",
    "crafts": [],
    "verified": false,
    "tagline": "the fish know my truck by now",
    "bio": "Machine shop foreman who drives to Galveston before dawn most saturdays. Fishes the granite jetties with his late father's rod and a cooler that comes home lighter than his mood. The catch is optional, the quiet is not.",
    "tastes_public": [
      {
        "domain": "sport",
        "label": "Jetty fishing"
      },
      {
        "domain": "place",
        "label": "Galveston at dawn"
      },
      {
        "domain": "food",
        "label": "Fried fish he caught himself"
      },
      {
        "domain": "music",
        "label": "Ranchera on the tailgate"
      },
      {
        "domain": "art",
        "label": "Hand-tied rigs"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Sad cumbias on the drive home"
      },
      {
        "domain": "food",
        "label": "Stops for kolaches, tells no one"
      },
      {
        "domain": "sport",
        "label": "Naps in the truck bed"
      }
    ],
    "works": [
      "limit of reds before 9am, once",
      "still uses his father's rod, re-wrapped twice",
      "taught three nephews to tie a uni knot"
    ],
    "offer": null
  },
  {
    "slug": "earnestine-culpepper",
    "full_name": "Earnestine Culpepper",
    "username": "miss.earnestine",
    "discipline": "Backyard gardener, 40 years deep",
    "crafts": [],
    "verified": false,
    "tagline": "the collards decide when i rest",
    "bio": "Retired school cafeteria manager growing collards, okra, and peppers on the same Sunnyside lot for forty years. Feeds half the block and takes payment in gossip. Church on sunday, soil on monday.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "Faith"
      },
      {
        "domain": "food",
        "label": "Garden-to-pot cooking"
      },
      {
        "domain": "place",
        "label": "Sunnyside"
      },
      {
        "domain": "music",
        "label": "Gospel radio"
      },
      {
        "domain": "style",
        "label": "Sun hats with history"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Zydeco when nobody's home"
      },
      {
        "domain": "food",
        "label": "Sweets she says she quit"
      },
      {
        "domain": "film",
        "label": "Game shows every evening"
      }
    ],
    "works": [
      "forty summers of okra on the same lot",
      "fed three households from one harvest",
      "her pepper sauce settles arguments"
    ],
    "offer": null
  },
  {
    "slug": "kelvin-suen",
    "full_name": "Kelvin Suen",
    "username": "kelvin.gg",
    "discipline": "Ranked grinder",
    "crafts": [],
    "verified": false,
    "tagline": "one more game is never one more game",
    "bio": "Pharmacy student who helps close his parents' Katy restaurant, then queues ranked till 2am. Hosts fighting game locals in the garage in months the budget allows. Ghibli movies are his tilt reset.",
    "tastes_public": [
      {
        "domain": "film",
        "label": "Studio Ghibli"
      },
      {
        "domain": "sport",
        "label": "Fighting game locals"
      },
      {
        "domain": "music",
        "label": "Video game soundtracks"
      },
      {
        "domain": "food",
        "label": "Late night congee"
      },
      {
        "domain": "place",
        "label": "Katy"
      }
    ],
    "tastes_private": [
      {
        "domain": "sport",
        "label": "Rewatches his own replays"
      },
      {
        "domain": "music",
        "label": "Anime openings at full volume"
      },
      {
        "domain": "food",
        "label": "Energy drink loyalty"
      }
    ],
    "works": [
      "hit the top rank tier during finals week, no regrets",
      "garage locals drew 22 people and broke one folding chair",
      "taught his mom one combo, she never forgot it"
    ],
    "offer": null
  },
  {
    "slug": "meera-pillai",
    "full_name": "Meera Pillai",
    "username": "meera.reads",
    "discipline": "Book club convener",
    "crafts": [],
    "verified": false,
    "tagline": "we did discuss the book, eventually",
    "bio": "Speech therapist who has run the same book club for six years across three apartments and two heartbreaks. Twelve members, real attendance, snacks are load-bearing. The book is the excuse, the table is the point.",
    "tastes_public": [
      {
        "domain": "art",
        "label": "Philosophy"
      },
      {
        "domain": "art",
        "label": "Annotated margins"
      },
      {
        "domain": "food",
        "label": "Load-bearing snack spreads"
      },
      {
        "domain": "place",
        "label": "Used bookstore basements"
      },
      {
        "domain": "music",
        "label": "Instrumentals while reading"
      }
    ],
    "tastes_private": [
      {
        "domain": "film",
        "label": "Watches adaptations first"
      },
      {
        "domain": "music",
        "label": "Boy bands from 2012"
      },
      {
        "domain": "food",
        "label": "Skips dinner for dessert"
      }
    ],
    "works": [
      "six years, 61 books, one club",
      "the meeting where nobody read it became legend",
      "matched two members who are now married"
    ],
    "offer": null
  },
  {
    "slug": "dario-belmontes",
    "full_name": "Dario Belmontes",
    "username": "dario.rides",
    "discipline": "Everyday cyclist",
    "crafts": [],
    "verified": false,
    "tagline": "two wheels beat the loop every time",
    "bio": "Landscape estimator who sold his second car and never looked back. Rides the last-friday group ride, the sunday coffee spin, and everywhere in between. Believes a city looks honest at 15 miles an hour.",
    "tastes_public": [
      {
        "domain": "sport",
        "label": "Group rides"
      },
      {
        "domain": "place",
        "label": "White Oak bayou trail"
      },
      {
        "domain": "food",
        "label": "Taco stops mid-ride"
      },
      {
        "domain": "music",
        "label": "Cumbia in one earbud"
      },
      {
        "domain": "style",
        "label": "Cap under the helmet"
      }
    ],
    "tastes_private": [
      {
        "domain": "sport",
        "label": "Judges bikes at red lights"
      },
      {
        "domain": "food",
        "label": "Gas station gatorade ritual"
      },
      {
        "domain": "film",
        "label": "Crash compilations, guiltily"
      }
    ],
    "works": [
      "sold the second car, bought a steel frame",
      "150 miles to austin on a charity ride, twice",
      "leads the no-drop ride for beginners"
    ],
    "offer": null
  },
  {
    "slug": "gracie-villarreal",
    "full_name": "Gracie Villarreal",
    "username": "gracie.keeps.score",
    "discipline": "Astros diehard, scorebook and all",
    "crafts": [],
    "verified": false,
    "tagline": "62 home games a season, in spirit or in seat",
    "bio": "Dental hygienist who keeps a paper scorebook for every game she attends and most she doesn't. Learned the habit from her grandfather in the dome years. Section 434 knows her by her rally towel.",
    "tastes_public": [
      {
        "domain": "sport",
        "label": "Astros baseball"
      },
      {
        "domain": "food",
        "label": "Ballpark dogs"
      },
      {
        "domain": "place",
        "label": "The dome, still mourned"
      },
      {
        "domain": "music",
        "label": "Walk-up song trivia"
      },
      {
        "domain": "film",
        "label": "Baseball movies"
      }
    ],
    "tastes_private": [
      {
        "domain": "sport",
        "label": "Still defends 2017 at dinner"
      },
      {
        "domain": "music",
        "label": "Tears at the seventh inning stretch"
      },
      {
        "domain": "food",
        "label": "Superstition snacks in order"
      }
    ],
    "works": [
      "the scorebook shelf goes back eleven seasons",
      "kept score of the clincher from her couch, full book",
      "grandpa's dome-era pennant hangs framed"
    ],
    "offer": null
  },
  {
    "slug": "percy-landry",
    "full_name": "Percy Landry",
    "username": "percy.boils",
    "discipline": "Backyard boil host",
    "crafts": [],
    "verified": false,
    "tagline": "the recipe is a secret and so is the guest cap",
    "bio": "Refinery operator from Kashmere Gardens whose spring boils feed eighty off two burners. The spice ratio came from an uncle in Lake Charles and it stays family. If you got the address text, you're family enough.",
    "tastes_public": [
      {
        "domain": "food",
        "label": "Crawfish, corn, whole garlic"
      },
      {
        "domain": "music",
        "label": "Zydeco and southern soul"
      },
      {
        "domain": "place",
        "label": "Kashmere Gardens"
      },
      {
        "domain": "sport",
        "label": "Dominoes at the boil"
      },
      {
        "domain": "style",
        "label": "Aprons with burn marks"
      }
    ],
    "tastes_private": [
      {
        "domain": "food",
        "label": "Eats the leftovers alone at 7am"
      },
      {
        "domain": "music",
        "label": "Slow blues while cleaning up"
      },
      {
        "domain": "film",
        "label": "Cooking competition yelling"
      }
    ],
    "works": [
      "spring boil number nine, eighty fed, zero leftovers",
      "two burners, one folding table, a whole block",
      "the group text for the address caps at 100"
    ],
    "offer": null
  },
  {
    "slug": "charlene-guillory",
    "full_name": "Charlene Guillory",
    "username": "charlene.twosteps",
    "discipline": "Zydeco sunday regular",
    "crafts": [],
    "verified": false,
    "tagline": "if there's a washboard i'm already up",
    "bio": "Hospital scheduler who two-steps every sunday afternoon like her parents did in Frenchtown. Saddles up with a trail ride crew every rodeo season. Keeps her boots in the car between dances.",
    "tastes_public": [
      {
        "domain": "music",
        "label": "Zydeco"
      },
      {
        "domain": "sport",
        "label": "Trail rides"
      },
      {
        "domain": "place",
        "label": "Frenchtown roots"
      },
      {
        "domain": "food",
        "label": "Boudin worth the drive"
      },
      {
        "domain": "style",
        "label": "Pressed jeans and clean boots"
      }
    ],
    "tastes_private": [
      {
        "domain": "music",
        "label": "Line dance tutorials at home"
      },
      {
        "domain": "food",
        "label": "Gas station boudin, forgive her"
      },
      {
        "domain": "film",
        "label": "Hallmark movies in december"
      }
    ],
    "works": [
      "danced till the band packed up, twice this year",
      "seventeen years riding with the same trail crew",
      "taught her nephew to two-step before prom"
    ],
    "offer": null
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
  if exists (select 1 from public.profiles where user_id like 'v10seed\_%') then
    raise notice 'v10 espectro batch already present — skipping';
    return;
  end if;

  ---------------------------------------------------------------------------
  -- 1–5 · per persona: profile + crafts + tastes + museum pieces + the offer
  --       (same anatomy as 0038 — the spectrum rides the exact same rails
  --        a creative does; where a rail has no slot for them, that absence
  --        stays visible on purpose)
  ---------------------------------------------------------------------------
  for p in select value from jsonb_array_elements(personas) loop
    v_uidsent := 'v10seed_' || (p->>'slug');

    insert into public.profiles
      (user_id, is_demo, full_name, username, city, discipline, tagline, bio, verified, taste, media, created_at)
    values (
      v_uidsent, true, p->>'full_name', p->>'username', 'Houston',
      p->>'discipline', p->>'tagline', p->>'bio', coalesce((p->>'verified')::boolean, false),
      -- legacy public taste (SOUND / SCREEN / INFLUENCES on the card + museum)
      jsonb_strip_nulls(jsonb_build_object(
        'music',      (select jsonb_agg(x->>'label') from jsonb_array_elements(p->'tastes_public') x where x->>'domain' = 'music'),
        'films',      (select jsonb_agg(x->>'label') from jsonb_array_elements(p->'tastes_public') x where x->>'domain' = 'film'),
        'influences', (select jsonb_agg(x->>'label') from jsonb_array_elements(p->'tastes_public') x where x->>'domain' in ('art','style','food','sport','place'))
      )),
      -- legacy media gallery (the Community card's "work" count)
      coalesce((select jsonb_agg(jsonb_build_object('caption', wv, 'url', '')) from jsonb_array_elements_text(p->'works') wv), '[]'::jsonb),
      now() - (floor(random() * 80)::int || ' days')::interval
    )
    returning id into v_id;

    -- crafts (first slug = primary) — empty for oficio/normales by design
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

    -- works → world_posts (the museum's dated timeline; for a normal person
    -- these read as life moments — that contrast is the design instrument)
    for w in select value from jsonb_array_elements_text(coalesce(p->'works','[]'::jsonb)) loop
      insert into public.world_posts (profile_id, caption, images, created_at)
      values (v_id, w, '[]'::jsonb, now() - (floor(random() * 50)::int || ' days')::interval);
    end loop;

    -- THE OFFER (kind: product→piece; price usd→cents, floored at the 100 min)
    if (p ? 'offer') and (p->'offer') is not null and jsonb_typeof(p->'offer') = 'object' and (p->'offer'->>'title') is not null then
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
  -- 6 · the social web — the spectrum is not an island: friendships inside
  --     the batch, bridges into the v9 creative batch (the architect knows
  --     the muralist — that is the whole thesis), close friends, follows,
  --     plus PENDING requests to the founders so day-one ACCEPT works
  ---------------------------------------------------------------------------
  -- accepted friendships: each spectrum seed befriends the next three
  insert into public.friendships (requester_id, addressee_id, status, responded_at)
  select a.id, b.id, 'accepted', now()
  from (select id, row_number() over (order by user_id) rn from public.profiles where user_id like 'v10seed\_%') a
  join (select id, row_number() over (order by user_id) rn from public.profiles where user_id like 'v10seed\_%') b
    on b.rn in (a.rn + 1, a.rn + 2, a.rn + 3)
  where a.id <> b.id
  on conflict (requester_id, addressee_id) do nothing;

  -- bridges into v9's creative batch: every third spectrum seed befriends
  -- one v9 creative (deterministic pairing — the room is ONE room)
  insert into public.friendships (requester_id, addressee_id, status, responded_at)
  select a.id, b.id, 'accepted', now()
  from (select id, row_number() over (order by user_id) rn from public.profiles where user_id like 'v10seed\_%') a
  join (select id, row_number() over (order by user_id) rn,
               count(*) over () as total
        from public.profiles where user_id like 'v9seed\_%' and deleted_at is null) b
    on b.rn = ((a.rn / 3 - 1) % b.total) + 1
  where a.rn % 3 = 0 and a.id <> b.id
  on conflict (requester_id, addressee_id) do nothing;

  -- pending requests waiting on Pato (day-one test: open Messages, ACCEPT —
  -- the fucho guy asking the founder to be friends IS the v10 thesis)
  insert into public.friendships (requester_id, addressee_id, status)
  select id, founder_pato, 'pending' from public.profiles
  where user_id in ('v10seed_beto-carranza', 'v10seed_ramiro-cepeda', 'v10seed_regina-elizondo') and id <> founder_pato
  on conflict (requester_id, addressee_id) do nothing;
  -- and a couple waiting on Diego
  insert into public.friendships (requester_id, addressee_id, status)
  select id, founder_diego, 'pending' from public.profiles
  where user_id in ('v10seed_norma-alvarenga', 'v10seed_imani-broussard') and id <> founder_diego
  on conflict (requester_id, addressee_id) do nothing;

  -- close friends: each spectrum seed pulls its first accepted friend close
  insert into public.close_friends (owner_id, friend_id)
  select distinct on (f.requester_id) f.requester_id, f.addressee_id
  from public.friendships f
  join public.profiles a on a.id = f.requester_id and a.user_id like 'v10seed\_%'
  where f.status = 'accepted'
  order by f.requester_id, f.addressee_id
  on conflict (owner_id, friend_id) do nothing;

  -- follows among the seed (mirrors the accepted graph, both batches) —
  -- never to a founder, so no real follower count is touched
  insert into public.follows (follower_id, followee_id)
  select f.requester_id, f.addressee_id
  from public.friendships f
  join public.profiles a on a.id = f.requester_id and a.user_id like 'v10seed\_%'
  join public.profiles b on b.id = f.addressee_id and (b.user_id like 'v10seed\_%' or b.user_id like 'v9seed\_%')
  where f.status = 'accepted'
  on conflict (follower_id, followee_id) do nothing;

  ---------------------------------------------------------------------------
  -- 7 · plans with rooms + RSVPs — the spectrum's real life: fucho, runs,
  --     boils, book clubs. This is what "anyone seeking real life" does.
  ---------------------------------------------------------------------------
  insert into public.plans (creator_id, title, spot, detail, starts_at, status, visibility)
  select pr.id, x.title, x.spot, x.detail, now() + (x.days || ' days')::interval, 'live', x.vis
  from (values
    ('beto-carranza', 'fucho sunday, bring shin guards', 'Bear Creek fields', 'first touch at 9, tacos after. losers buy.', '4', 'public'),
    ('vivian-trinh', 'sunrise run, buffalo bayou', 'Eleanor Tinsley Park', 'six am. no music, just the city waking up.', '3', 'public'),
    ('percy-landry', 'spring boil number ten', 'Kashmere Gardens backyard', 'two burners. bring a chair and a story.', '9', 'friends'),
    ('alice-cheung', 'asiatown crawl, five stops', 'Bellaire Blvd', 'wear stretchy pants. cash for the last stop.', '6', 'public'),
    ('meera-pillai', 'book club: chapters 1-9', 'Montrose coffee shop', 'bring one sentence you loved.', '7', 'friends'),
    ('arjun-mehta', 'wall night, beginners welcome', 'East End climbing gym', 'rentals covered for first-timers.', '2', 'public'),
    ('regina-elizondo', 'new to houston walk', 'Discovery Green', 'no agenda. we walk, we talk, we eat.', '5', 'public'),
    ('mikaela-ramos', 'karaoke room, no judgment', 'Spring Branch karaoke bar', 'ballads encouraged. costumes optional.', '8', 'close')
  ) x(cslug, title, spot, detail, days, vis)
  join public.profiles pr on pr.user_id = 'v10seed_' || x.cslug;

  -- a room for each spectrum plan (mirrors create_plan's thread)
  insert into public.threads (kind, plan_id, title, created_by)
  select 'plan', pl.id, left(pl.title, 60), pl.creator_id
  from public.plans pl
  where pl.creator_id in (select id from public.profiles where user_id like 'v10seed\_%')
    and not exists (select 1 from public.threads th where th.plan_id = pl.id);

  -- the creator is IN their own plan
  insert into public.plan_members (plan_id, profile_id, status, responded_at)
  select pl.id, pl.creator_id, 'in', now()
  from public.plans pl
  where pl.creator_id in (select id from public.profiles where user_id like 'v10seed\_%')
  on conflict (plan_id, profile_id) do nothing;

  -- invite a few spectrum friends into each plan, with a spread of RSVPs
  insert into public.plan_members (plan_id, profile_id, status, invited_by)
  select pl.id, s.id,
    (array['in','maybe','invited','in'])[(1 + (s.rn % 4))::int],
    pl.creator_id
  from public.plans pl
  join public.profiles c on c.id = pl.creator_id and c.user_id like 'v10seed\_%'
  cross join lateral (
    select id, row_number() over (order by user_id) rn
    from public.profiles where user_id like 'v10seed\_%' and id <> pl.creator_id
    order by user_id limit 4
  ) s
  on conflict (plan_id, profile_id) do nothing;

  -- every plan member joins the plan's room
  insert into public.thread_members (thread_id, profile_id)
  select th.id, pm.profile_id
  from public.plan_members pm
  join public.plans pl on pl.id = pm.plan_id and pl.creator_id in (select id from public.profiles where user_id like 'v10seed\_%')
  join public.threads th on th.plan_id = pl.id
  on conflict do nothing;

  ---------------------------------------------------------------------------
  -- 8 · buyers on the DRAFT test event — the show-goer and the newcomer buy
  --     tickets too (proves the cohort path across the spectrum; excluded
  --     from every count by is_demo — guardrail 2)
  ---------------------------------------------------------------------------
  insert into public.tickets (event_id, buyer_id, buyer_email, buyer_name, quantity, price_paid, status)
  select test_event, s.id, coalesce(s.username, 'seed') || '@seed.local', s.full_name, 1, 2500, 'confirmed'
  from public.profiles s
  where s.user_id in ('v10seed_imani-broussard', 'v10seed_regina-elizondo', 'v10seed_chidera-nwosu', 'v10seed_erin-maloney', 'v10seed_deshawn-pruitt', 'v10seed_karen-iraheta', 'v10seed_elijah-sparks', 'v10seed_gracie-villarreal');

  raise notice 'v10 espectro batch planted';
end;
$seed$;

commit;

-- =====================================================================
-- VERIFY (after push):
--   -- planted:  select count(*) from profiles where user_id like 'v10seed\_%';  -- ~60
--   -- invisible: (anon) GET /rest/v1/profiles?is_demo=eq.true                    -> []
--   -- uncounted: confirmed_count unchanged; cohorts exclude is_demo
--   -- purgable:  admin_seed_count() includes the batch; admin_purge_seed() reaches it
--   -- labeled:   founder + SHOW SEED -> for-you rows carry is_demo (0040) + ◇ card
-- =====================================================================
