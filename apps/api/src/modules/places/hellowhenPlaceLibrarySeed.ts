export type HellowhenPlaceLibraryLanguage = 'en' | 'fr' | 'es';

export type HellowhenPlaceLibraryCopy = {
  title: string;
  description: string;
};

export type HellowhenPlaceLibrarySeedEntry = {
  key: string;
  city: string;
  countryCode: 'FR';
  areaLabel: string;
  googleQuery: string;
  matchTokens: string[];
  category: 'Landmark' | 'Museum' | 'Park' | 'Garden' | 'Square' | 'Cultural venue' | 'Monument';
  tags: string[];
  defaultDurationMinutes: number;
  copy: Record<HellowhenPlaceLibraryLanguage, HellowhenPlaceLibraryCopy>;
};

export const HELLOWHEN_PLACE_LIBRARY_PACK = 'paris-popular-v1' as const;

export const hellowhenPlaceLibrarySeedEntries: HellowhenPlaceLibrarySeedEntry[] = [
  {
    key: 'eiffel-tower',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Eiffel Tower Paris France',
    matchTokens: ['eiffel'],
    category: 'Landmark',
    tags: ['paris', 'landmark', 'architecture', 'viewpoint'],
    defaultDurationMinutes: 90,
    copy: {
      en: { title: 'Eiffel Tower', description: 'A world-famous Paris landmark and an easy reference point for walks, photo stops, and nearby meetups.' },
      fr: { title: 'Tour Eiffel', description: 'Un monument parisien emblématique et un point de repère simple pour une promenade, des photos ou un rendez-vous à proximité.' },
      es: { title: 'Torre Eiffel', description: 'Un monumento emblemático de París y un punto de referencia sencillo para paseos, fotos o encuentros cercanos.' },
    },
  },
  {
    key: 'louvre-museum',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Louvre Museum Paris France',
    matchTokens: ['louvre'],
    category: 'Museum',
    tags: ['paris', 'museum', 'art', 'culture'],
    defaultDurationMinutes: 180,
    copy: {
      en: { title: 'Louvre Museum', description: 'A major art museum in central Paris, useful as a cultural destination or a recognizable meeting area around the Louvre complex.' },
      fr: { title: 'Musée du Louvre', description: 'Un grand musée d’art au centre de Paris, pratique comme destination culturelle ou comme zone de rendez-vous facilement reconnaissable.' },
      es: { title: 'Museo del Louvre', description: 'Un gran museo de arte en el centro de París, útil como destino cultural o como zona de encuentro fácil de reconocer.' },
    },
  },
  {
    key: 'arc-de-triomphe',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Arc de Triomphe Paris France',
    matchTokens: ['triomphe'],
    category: 'Monument',
    tags: ['paris', 'monument', 'landmark', 'champs-elysees'],
    defaultDurationMinutes: 60,
    copy: {
      en: { title: 'Arc de Triomphe', description: 'A famous Paris monument at Place Charles de Gaulle, well suited to sightseeing plans and nearby Champs-Élysées meetups.' },
      fr: { title: 'Arc de Triomphe', description: 'Un monument parisien célèbre de la place Charles-de-Gaulle, adapté aux visites et aux rendez-vous près des Champs-Élysées.' },
      es: { title: 'Arco del Triunfo', description: 'Un famoso monumento parisino en la plaza Charles de Gaulle, ideal para visitas y encuentros cerca de los Campos Elíseos.' },
    },
  },
  {
    key: 'sacre-coeur',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Basilique du Sacre Coeur Paris France',
    matchTokens: ['sacre', 'coeur'],
    category: 'Landmark',
    tags: ['paris', 'montmartre', 'landmark', 'viewpoint'],
    defaultDurationMinutes: 60,
    copy: {
      en: { title: 'Sacré-Cœur Basilica', description: 'A well-known Montmartre landmark with broad city views and plenty of nearby streets for walking or meeting.' },
      fr: { title: 'Basilique du Sacré-Cœur', description: 'Un lieu emblématique de Montmartre avec une large vue sur Paris et de nombreuses rues voisines pour se promener ou se retrouver.' },
      es: { title: 'Basílica del Sagrado Corazón', description: 'Un lugar emblemático de Montmartre con amplias vistas de París y muchas calles cercanas para pasear o encontrarse.' },
    },
  },
  {
    key: 'notre-dame-paris',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Notre Dame Cathedral Paris France',
    matchTokens: ['notre', 'dame'],
    category: 'Landmark',
    tags: ['paris', 'ile-de-la-cite', 'cathedral', 'architecture'],
    defaultDurationMinutes: 60,
    copy: {
      en: { title: 'Notre-Dame Cathedral of Paris', description: 'A historic landmark on Île de la Cité and a central reference point for walks along the Seine and the old city.' },
      fr: { title: 'Cathédrale Notre-Dame de Paris', description: 'Un monument historique de l’Île de la Cité et un point de repère central pour les promenades le long de la Seine et dans le vieux Paris.' },
      es: { title: 'Catedral de Notre-Dame de París', description: 'Un monumento histórico de la Île de la Cité y un punto de referencia central para paseos junto al Sena y por el casco histórico.' },
    },
  },
  {
    key: 'musee-dorsay',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: "Musee d'Orsay Paris France",
    matchTokens: ['orsay'],
    category: 'Museum',
    tags: ['paris', 'museum', 'art', 'seine'],
    defaultDurationMinutes: 150,
    copy: {
      en: { title: "Musée d'Orsay", description: 'A major Paris art museum on the Seine, useful for museum visits, creative outings, and nearby Left Bank plans.' },
      fr: { title: 'Musée d’Orsay', description: 'Un grand musée d’art parisien au bord de la Seine, adapté aux visites, sorties créatives et activités proches de la rive gauche.' },
      es: { title: 'Museo de Orsay', description: 'Un importante museo de arte parisino junto al Sena, ideal para visitas, salidas creativas y planes cerca de la margen izquierda.' },
    },
  },
  {
    key: 'sainte-chapelle',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Sainte Chapelle Paris France',
    matchTokens: ['sainte', 'chapelle'],
    category: 'Monument',
    tags: ['paris', 'ile-de-la-cite', 'monument', 'architecture'],
    defaultDurationMinutes: 60,
    copy: {
      en: { title: 'Sainte-Chapelle', description: 'A historic chapel on Île de la Cité, useful for architecture-focused plans and compact cultural walks near Notre-Dame and the Seine.' },
      fr: { title: 'Sainte-Chapelle', description: 'Une chapelle historique de l’Île de la Cité, adaptée aux activités autour de l’architecture et aux courtes promenades culturelles près de Notre-Dame et de la Seine.' },
      es: { title: 'Sainte-Chapelle', description: 'Una capilla histórica de la Île de la Cité, ideal para planes de arquitectura y paseos culturales cortos cerca de Notre-Dame y el Sena.' },
    },
  },
  {
    key: 'palais-garnier',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Palais Garnier Paris France',
    matchTokens: ['garnier'],
    category: 'Cultural venue',
    tags: ['paris', 'opera', 'architecture', 'culture'],
    defaultDurationMinutes: 90,
    copy: {
      en: { title: 'Palais Garnier', description: 'A landmark opera house in central Paris and an easy meeting reference for culture, architecture, or nearby shopping plans.' },
      fr: { title: 'Palais Garnier', description: 'Un opéra emblématique du centre de Paris et un point de rendez-vous simple pour des activités culturelles, architecturales ou proches des grands magasins.' },
      es: { title: 'Palais Garnier', description: 'Un teatro de ópera emblemático del centro de París y un punto de encuentro sencillo para planes culturales, de arquitectura o compras cercanas.' },
    },
  },
  {
    key: 'luxembourg-gardens',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Jardin du Luxembourg Paris France',
    matchTokens: ['luxembourg'],
    category: 'Garden',
    tags: ['paris', 'garden', 'park', 'left-bank'],
    defaultDurationMinutes: 90,
    copy: {
      en: { title: 'Luxembourg Gardens', description: 'A large central garden on the Left Bank, well suited to walks, informal meetups, outdoor breaks, and relaxed group plans.' },
      fr: { title: 'Jardin du Luxembourg', description: 'Un grand jardin central de la rive gauche, adapté aux promenades, rendez-vous informels, pauses en plein air et activités de groupe détendues.' },
      es: { title: 'Jardines de Luxemburgo', description: 'Un gran jardín céntrico de la margen izquierda, ideal para paseos, encuentros informales, descansos al aire libre y planes de grupo tranquilos.' },
    },
  },
  {
    key: 'tuileries-garden',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Jardin des Tuileries Paris France',
    matchTokens: ['tuileries'],
    category: 'Garden',
    tags: ['paris', 'garden', 'louvre', 'outdoors'],
    defaultDurationMinutes: 60,
    copy: {
      en: { title: 'Tuileries Garden', description: 'A central garden between the Louvre and Place de la Concorde, useful for walking routes, outdoor breaks, and easy meetups.' },
      fr: { title: 'Jardin des Tuileries', description: 'Un jardin central entre le Louvre et la place de la Concorde, pratique pour les promenades, pauses en plein air et rendez-vous simples.' },
      es: { title: 'Jardín de las Tullerías', description: 'Un jardín céntrico entre el Louvre y la plaza de la Concordia, útil para paseos, descansos al aire libre y encuentros sencillos.' },
    },
  },
  {
    key: 'place-des-vosges',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Place des Vosges Paris France',
    matchTokens: ['vosges'],
    category: 'Square',
    tags: ['paris', 'marais', 'square', 'architecture'],
    defaultDurationMinutes: 60,
    copy: {
      en: { title: 'Place des Vosges', description: 'A historic square in the Marais, useful for a calm meetup, short walk, or starting point for exploring the neighborhood.' },
      fr: { title: 'Place des Vosges', description: 'Une place historique du Marais, adaptée à un rendez-vous calme, une courte promenade ou comme point de départ pour découvrir le quartier.' },
      es: { title: 'Place des Vosges', description: 'Una plaza histórica del Marais, ideal para un encuentro tranquilo, un paseo corto o como punto de partida para recorrer el barrio.' },
    },
  },
  {
    key: 'pantheon-paris',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Panthéon 75005 Paris France',
    matchTokens: ['pantheon'],
    category: 'Monument',
    tags: ['paris', 'latin-quarter', 'monument', 'history'],
    defaultDurationMinutes: 75,
    copy: {
      en: { title: 'Panthéon', description: 'A major monument in the Latin Quarter and a clear meeting reference for cultural walks around the surrounding historic streets.' },
      fr: { title: 'Panthéon', description: 'Un monument majeur du Quartier latin et un point de rendez-vous clair pour des promenades culturelles dans les rues historiques voisines.' },
      es: { title: 'Panteón de París', description: 'Un importante monumento del Barrio Latino y un punto de encuentro claro para paseos culturales por las calles históricas cercanas.' },
    },
  },
  {
    key: 'champ-de-mars',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Champ de Mars Paris France',
    matchTokens: ['champ', 'mars'],
    category: 'Park',
    tags: ['paris', 'park', 'eiffel-tower', 'outdoors'],
    defaultDurationMinutes: 60,
    copy: {
      en: { title: 'Champ de Mars', description: 'A large public green space beside the Eiffel Tower, suitable for outdoor meetups, walks, photos, and relaxed group activities.' },
      fr: { title: 'Champ-de-Mars', description: 'Un grand espace vert public près de la tour Eiffel, adapté aux rendez-vous en plein air, promenades, photos et activités de groupe détendues.' },
      es: { title: 'Campo de Marte', description: 'Un gran espacio verde público junto a la Torre Eiffel, adecuado para encuentros al aire libre, paseos, fotos y actividades de grupo tranquilas.' },
    },
  },
  {
    key: 'place-de-la-concorde',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Place de la Concorde Paris France',
    matchTokens: ['concorde'],
    category: 'Square',
    tags: ['paris', 'square', 'landmark', 'tuileries'],
    defaultDurationMinutes: 45,
    copy: {
      en: { title: 'Place de la Concorde', description: 'A large central square between the Tuileries and Champs-Élysées, useful as a recognizable waypoint for city walks.' },
      fr: { title: 'Place de la Concorde', description: 'Une grande place centrale entre les Tuileries et les Champs-Élysées, pratique comme point de repère pour les promenades dans Paris.' },
      es: { title: 'Plaza de la Concordia', description: 'Una gran plaza céntrica entre las Tullerías y los Campos Elíseos, útil como punto de referencia para paseos por la ciudad.' },
    },
  },
  {
    key: 'buttes-chaumont',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Parc des Buttes Chaumont Paris France',
    matchTokens: ['buttes', 'chaumont'],
    category: 'Park',
    tags: ['paris', 'park', 'outdoors', '19th-arrondissement'],
    defaultDurationMinutes: 90,
    copy: {
      en: { title: 'Parc des Buttes-Chaumont', description: 'A large hilly park in northeast Paris, useful for outdoor plans, walking, casual meetups, and longer relaxed visits.' },
      fr: { title: 'Parc des Buttes-Chaumont', description: 'Un grand parc vallonné du nord-est de Paris, adapté aux activités en plein air, promenades, rendez-vous informels et visites plus longues.' },
      es: { title: 'Parque de Buttes-Chaumont', description: 'Un gran parque con colinas en el noreste de París, ideal para planes al aire libre, paseos, encuentros informales y visitas más largas.' },
    },
  },
  {
    key: 'pont-alexandre-iii',
    city: 'Paris',
    countryCode: 'FR',
    areaLabel: 'Paris, France',
    googleQuery: 'Pont Alexandre III Paris France',
    matchTokens: ['alexandre'],
    category: 'Landmark',
    tags: ['paris', 'bridge', 'seine', 'photography'],
    defaultDurationMinutes: 30,
    copy: {
      en: { title: 'Pont Alexandre III', description: 'An ornate Seine bridge and recognizable photo stop, useful as a short waypoint between Invalides, the river, and nearby museums.' },
      fr: { title: 'Pont Alexandre III', description: 'Un pont ornemental sur la Seine et un lieu photo reconnaissable, pratique comme étape courte entre les Invalides, le fleuve et les musées voisins.' },
      es: { title: 'Puente Alejandro III', description: 'Un puente ornamentado sobre el Sena y un punto fotográfico reconocible, útil como parada breve entre Los Inválidos, el río y los museos cercanos.' },
    },
  },
];

export function normalizeHellowhenPlaceMatchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[œŒ]/g, 'oe')
    .replace(/[æÆ]/g, 'ae')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function googlePredictionMatchesEntry(entry: HellowhenPlaceLibrarySeedEntry, predictionText: string) {
  const normalized = normalizeHellowhenPlaceMatchText(predictionText);
  return entry.matchTokens.every((token) => normalized.includes(normalizeHellowhenPlaceMatchText(token)));
}
