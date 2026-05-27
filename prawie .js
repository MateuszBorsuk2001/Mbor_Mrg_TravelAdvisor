
const R = 6371000;

const PHRASE_TO_CATEGORIES = {
  'restauracja wegetarianska': ['catering.restaurant'],
  'restaurant vegetarien': ['catering.restaurant'],
  'vegetarian restaurant': ['catering.restaurant'],
  'restauracja': ['catering.restaurant'],
  'restaurant': ['catering.restaurant'],
  'restaurants': ['catering.restaurant'],
  'jedzenie': ['catering.restaurant', 'catering.cafe'],
  'food': ['catering.restaurant', 'catering.cafe'],
  'eat': ['catering.restaurant', 'catering.cafe'],
  'eating': ['catering.restaurant', 'catering.cafe'],
  'kawiarnia': ['catering.cafe'],
  'cafe': ['catering.cafe'],
  'coffee': ['catering.cafe'],
  'kawa': ['catering.cafe'],
  'bar': ['catering.bar'],
  'pub': ['catering.pub'],
  'fast food': ['catering.fast_food'],
  'szybkie jedzenie': ['catering.fast_food'],
  'pizza': ['catering.fast_food.pizza'],
  'burger': ['catering.fast_food.burger'],
  'hotel': ['accommodation.hotel'],
  'hotele': ['accommodation.hotel'],
  'nocleg': ['accommodation'],
  'accommodation': ['accommodation'],
  'hostel': ['accommodation.hostel'],
  'apartament': ['accommodation.apartment'],
  'apartment': ['accommodation.apartment'],
  'camping': ['camping.camp_site'],
  'pole namiotowe': ['camping.camp_site'],
  'supermarket': ['commercial.supermarket'],
  'sklep': ['commercial.supermarket', 'commercial'],
  'grocery': ['commercial.supermarket'],
  'apteka': ['healthcare.pharmacy'],
  'pharmacy': ['healthcare.pharmacy'],
  'galeria': ['commercial.shopping_mall'],
  'mall': ['commercial.shopping_mall'],
  'centrum handlowe': ['commercial.shopping_mall'],
  'stacja benzynowa': ['service.vehicle.fuel'],
  'gas station': ['service.vehicle.fuel'],
  'fuel': ['service.vehicle.fuel'],
  'benzyna': ['service.vehicle.fuel'],
  'parking': ['parking'],
  'ladowarka': ['service.vehicle.charging_station'],
  'charging station': ['service.vehicle.charging_station'],
  'ev charger': ['service.vehicle.charging_station'],
  'metro': ['public_transport.subway'],
  'subway': ['public_transport.subway'],
  'pociag': ['public_transport.train'],
  'train': ['public_transport.train'],
  'train station': ['public_transport.train'],
  'autobus': ['public_transport.bus'],
  'bus': ['public_transport.bus'],
  'bus stop': ['public_transport.bus'],
  'transport publiczny': ['public_transport.train', 'public_transport.bus', 'public_transport.subway'],
  'public transport': ['public_transport.train', 'public_transport.bus', 'public_transport.subway'],
  'szpital': ['healthcare.hospital'],
  'hospital': ['healthcare.hospital'],
  'dentysta': ['healthcare.dentist'],
  'dentist': ['healthcare.dentist'],
  'przychodnia': ['healthcare.clinic_or_praxis'],
  'clinic': ['healthcare.clinic_or_praxis'],
  'muzeum': ['entertainment.museum'],
  'museum': ['entertainment.museum'],
  'museums': ['entertainment.museum'],
  'park': ['leisure.park'],
  'parks': ['leisure.park'],
  'kino': ['entertainment.cinema'],
  'cinema': ['entertainment.cinema'],
  'silownia': ['sport.fitness'],
  'gym': ['sport.fitness'],
  'fitness': ['sport.fitness'],
  'basen': ['sport.swimming_pool'],
  'swimming pool': ['sport.swimming_pool'],
  'plaza': ['beach'],
  'beach': ['beach'],
  'morze': ['beach'],
  'morza': ['beach'],
  'moze': ['beach'],
  'sea': ['beach'],
  'seas': ['beach'],
  'ocean': ['beach'],
  'wybrzeze': ['beach'],
  'coast': ['beach'],
  'coastline': ['beach'],
  'shore': ['beach'],
  'nad morzem': ['beach'],
  'by the sea': ['beach'],
  'plaze': ['beach'],
  'beaches': ['beach'],
  'bankomat': ['service.financial.atm'],
  'atm': ['service.financial.atm'],
  'bank': ['service.financial.bank'],
  'poczta': ['service.post.office'],
  'post office': ['service.post.office'],
  'taksowka': ['service.taxi'],
  'taxi': ['service.taxi'],
  'zabytki': ['tourism.sights'],
  'attractions': ['tourism.attraction'],
  'atrakcje': ['tourism.attraction'],
  'tourism': ['tourism.attraction', 'tourism.sights'],
  'turystyka': ['tourism.attraction', 'tourism.sights'],
  'kosciol': ['tourism.sights.place_of_worship'],
  'church': ['tourism.sights.place_of_worship'],
  'zoo': ['entertainment.zoo'],
  'aquarium': ['entertainment.aquarium'],
  'akwarium': ['entertainment.aquarium'],
};

