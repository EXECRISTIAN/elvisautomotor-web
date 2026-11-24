// Tipo de vehículo (carrocería) y tracción. Si el auto no lo tiene cargado, se deduce del modelo/versión.

export const BODY_TYPES = ['Hatchback', 'Sedán', 'SUV', 'Pickup', 'Utilitario', 'Monovolumen', 'Rural / Familiar', 'Coupé', 'Convertible']
export const TRACCION = ['4x2', '4x4']
export const TIPO_TRACCION = ['Delantera', 'Trasera', 'Integral (AWD)', '4x4 conectable']

const BODY_BY_MODEL: Array<[RegExp, string]> = [
  [/\b(hilux|ranger|amarok|s-?10|toro|strada|saveiro|frontier|np300|navara|alaskan|oroch|l200|triton|tacoma|tundra|f-?1[05]0|maverick|montana|titano|landtrek|ram\b|1500|2500|rampage|gladiator|tunland|poer|wingle|t6|t8|t60|t90|vigus|cannon|colorado|silverado|dakota|rich 6|hunter)\b/i, 'Pickup'],
  [/\b(kangoo|partner|berlingo|fiorino|sprinter|master|trafic|ducato|boxer|jumper|expert|jumpy|transit|transporter|crafter|vito|h-?1|hiace|caddy|doblo|doblò|nv200|express|scudo|daily|urvan|k01|k02|c31|c35|v21|v22|deliver)\b/i, 'Utilitario'],
  [/\b(ecosport|t-?cross|nivus|taos|tiguan|touareg|tracker|equinox|trailblazer|captiva|blazer|2008|3008|5008|duster|captur|koleos|kardian|arkana|austral|kicks|x-?trail|qashqai|murano|pathfinder|compass|renegade|commander|cherokee|wrangler|creta|tucson|santa fe|kona|venue|sportage|seltos|sorento|sonet|stonic|niro|rav4|corolla cross|yaris cross|sw4|fortuner|c-hr|land cruiser|4runner|territory|bronco|kuga|escape|edge|explorer|everest|puma|c3 aircross|c4 cactus|c5 aircross|basalt|pulse|fastback|500x|hr-v|cr-v|wr-v|zr-v|pilot|outlander|eclipse cross|asx|montero|pajero|jolion|h6|h2|dargo|tiggo|x70|x90|dashing|coolray|okavango|monjaro|cs35|cs55|cs75|uni-|zs|hs|x1|x2|x3|x4|x5|x6|x7|q2|q3|q5|q7|q8|gla|glb|glc|gle|gls|xc40|xc60|xc90|forester|outback|crosstrek|xv|vitara|jimny|s-cross|countryman|yuan|song|atto|seal u|tang|bj40|x35|x55|glory|t5|ix5|js4|e-js4|s3|s4|s5|t-roc|atlas|teramont|id\.4|id\.5|ariya|ioniq 5|ev6|ev9|ex30|xc|eqa|eqb|eqc|tank)\b/i, 'SUV'],
  [/\b(cronos|corolla|virtus|vento|jetta|passat|versa|sentra|logan|fluence|onix plus|prisma|joy plus|cruze|cobalt|grand siena|siena|voyage|408|301|508|c4 lounge|c-elysée|city|civic|accord|elantra|accent|sonata|cerato|k3|k5|camry|yaris sedán|etios sedán|mazda3|a4|a6|serie 3|serie 5|clase c|clase e|s60|s90|ga4|ga6|arrizo|emgrand|seal|qin|han)\b/i, 'Sedán'],
  [/\b(spin|xpander|carnival|sienna|odyssey|picasso|grand c4|spacetourer|meriva|zafira|suran|sharan|touran|alhambra|traveller|staria|multivan|id\. buzz|carens|ertiga|xl7|m4|m6|m8|g10|g50|mifa)\b/i, 'Monovolumen'],
  [/\b(sportwagen|variant|sw\b|touring|estate|avant|weekend|rural|familiar|sportstourer|allroad|cross country)\b/i, 'Rural / Familiar'],
  [/\b(cabrio|convertible|roadster|spider|spyder)\b/i, 'Convertible'],
  [/\b(coup[eé]|mustang|camaro|challenger|gr86|brz|supra|z4|tt|rcz|86|370z|gt-r|scirocco)\b/i, 'Coupé'],
]

export function inferBodyType(model = '', trim = '') {
  const text = `${model} ${trim}`
  for (const [re, body] of BODY_BY_MODEL) if (re.test(text)) return body
  return 'Hatchback'
}

export function inferTraction(model = '', trim = '') {
  const text = `${model} ${trim}`
  if (/\b(awd|quattro|4matic|xdrive|4motion|all4|4wd)\b/i.test(text)) return { traccion: '4x4', tipo: 'Integral (AWD)' }
  if (/\b4x4\b/i.test(text)) return { traccion: '4x4', tipo: '4x4 conectable' }
  const body = inferBodyType(model, trim)
  if (body === 'Pickup' && /\b(f-?1[05]0|ram|1500|2500|silverado|tundra)\b/i.test(text)) return { traccion: '4x2', tipo: 'Trasera' }
  if (body === 'Pickup') return { traccion: '4x2', tipo: 'Trasera' }
  if (/\b(mustang|camaro|serie|clase c|clase e|gr86|brz|supra|z4)\b/i.test(text)) return { traccion: '4x2', tipo: 'Trasera' }
  return { traccion: '4x2', tipo: 'Delantera' }
}

/** Datos de tipo y tracción de un auto: lo cargado en el panel manda; si no, se deduce. */
export function vehicleKind(v: { model?: string | null; trim?: string | null; carroceria?: string | null; traccion?: string | null; tipoTraccion?: string | null }) {
  const guess = inferTraction(v.model ?? "", v.trim ?? "")
  return {
    carroceria: v.carroceria || inferBodyType(v.model ?? "", v.trim ?? ""),
    traccion: v.traccion || guess.traccion,
    tipoTraccion: v.tipoTraccion || guess.tipo,
  }
}
