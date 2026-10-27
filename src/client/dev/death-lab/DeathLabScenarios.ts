export interface DeathScenario {
  id: string;
  name: string;
  category: "combat" | "environment" | "hazard" | "absurd" | "clutch";
  killerName: string;
  killerRole: string;
  killerLevel: number;
  killerRank: string;
  weaponName: string;
  weaponType: "assault_rifle" | "sniper" | "explosive" | "gravity" | "vehicle" | "melee" | "hazard" | "unknown";
  weaponIcon: string;
  distanceMeters: number;
  hitLocation: "head" | "chest" | "legs" | "aoe" | "abyss" | "none";
  damageDealt: number;
  damageTaken: number;
  remainingLives: number;
  placementRank: number; // e.g. #7, #2, #16
  totalPlayers: number;
  killPhrase: string;
  humorPunchline: string;
  tacticalAdvice: string;
  timeRemainingRespawn: number; // seconds
  weapon?: string;
  distance?: string;
  bodyPart?: string;
}

export const DEATH_SCENARIOS: DeathScenario[] = [
  {
    id: "rifle",
    name: "1. Eliminación por Rifle",
    category: "combat",
    killerName: "ViperSgt_Ghost",
    killerRole: "Asalto Táctico",
    killerLevel: 42,
    killerRank: "DIAMANTE II",
    weaponName: "XM250 Vector LMG",
    weaponType: "assault_rifle",
    weaponIcon: "🔫",
    distanceMeters: 48.2,
    hitLocation: "chest",
    damageDealt: 74,
    damageTaken: 110,
    remainingLives: 2,
    placementRank: 9,
    totalPlayers: 20,
    killPhrase: "Fuego continuo en línea de visión cruzada",
    humorPunchline: "Las paredes de cartón no detienen munición pesada.",
    tacticalAdvice: "Aprovecha la cobertura sólida al reposicionarte.",
    timeRemainingRespawn: 4.0
  },
  {
    id: "headshot",
    name: "2. Headshot Certero",
    category: "combat",
    killerName: "ShadowSniper_99",
    killerRole: "Tirador Élite",
    killerLevel: 68,
    killerRank: "MAESTRO VIPER",
    weaponName: "Barrett .50 Cal Hex",
    weaponType: "sniper",
    weaponIcon: "🎯",
    distanceMeters: 142.6,
    hitLocation: "head",
    damageDealt: 0,
    damageTaken: 250,
    remainingLives: 1,
    placementRank: 12,
    totalPlayers: 24,
    killPhrase: "¡TIRO A LA CABEZA CRÍTICO (142m)!",
    humorPunchline: "Quedarte quieto en campo abierto: 10/10 en audacia, 0/10 en supervivencia.",
    tacticalAdvice: "Nunca asomes la cabeza dos veces por la misma esquina.",
    timeRemainingRespawn: 5.0
  },
  {
    id: "explosion",
    name: "3. Explosión Masiva",
    category: "hazard",
    killerName: "DemolitionDave",
    killerRole: "Artillero Pesado",
    killerLevel: 35,
    killerRank: "ORO III",
    weaponName: "Lanzacohetes RPG-Quarks",
    weaponType: "explosive",
    weaponIcon: "💥",
    distanceMeters: 8.5,
    hitLocation: "aoe",
    damageDealt: 45,
    damageTaken: 195,
    remainingLives: 2,
    placementRank: 15,
    totalPlayers: 20,
    killPhrase: "Impacto cinético expansivo devastador",
    humorPunchline: "El radio de explosión no era una sugerencia.",
    tacticalAdvice: "Mantén distancia de los vehículos y barriles de combustible.",
    timeRemainingRespawn: 4.5
  },
  {
    id: "fall",
    name: "4. Caída desde Gran Altura",
    category: "environment",
    killerName: "Gravedad Newtoniana",
    killerRole: "Física Implacable",
    killerLevel: 999,
    killerRank: "INVENCIBLE",
    weaponName: "Impacto Terminal con el Suelo",
    weaponType: "gravity",
    weaponIcon: "🕳️",
    distanceMeters: 84.0,
    hitLocation: "abyss",
    damageDealt: 0,
    damageTaken: 999,
    remainingLives: 1,
    placementRank: 14,
    totalPlayers: 16,
    killPhrase: "Has caído al abismo sin propulsión",
    humorPunchline: "El suelo siempre gana en las discusiones de física.",
    tacticalAdvice: "Revisa la carga de tu jetpack antes de saltar al vacío.",
    timeRemainingRespawn: 3.5
  },
  {
    id: "accidental",
    name: "5. Muerte por Accidente",
    category: "hazard",
    killerName: "Moto Eléctrica Descontrolada",
    killerRole: "Vehículo Autónomo",
    killerLevel: 12,
    killerRank: "BRONCE I",
    weaponName: "Atropello Cinemático a 120 km/h",
    weaponType: "vehicle",
    weaponIcon: "🏍️",
    distanceMeters: 2.1,
    hitLocation: "chest",
    damageDealt: 12,
    damageTaken: 180,
    remainingLives: 2,
    placementRank: 18,
    totalPlayers: 20,
    killPhrase: "Colisión no intencional en curva cerrada",
    humorPunchline: "Mirar a ambos lados de la calle aplica también en la arena.",
    tacticalAdvice: "Escucha el sonido del motor antes de cruzar la calzada.",
    timeRemainingRespawn: 4.0
  },
  {
    id: "duel",
    name: "6. Duelo 1v1 Intenso",
    category: "combat",
    killerName: "ViperDuelist_Kai",
    killerRole: "Espadachín Cinético",
    killerLevel: 55,
    killerRank: "PLATINO I",
    weaponName: "Hoja de Plasma Doble",
    weaponType: "melee",
    weaponIcon: "⚔️",
    distanceMeters: 1.8,
    hitLocation: "chest",
    damageDealt: 95,
    damageTaken: 100,
    remainingLives: 1,
    placementRank: 5,
    totalPlayers: 16,
    killPhrase: "Duelo cuerpo a cuerpo resuelto por 5 HP",
    humorPunchline: "Casi lo logras... a una bala de diferencia.",
    tacticalAdvice: "El juego de pies y el salto son vitales en combate a corta distancia.",
    timeRemainingRespawn: 4.0
  },
  {
    id: "unknown",
    name: "7. Causa Desconocida / Niebla",
    category: "environment",
    killerName: "La Zona Oscura",
    killerRole: "Entidad del Mapa",
    killerLevel: 0,
    killerRank: "ANOMALÍA",
    weaponName: "Gas Neurotóxico / Corrupción",
    weaponType: "unknown",
    weaponIcon: "☣️",
    distanceMeters: 0,
    hitLocation: "aoe",
    damageDealt: 0,
    damageTaken: 100,
    remainingLives: 2,
    placementRank: 11,
    totalPlayers: 16,
    killPhrase: "Sucumbiste ante la niebla radiactiva",
    humorPunchline: "Respirar niebla violeta no otorga superpoderes.",
    tacticalAdvice: "Monitorea el temporizador de cierre del mapa.",
    timeRemainingRespawn: 3.0
  },
  {
    id: "ridiculous",
    name: "8. Muerte Ridícula / Rebote",
    category: "absurd",
    killerName: "Tu Propia Pelota Rebotadora",
    killerRole: "Fuego Amigo Extremo",
    killerLevel: 1,
    killerRank: "PAYASO SUPREMO 🤡",
    weaponName: "Pelota de Goma Triple Rebote",
    weaponType: "explosive",
    weaponIcon: "⚽",
    distanceMeters: 1.2,
    hitLocation: "head",
    damageDealt: 150,
    damageTaken: 150,
    remainingLives: 3,
    placementRank: 19,
    totalPlayers: 20,
    killPhrase: "Te eliminaste con tu propio proyectil rebotado",
    humorPunchline: "Skill issue astronómico detectado. Se guardó en los anales del ridículo.",
    tacticalAdvice: "Calcula el ángulo de incidencia antes de disparar contra esquinas.",
    timeRemainingRespawn: 2.5
  },
  {
    id: "multikill_victim",
    name: "9. Víctima de Multi-Kill",
    category: "combat",
    killerName: "Overlord_Apex",
    killerRole: "Comandante Titán",
    killerLevel: 88,
    killerRank: "GRAN MAESTRO",
    weaponName: "Cañón de Riel Orbital",
    weaponType: "assault_rifle",
    weaponIcon: "⚡",
    distanceMeters: 62.0,
    hitLocation: "chest",
    damageDealt: 20,
    damageTaken: 160,
    remainingLives: 1,
    placementRank: 8,
    totalPlayers: 24,
    killPhrase: "¡EL RIVAL OBTUVO UN TRIPLE KILL CONTIGO!",
    humorPunchline: "Entraste en su clip de mejores momentos en YouTube.",
    tacticalAdvice: "No se agrupen en pasillos estrechos.",
    timeRemainingRespawn: 5.0
  },
  {
    id: "last_player",
    name: "10. Último Jugador / Clutch Fallido",
    category: "clutch",
    killerName: "Rival_Final_Boss",
    killerRole: "Líder de Escuadrón",
    killerLevel: 77,
    killerRank: "CAMPEÓN",
    weaponName: "Blaster Táctico Personalizado",
    weaponType: "assault_rifle",
    weaponIcon: "🏆",
    distanceMeters: 16.4,
    hitLocation: "chest",
    damageDealt: 92,
    damageTaken: 100,
    remainingLives: 0,
    placementRank: 2,
    totalPlayers: 20,
    killPhrase: "¡FIN DE PARTIDA! 1v1 EN RONDA DECISIVA",
    humorPunchline: "Quedar en segundo lugar duele más que morir de primero.",
    tacticalAdvice: "Tu escuadrón te vio fallar el clutch final.",
    timeRemainingRespawn: 0 // No respawn, final screen
  }
];

// Backwards-compatible alias fields
DEATH_SCENARIOS.forEach((s) => {
  s.weapon = s.weaponName;
  s.distance = `${s.distanceMeters}m`;
  s.bodyPart = s.hitLocation === "head" ? "Cabeza" : s.hitLocation === "chest" ? "Pecho" : s.hitLocation;
});

