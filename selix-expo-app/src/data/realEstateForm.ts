import { Objective, ProjectCategory, PropertyType } from '../types';

export const MOROCCO_CITIES = [
  'Casablanca',
  'Rabat',
  'Salé',
  'Témara',
  'Marrakech',
  'Tanger',
  'Agadir',
  'Fès',
  'Meknès',
  'Kénitra',
  'Mohammedia',
  'Bouskoura',
  'El Jadida',
  'Essaouira',
  'Tétouan',
  'Oujda',
] as const;

export const CITY_DISTRICTS: Record<string, string[]> = {
  Casablanca: ['Ain Diab', 'Maarif', 'Anfa', 'Californie', 'Bouskoura', 'Sidi Maarouf', 'Bourgogne', 'Casa Finance City', 'Palmier'],
  Rabat: ['Agdal', 'Hay Riad', 'Souissi', 'Océan', 'Aviation', 'Hassan', 'Yacoub El Mansour'],
  'Salé': ['Sala Al Jadida', 'Tabriquet', 'Bettana', 'Hay Salam'],
  'Témara': ['Wifaq', 'Massira', 'Harhoura', 'Skhirat'],
  Marrakech: ['Guéliz', 'Hivernage', 'Palmeraie', 'Targa', 'Samlalia', 'Route de Casablanca'],
  Tanger: ['Malabata', 'Iberia', 'Centre-ville', 'Marshan', 'Route de Rabat', 'Achakar'],
  Agadir: ['Founty', 'Sonaba', 'Marina', 'Talborjt', 'Hay Mohammadi'],
  Fès: ['Route Immouzer', 'Ville Nouvelle', 'Narjiss', 'Saiss'],
  Mohammedia: ['Parc', 'Mannesmann', 'Wafa', 'Monica', 'Centre'],
  Bouskoura: ['Ville verte', 'Centre', 'Labissa', 'Victoria'],
};

export const PROPERTY_TYPES: PropertyType[] = [
  'Appartement',
  'Appartement economique',
  'Appartement moyen standing',
  'Appartement haut standing',
  'Studio',
  'Duplex',
  'Penthouse',
  'Villa',
  'Villa jumelee',
  'Villa isolee',
  'Maison',
  'Riad',
  'Terrain',
  'Lot de villa',
  'Lotissement',
  'Local commercial',
  'Magasin',
  'Bureau',
  'Plateau bureau',
  'Immeuble',
  'Residence touristique',
];

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  'Projet neuf',
  'Projet en cours de construction',
  'Projet livre',
  'Projet pret a habiter',
  'Lotissement',
  'Residence fermee',
  'Residence ouverte',
  'Projet subventionne',
  'Projet moyen standing',
  'Projet premium',
];

export const OBJECTIVES: Objective[] = [
  'Residence principale',
  'Residence secondaire',
  'Investissement locatif',
  'Revente',
  'Usage professionnel',
  'Commerce',
  'Terrain et construction',
  'Projet touristique',
];

export const LOCATION_PREFERENCES = [
  'Centre-ville',
  'Peripherie',
  'Quartier calme',
  'Quartier anime',
  'Proche commerces',
  'Proche ecoles',
  'Proche universite',
  'Proche mosquee',
  'Proche plage',
  'Proche gare',
  'Proche tramway',
  'Proche transport public',
  'Proche autoroute',
  'Proche lieu de travail',
];

export const AMENITIES = [
  'Parking',
  'Garage',
  'Terrasse',
  'Balcon',
  'Jardin',
  'Piscine',
  'Cave',
  'Box rangement',
  'Ascenseur',
  'Acces PMR',
  'Residence fermee',
  'Securite',
  'Camera surveillance',
  'Cuisine equipee',
  'Climatisation',
  'Chauffage',
  'Fibre optique',
  'Isolation phonique',
  'Isolation thermique',
];

export const FINISHING_LEVELS = [
  'Economique',
  'Standard',
  'Moyen standing',
  'Bon standing',
  'Haut standing',
  'Luxe',
];

export const VIEW_OPTIONS = [
  'Mer',
  'Piscine',
  'Jardin',
  'Boulevard',
  'Ville',
  'Cour interieure',
  'Sans preference',
];

export const ARCHITECTURE_STYLES = ['Moderne', 'Traditionnelle', 'Sans preference'] as const;
export const CONTACT_AVAILABILITIES = ['Matin', 'Apres-midi', 'Soir'] as const;
export const CONTACT_METHODS = ['Appel', 'WhatsApp', 'Email'] as const;
export const RESIDENCE_STATUSES = ['MRE', 'Resident local'] as const;
export const FAMILY_SITUATIONS = ['Celibataire', 'Marie', 'Avec enfants', 'Autre'] as const;
export const BUDGET_FLEXIBILITIES = ['Strict', 'Flexible'] as const;
export const LOCATION_FLEXIBILITIES = ['Stricte', 'Flexible'] as const;
export const PURCHASE_DEADLINES = ['Immédiat', 'Moins de 1 mois', '1 a 3 mois', '3 a 6 mois', 'Plus tard'] as const;
export const FINANCING_MODES = ['Cash', 'Crédit', 'Mixte'] as const;
export const FURNISHING_LEVELS = ['Non meuble', 'Semi-equipe', 'Entierement equipe', 'Meuble'] as const;
