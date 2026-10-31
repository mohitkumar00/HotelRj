import { Room, AmenityHighlight, DiningVenue, Review } from '../types';

export const HOTEL_INFO = {
  name: 'Hotel RJ',
  subName: 'Where Comfort Meets Great Taste',
  tagline: 'Where Comfort Meets Great Taste',
  location: 'Suriya Road, Near Devi Durga Nursing Home, Bagodar, Giridih, Jharkhand 825322',
  shortLocation: 'Bagodar, Giridih, Jharkhand',
  phone: '+91 7004865824',
  secondaryPhone: '+91 7004153034',
  email: 'hotelrj.info@gmail.com',
  rating: 4.8,
  reviewCount: 168,
  established: '2024',
  mapUrl: 'https://maps.google.com/?q=Hotel+RJ+Suriya+Road+Bagodar+Giridih+Jharkhand+825322',
  highlights: [
    'Prime Suriya Road Location',
    'Multi-Cuisine Family Restaurant',
    'Grand Banquet & Celebration Hall',
    '24/7 Silent Power Backup',
  ],
};

export const ROOMS: Room[] = [
  {
    id: 'deluxe-king-room',
    name: 'Deluxe King AC Room',
    tier: 'deluxe',
    tagline: 'Cozy modern room with 1 king bed, ambient ceiling lighting, wardrobe, and attached bath',
    pricePerNight: 1600,
    sizeSqFt: 120,
    maxGuests: 2,
    bedType: '1 King Size Bed',
    view: 'Courtyard View',
    featured: true,
    heroImage: './images/deluxe-king-room-1.jpg',
    galleryImages: [
      './images/deluxe-king-room-1.jpg',
      './images/deluxe-king-room-2.jpg',
    ],
    amenities: [
      '1 King Size Spring Mattress Bed',
      'Split Air Conditioning & Designer Cove Lighting',
      'Attached Clean Bathroom with 24/7 Geyser (Hot Water)',
      'Wooden Wardrobe with Full-Length Dressing Mirror',
      '24/7 Silent Generator Power Backup',
      'High-Speed Free Wi-Fi Access',
      'Daily Housekeeping & Fresh White Linens',
      'In-Room Dining from Hotel RJ Restaurant',
    ],
    description:
      'Spotlessly clean and comfortable air-conditioned room featuring a plush king-size bed, stylish ceiling cove lighting, private wardrobe, and attached bathroom. Perfect for solo travelers and couples visiting Bagodar or stopping over along the GT Road.',
  },
  {
    id: 'executive-family-suite',
    name: 'Executive Family Suite (2 Beds)',
    tier: 'family',
    tagline: 'Spacious 400 sq ft suite with 2 double beds, sofa lounge, and dining table for up to 4 guests',
    pricePerNight: 3000,
    sizeSqFt: 400,
    maxGuests: 4,
    bedType: '2 Double Beds',
    view: 'Suriya Road View',
    featured: true,
    heroImage: './images/family-suite-room-1.jpg',
    galleryImages: [
      './images/family-suite-room-1.jpg',
      './images/family-suite-room-2.jpg',
      './images/family-suite-room-3.jpg',
    ],
    amenities: [
      '2 Large Double Beds (Accommodates 4 Adults)',
      'Expansive 400 Sq Ft Suite Living Area',
      'Plush Sofa Seating Lounge with Center Table & Chairs',
      'Split AC, Dual Ceiling Fans & Designer Chandelier',
      'Large Dressing Mirror & Wooden Wardrobe',
      'Spacious Attached Bathroom with 24/7 Hot & Cold Water',
      '24/7 Silent Generator Power Backup',
      'High-Speed Wi-Fi & Intercom Facility',
    ],
    description:
      'Our largest and most luxurious accommodation. Spanning 400 sq ft with two double beds, comfortable sofa seating lounge, center table, decorative ceiling chandelier, and expansive attached bathroom. Ideal for families, wedding groups, and pilgrimage travelers to Parasnath / Harihar Dham.',
  },
];