const KNOWN_BUCKETS_SORTED = (function () {
  const s = new Set();
  for (const ph in PHRASE_TO_CATEGORIES) {
    if (!Object.prototype.hasOwnProperty.call(PHRASE_TO_CATEGORIES, ph)) continue;
    const arr = PHRASE_TO_CATEGORIES[ph];
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < arr.length; i++) {
      if (typeof arr[i] === 'string') s.add(arr[i]);
    }
  }
  return Array.from(s).sort(function (a, b) {
    if (b.length !== a.length) return b.length - a.length;
    return a < b ? -1 : a > b ? 1 : 0;
  });
})();

function haversineMeters(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function collectFeatureRoots(raw) {
  if (!raw || typeof raw !== 'object') return [];
  if (Array.isArray(raw)) {
    if (raw.length && raw[0] && raw[0].type === 'Feature') return raw;
    let out = [];
    for (const x of raw) out = out.concat(collectFeatureRoots(x));
    return out;
  }
  if (raw.type === 'Feature') return [raw];
  if (raw.type === 'FeatureCollection' && Array.isArray(raw.features)) return raw.features;
  if (Array.isArray(raw.features)) return raw.features;
  if (Array.isArray(raw.results)) return collectFeatureRoots(raw.results);
  if (Array.isArray(raw.data)) return collectFeatureRoots(raw.data);
  if (Array.isArray(raw.body)) return collectFeatureRoots(raw.body);
  return [];
}

function normalizedCategoryList(entity) {
  const p = entity.properties ? entity.properties : {};
  let arr = null;
  if (entity.geoapifyParams && entity.geoapifyParams.categories) {
    arr = entity.geoapifyParams.categories;
  } else if (p.categories) {
    arr = p.categories;
  } else if (entity.categories) {
    arr = entity.categories;
  }

  if (typeof arr === 'string') {
    arr = arr.split(',').map(function (s) {
      return s.trim();
    }).filter(Boolean);
  }

  if (!Array.isArray(arr)) return [];

  const strings = arr
    .filter(function (x) {
      return typeof x === 'string';
    })
    .map(function (x) {
      return x.trim();
    })
    .filter(Boolean);

  const uniq = [];
  for (let i = 0; i < strings.length; i++) {
    if (uniq.indexOf(strings[i]) === -1) uniq.push(strings[i]);
  }
  uniq.sort();
  return uniq;
}

function categorySignature(entity) {
  const list = normalizedCategoryList(entity);
  if (!list.length) return '__no_categories';
  return list.join('|');
}

function coordsFromEntity(f, parentJson) {
  const p = f.properties ? f.properties : {};
  let lat = Number(p.lat);
  let lon = Number(p.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const g = f.geometry && f.geometry.coordinates;
    if (Array.isArray(g) && g.length >= 2) {
      lon = Number(g[0]);
      lat = Number(g[1]);
    }
  }
  if (parentJson && (!Number.isFinite(lat) || !Number.isFinite(lon))) {
    const pl = Number(parentJson.lat);
    const po = Number(parentJson.lon);
    if (Number.isFinite(pl) && Number.isFinite(po)) {
      lat = pl;
      lon = po;
    }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat: lat, lon: lon };
}

function primaryBucketFromCategories(categories) {
  let best = null;
  let bestLen = -1;
  for (let ci = 0; ci < categories.length; ci++) {
    const c = categories[ci];
    for (let ki = 0; ki < KNOWN_BUCKETS_SORTED.length; ki++) {
      const k = KNOWN_BUCKETS_SORTED[ki];
      if (c === k || c.startsWith(k + '.')) {
        if (k.length > bestLen || (k.length === bestLen && best !== null && k < best)) {
          bestLen = k.length;
          best = k;
        }
        break;
      }
    }
  }
  if (best !== null) return best;
  return '__unknown__:' + categories.join('|');
}

const annotated = [];
let wi = 0;

for (let ii = 0; ii < $input.all().length; ii++) {
  const item = $input.all()[ii];
  const j = item.json;
  const feats = collectFeatureRoots(j);

  if (feats.length === 0) {
    const sig = categorySignature(j);
    const stub = j.type === 'Feature' ? j : { properties: {}, geometry: null };
    const coords = coordsFromEntity(stub, j);
    if (coords) {
      const categories = normalizedCategoryList(j);
      annotated.push({
        inputIndex: wi,
        categorySignature: sig,
        categories: categories,
        bucketKey: primaryBucketFromCategories(categories),
        lat: coords.lat,
        lon: coords.lon,
        name: (j.properties && j.properties.name
          ? String(j.properties.name).trim()
          : j.name
            ? String(j.name).trim()
            : j.properties && j.properties.formatted
              ? String(j.properties.formatted).trim()
              : ''
        ) || null,
        fullObject: j,
      });
      wi += 1;
    }
    continue;
  }

  for (let fi = 0; fi < feats.length; fi++) {
    const f = feats[fi];
    const mergedForCat = {};
    for (const kf in f) {
      if (Object.prototype.hasOwnProperty.call(f, kf)) mergedForCat[kf] = f[kf];
    }
    mergedForCat.geoapifyParams = j.geoapifyParams || f.geoapifyParams;
    mergedForCat.properties = f.properties || {};

    const sig = categorySignature(mergedForCat);
    const categories = normalizedCategoryList(mergedForCat);
    const coords = coordsFromEntity(f, j);
    if (!coords) continue;
    annotated.push({
      inputIndex: wi,
      categorySignature: sig,
      categories: categories,
      bucketKey: primaryBucketFromCategories(categories),
      lat: coords.lat,
      lon: coords.lon,
      name: (function () {
        const n1 = f.properties && f.properties.name ? String(f.properties.name).trim() : '';
        const n2 = f.properties && f.properties.formatted ? String(f.properties.formatted).trim() : '';
        const n = n1 || n2;
        return n || null;
      })(),
      fullObject: f,
    });
    wi += 1;
  }
}

let minDistance = Infinity;
let pickA = null;
let pickB = null;

for (let i = 0; i < annotated.length; i++) {
  for (let j = i + 1; j < annotated.length; j++) {
    const a = annotated[i];
    const b = annotated[j];
    if (a.bucketKey === b.bucketKey) continue;
    const mi = haversineMeters(a.lat, a.lon, b.lat, b.lon);
    if (mi < minDistance) {
      minDistance = mi;
      pickA = a;
      pickB = b;
    }
  }
}

const output =
  pickA && pickB
    ? {
        objectA: pickA,
        objectB: pickB,
        distanceMeters: Math.round(minDistance * 100) / 100,
      }
    : {
        objectA: null,
        objectB: null,
        distanceMeters: null,
      };

return [{ json: output }];
