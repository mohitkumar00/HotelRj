import { Room, AmenityHighlight, DiningVenue, Review } from '../types';

export const HOTEL_INFO = {
  name: 'Hotel RJ',
  subName: 'Sanctuary of Modern Elegance',
  tagline: 'Where Timeless Luxury Meets Modern Serenity',
  location: '108 Coastal Cliffway, Emerald Bay',
  phone: '+1 (800) 845-9200',
  email: 'reservations@hotelrj.com',
  rating: 4.95,
  reviewCount: 384,
  awards: ['Michelin Guide Selected 2026', 'Condé Nast Traveler Gold List', 'Architectural Digest Design Award'],
};

export const ROOMS: Room[] = [
  {
    id: 'rj-penthouse',
    name: 'The RJ Grand Sky Penthouse',
    tier: 'penthouse',
    tagline: 'Dual-level luxury with 360° panoramic cliff and ocean vistas',
    pricePerNight: 1650,
    sizeSqFt: 2400,
    maxGuests: 4,
    bedType: '1 Emperor King + 1 California King',
    view: 'Panoramic Ocean & Skyline',
    featured: true,
    heroImage: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private Heated Infinity Dip Pool',
      '24/7 Dedicated Butler & Sommelier',
      'Private Terrace with Fire Hearth',
      'Bang & Olufsen Bespoke Audio',
      'Marble Bath with Soaking Tub',
      'Dyson Supersonic Hair Care Suite',
      'Walk-in Wardrobe & Dressing Salon',
      'Custom Frette 1000-thread Linens',
    ],
    description:
      'Perched on the highest crown of Hotel RJ, the Grand Sky Penthouse defines contemporary architectural majesty. Boasting soaring 18-foot ceilings, floor-to-ceiling glass expanses, and a private wraparound travertine terrace with an infinity plunge pool suspended over the cliffs.',
  },
  {
    id: 'oceanfront-villa',
    name: 'Cliffside Oceanfront Villa',
    tier: 'villa',
    tagline: 'Secluded cliff sanctuary surrounded by tranquil water gardens',
    pricePerNight: 1250,
    sizeSqFt: 1650,
    maxGuests: 3,
    bedType: '1 California King',
    view: 'Direct Oceanfront & Sunset',
    featured: true,
    heroImage: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1540518614846-7ede433c4550?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private Sunken Ocean Lounger',
      'Outdoor Rain Shower in Zen Garden',
      'Sub-Zero Wine Reserve with Curated Vintages',
      'Aesop Botanicals Bath Collection',
      'Smart Climate & Curtains Automation',
      'Complimentary Sunset Aperitivo Daily',
    ],
    description:
      'Engineered for ultimate serenity, each Cliffside Villa blends indoor and outdoor living with minimalist teak millwork, Japanese stone soaking tubs, and private outdoor showers beneath coastal pines.',
  },
  {
    id: 'azure-suite',
    name: 'The Azure Horizon Suite',
    tier: 'suite',
    tagline: 'Expansive ocean-facing terrace with tailored living salon',
    pricePerNight: 890,
    sizeSqFt: 980,
    maxGuests: 2,
    bedType: '1 King Bed',
    view: 'Coastal Horizon',
    featured: true,
    heroImage: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Expansive Teak Terrace with Daybed',
      'Deep Freestanding Oval Soaking Tub',
      'Nespresso Vertuo & Artisan Tea Bar',
      'High-Speed Starlink Connectivity',
      'Plush Goose Down Duvet & Pillows',
    ],
    description:
      'Wake to uninterrupted dawn views over the sapphire waters. The Azure Horizon Suite features custom Italian terrazzo flooring, brass accent lighting, and a curated library of contemporary art and architecture volumes.',
  },
  {
    id: 'zenith-deluxe',
    name: 'Zenith Garden Deluxe Room',
    tier: 'deluxe',
    tagline: 'Serene botanical oasis with limestone bath and courtyard balcony',
    pricePerNight: 580,
    sizeSqFt: 620,
    maxGuests: 2,
    bedType: '1 King or 2 Queens',
    view: 'Lush Botanical Courtyard',
    featured: false,
    heroImage: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private Botanical Garden Veranda',
      'Walk-In Rainfall Shower',
      'Illy Espresso Station & Artisanal Minibar',
      'Marshall Bluetooth Acoustic Speaker',
      'Organic Bamboo Robes & Slippers',
    ],
    description:
      'Immerse in nature’s calm. The Zenith Deluxe overlooks our curated heritage botanical gardens with aromatic lavender, olive groves, and ancient cypress trees, offering acoustic tranquility and morning sunlight.',
  },
  {
    id: 'prestige-ocean-deluxe',
    name: 'Prestige Ocean Deluxe',
    tier: 'deluxe',
    tagline: 'Crisp contemporary styling with sea breezes and private balcony',
    pricePerNight: 690,
    sizeSqFt: 680,
    maxGuests: 2,
    bedType: '1 King Bed',
    view: 'Partial Ocean & Harbor',
    featured: false,
    heroImage: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Furnished Sea-Breeze Balcony',
      'Dual Marble Vanity Basin',
      'Curated Cocktail Station with Crystal Glassware',
      'Smart TV with Seamless Casting',
      'Nightly Aromatherapy Turndown Service',
    ],
    description:
      'A refined blend of crisp linen tones and warm walnut joinery. Enjoy evening sea breezes from your private balcony with handcrafted cocktails from your personal in-room bar.',
  },
];