export const AMENITIES: AmenityHighlight[] = [
  {
    id: 'restaurant-dining',
    title: 'Hotel RJ Multi-Cuisine Restaurant',
    subtitle: 'Where Comfort Meets Great Taste',
    description: 'Freshly prepared vegetarian & non-vegetarian delicacies including North Indian curries, Tandoori kebabs, South Indian favorites, Chinese, and regional Jharkhand specialties.',
    category: 'dining',
    iconName: 'Utensils',
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    colSpan: 'md:col-span-2 md:row-span-2',
    badge: 'Signature Restaurant',
  },
  {
    id: 'banquet-hall',
    title: 'RJ Grand Banquet & Event Hall',
    subtitle: 'Capacity for up to 300+ guests',
    description: 'Elegantly decorated, air-conditioned banquet hall with integrated sound system, stage lighting, and custom catering for weddings, receptions, birthdays, and business conferences.',
    category: 'events',
    iconName: 'Sparkles',
    imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
    colSpan: 'md:col-span-1 md:row-span-1',
    badge: 'Events & Parties',
  },
  {
    id: 'power-backup',
    title: '24/7 Silent Generator Power Backup',
    subtitle: 'Uninterrupted comfort day and night',
    description: 'Heavy-duty silent generator infrastructure ensuring continuous air conditioning, Wi-Fi, lighting, and elevator power during any grid outage.',
    category: 'comfort',
    iconName: 'ShieldCheck',
    imageUrl: './images/family-suite-room-2.jpg',
    colSpan: 'md:col-span-1 md:row-span-1',
  },
  {
    id: 'secure-parking',
    title: 'Ample Dedicated Secure Parking',
    subtitle: 'Safe on-premise parking for cars & buses',
    description: 'Spacious on-site parking monitored 24/7 with CCTV surveillance and security staff, providing peace of mind for highway travelers and banquet guests.',
    category: 'service',
    iconName: 'Compass',
    imageUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80',
    colSpan: 'md:col-span-1 md:row-span-1',
  },
  {
    id: 'doctor-on-call',
    title: 'Doctor on Call & Healthcare Proximity',
    subtitle: 'Near Devi Durga Nursing Home',
    description: 'Peace of mind with immediate medical assistance available on call, conveniently located right next to Devi Durga Nursing Home on Suriya Road.',
    category: 'service',
    iconName: 'HeartPulse',
    imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80',
    colSpan: 'md:col-span-1 md:row-span-1',
  },
];

export const DINING_VENUES: DiningVenue[] = [
  {
    id: 'rj-restaurant',
    name: 'Hotel RJ Family Restaurant',
    type: 'Multi-Cuisine Family Dining (AC)',
    hours: 'Open Daily: 7:00 AM – 11:00 PM',
    dressCode: 'Casual & Family Friendly',
    chefQuote: '"Where Comfort Meets Great Taste — cooked fresh with pure ingredients and traditional flavor."',
    description:
      'Step into our welcoming, air-conditioned dining hall for authentic flavors. Serving rich North Indian gravies, soft tandoori rotis and naans, sizzling Chinese starters, and healthy homestyle thalis.',
    heroImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=80',
    signatureDishes: [
      {
        name: 'Special Paneer Butter Masala',
        description: 'Fresh cottage cheese simmered in rich cashew-tomato butter gravy',
        price: '₹240',
      },
      {
        name: 'RJ Special Handi Chicken',
        description: 'Slow-cooked country chicken with whole aromatic spices and thick gravy',
        price: '₹340',
      },
      {
        name: 'Crispy Chilli Paneer / Babycorn',
        description: 'Crispy tossed with bell peppers, spring onions, and oriental sauces',
        price: '₹220',
      },
      {
        name: 'Dal Makhani & Garlic Naan Combo',
        description: 'Overnight simmered black lentils finished with cream and butter',
        price: '₹190',
      },
      {
        name: 'Special Dehati Mutton Curry',
        description: 'Tender mutton cooked in authentic Jharkhand home-style spices',
        price: '₹380',
      },
    ],
  },
  {
    id: 'rj-banquet-dining',
    name: 'Banquet & Party Catering',
    type: 'Event Buffets, High Tea & Custom Menus',
    hours: 'Available On Booking for 25 to 300+ Guests',
    dressCode: 'Festive / Formal',
    chefQuote: '"Making your weddings, birthdays, and celebrations memorable with royal hospitality."',
    description:
      'Comprehensive catering and banquet hall services for weddings, ring ceremonies, birthday parties, anniversary celebrations, and corporate get-togethers with live counters and customized thali spreads.',
    heroImage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=80',
    signatureDishes: [
      {
        name: 'Royal Wedding Thali Spread',
        description: 'Includes welcome drink, 2 starters, 3 main curries, breads, pulao & sweets',
        price: 'From ₹450 / plate',
      },
      {
        name: 'Live Tandoor & Chaat Counters',
        description: 'Freshly grilled kebabs, tikkas, pani puri, and hot jalebis',
        price: 'Customized',
      },
      {
        name: 'High Tea & Corporate Snack Boxes',
        description: 'Assorted sandwiches, samosas, cutlets, sweets, and premium tea/coffee',
        price: 'From ₹150 / box',
      },
    ],
  },
];

export const REVIEWS: Review[] = [
  {
    id: 'rev-1',
    author: 'Rajesh Sharma',
    location: 'Ranchi, Jharkhand',
    stayDate: 'October 2026',
    rating: 5,
    title: 'Best hotel and restaurant in Bagodar!',
    comment:
      'We stayed here during our family trip to Parasnath. The rooms are spotless, AC works great, and the food at the restaurant was delicious! Staff is very polite and helpful.',
    source: 'Google Review',
  },
  {
    id: 'rev-2',
    author: 'Anand Kumar Sinha',
    location: 'Patna, Bihar',
    stayDate: 'September 2026',
    rating: 5,
    title: 'Comfortable stay along GT Road corridor',
    comment:
      'Convenient location right on Suriya Road near the nursing home. Safe parking for my car and continuous power backup was very reassuring. Handi chicken was outstanding.',
    source: 'Verified Guest',
  },
  {
    id: 'rev-3',
    author: 'Priya Verma',
    location: 'Giridih',
    stayDate: 'August 2026',
    rating: 5,
    title: 'Wonderful banquet hall for our family celebration',
    comment:
      'Organized my parents anniversary party here. The decoration, air conditioning, and buffet catering exceeded all expectations. True to their slogan: Where Comfort Meets Great Taste!',
    source: 'Local Resident',
  },
];

export const NEIGHBORHOOD_SPOTS = [
  {
    name: 'Harihar Dham Temple (Bagodar)',
    distance: '5 mins drive (2.5 km)',
    type: 'Famous Holy Pilgrimage',
    desc: 'Renowned temple housing the world’s largest Shiva Lingam, drawing thousands of devotees year-round.',
  },
  {
    name: 'Grand Trunk Road (NH 19 / GT Road)',
    distance: '2 mins drive (800 m)',
    type: 'National Highway Corridor',
    desc: 'Direct highway artery linking Kolkata, Dhanbad, Ranchi, Varanasi, and Delhi.',
  },
  {
    name: 'Suriya Railway Station',
    distance: '15 mins drive (11 km)',
    type: 'Railway Connectivity',
    desc: 'Direct train connectivity across Jharkhand, Bihar, and major express routes.',
  },
  {
    name: 'Shri Sammed Shikharji (Parasnath Hills)',
    distance: '35 mins drive (32 km)',
    type: 'World-Famous Jain Pilgrimage',
    desc: 'The holiest Jain pilgrimage hill where 20 Tirthankaras attained Moksha.',
  },
  {
    name: 'Devi Durga Nursing Home',
    distance: 'Adjacent / Walking',
    type: 'Medical & Healthcare',
    desc: 'Immediate healthcare access right next door for medical security and doctor on call.',
  },
];