export const AMENITIES: AmenityHighlight[] = [
  {
    id: 'infinity-pool',
    title: 'The Edge Infinity Pool',
    subtitle: 'Suspended 120ft above the azure Pacific',
    description: 'Heated mineral waters that seamlessly merge with the horizon. Featuring sunken daybeds, poolside sommelier service, and sunset DJ sessions.',
    category: 'leisure',
    iconName: 'Waves',
    imageUrl: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1200&q=80',
    colSpan: 'md:col-span-2 md:row-span-2',
    badge: 'Signature Highlight',
  },
  {
    id: 'soma-spa',
    title: 'Sōma Holistic Wellness & Spa',
    subtitle: 'Ayurvedic treatments & cedar thermal saunas',
    description: 'Bespoke hydrothermal circuits, cold plunge waterfalls, sound bath meditation chambers, and rare botanical treatments.',
    category: 'wellness',
    iconName: 'Sparkles',
    imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    colSpan: 'md:col-span-1 md:row-span-1',
  },
  {
    id: 'michelin-dining',
    title: 'Aura by Chef Jean-Luc',
    subtitle: 'Michelin-starred oceanfront dining',
    description: 'Hyper-seasonal tasting menus celebrating organic coastal catches and estate-grown botanicals paired with rare biodynamic vintages.',
    category: 'dining',
    iconName: 'Utensils',
    imageUrl: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=1200&q=80',
    colSpan: 'md:col-span-1 md:row-span-1',
  },
  {
    id: 'private-concierge',
    title: 'Bespoke Curated Concierge',
    subtitle: 'Helicopter charters & private yachting',
    description: 'Direct VIP access to private island excursions, chartered Riva yachts, helicopter airport transfers, and private vineyard tours.',
    category: 'service',
    iconName: 'Compass',
    imageUrl: 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=1200&q=80',
    colSpan: 'md:col-span-1 md:row-span-1',
  },
  {
    id: 'fitness-sanctuary',
    title: 'Technogym Biostrength Studio',
    subtitle: 'Personal trainers & sunrise yoga decks',
    description: 'State-of-the-art AI-guided Technogym equipment, open-air pilates reformer pavilion, and daily sunrise coastal meditation.',
    category: 'wellness',
    iconName: 'Dumbbell',
    imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
    colSpan: 'md:col-span-1 md:row-span-1',
  },
];

export const DINING_VENUES: DiningVenue[] = [
  {
    id: 'aura-restaurant',
    name: 'Aura Fine Dining',
    type: 'Contemporary Coastal & Tasting Menus',
    hours: 'Dinner: 6:00 PM – 11:00 PM (Reservations Recommended)',
    dressCode: 'Smart Elegant',
    chefQuote: '"We let the raw beauty of the coastline dictate every single element on the plate."',
    description:
      'Overlooking the surf breaks of Emerald Bay, Aura presents an extraordinary 8-course culinary narrative driven by daily catches from local divers and hand-foraged ingredients.',
    heroImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80',
    signatureDishes: [
      {
        name: 'Smoked Diver Scallop & Sea Urchin',
        description: 'Coastal sea broth, finger lime pearls, dulse seaweed emulsion',
        price: '$46',
      },
      {
        name: 'Wagyu A5 Striploin over Binchotan',
        description: 'Black garlic reduction, glazed heirloom matsutake, parsnip cloud',
        price: '$92',
      },
      {
        name: 'Golden Honeycomb & Citrus Cloud',
        description: 'Estate lavender blossom honey, yuzu sorbet, warm almond sable',
        price: '$24',
      },
    ],
  },
  {
    id: 'luna-rooftop',
    name: 'Luna Sunset & Cocktail Lounge',
    type: 'Mixology, Small Plates & DJ Sets',
    hours: 'Daily: 4:00 PM – 1:00 AM',
    dressCode: 'Resort Chic',
    chefQuote: '"The golden hour is not just a time of day here — it is a ritual."',
    description:
      'Perched on the open skydeck with suspended fire pits and deep lounge sofas. Hand-crafted artisanal cocktails crafted with infused mezcals, Japanese whiskies, and rare botanical bitters.',
    heroImage: 'https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&w=1600&q=80',
    signatureDishes: [
      {
        name: 'The Emerald Mist Martini',
        description: 'Botanical gin, clarified cucumber, elderflower mist, mountain pine',
        price: '$26',
      },
      {
        name: 'Bluefin Tuna Tartare Cones',
        description: 'Sesame nori crisp, avocado mousse, white truffle glaze',
        price: '$32',
      },
      {
        name: 'Charred Spanish Octopus Pinchos',
        description: 'Pimentón aioli, crushed fingerling potatoes, salsa verde',
        price: '$28',
      },
    ],
  },
];

export const REVIEWS: Review[] = [
  {
    id: 'rev-1',
    author: 'Elena & Marcus Vance',
    location: 'Geneva, Switzerland',
    stayDate: 'October 2026',
    rating: 5,
    title: 'The pinnacle of architectural tranquility',
    comment:
      'From the moment our private chauffeur greeted us at the airport, Hotel RJ was flawless. The cliffside plunge pool at dusk while listening to the waves below is something we will never forget.',
    source: 'Verified Guest',
  },
  {
    id: 'rev-2',
    author: 'David Chen',
    location: 'San Francisco, CA',
    stayDate: 'September 2026',
    rating: 5,
    title: 'Unmatched hospitality and design fidelity',
    comment:
      'As an architect, I am rarely impressed by hotel interiors, but Hotel RJ has nailed every single detail. The acoustic insulation, the tactile travertine finishes, and the dinner at Aura were world-class.',
    source: 'Architectural Digest Circle',
  },
  {
    id: 'rev-3',
    author: 'Sophia Al-Mansoor',
    location: 'Dubai, UAE',
    stayDate: 'August 2026',
    rating: 5,
    title: 'Our new favorite escape worldwide',
    comment:
      'The spa treatments using locally sourced cedar and coastal botanicals completely rejuvenated us. The staff remembers every preference without ever intruding. Simply extraordinary.',
    source: 'Verified Guest',
  },
];

export const NEIGHBORHOOD_SPOTS = [
  {
    name: 'Emerald Bay Marine Sanctuary',
    distance: '3 mins walking',
    type: 'Private Beach & Snorkeling',
    desc: 'Pristine sheltered cove with crystalline turquoise water and sea turtles.',
  },
  {
    name: 'Highland Pine Trail & Lookout',
    distance: '8 mins walk',
    type: 'Nature & Hiking',
    desc: 'Panoramic cliffside trail winding through century-old coastal pines.',
  },
  {
    name: 'Historic Old Port & Artisan Alley',
    distance: '10 mins drive',
    type: 'Culture & Shopping',
    desc: 'Cobblestone streets with fine art galleries, silversmiths, and gelaterias.',
  },
  {
    name: 'Emerald International Helipad',
    distance: '12 mins drive',
    type: 'Air Transit',
    desc: 'Direct helicopter access to regional hubs and private air charters.',
  },
];
