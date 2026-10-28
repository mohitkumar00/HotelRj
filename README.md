# Hotel RJ — Modern Sanctuary & Hospitality Website

A luxury boutique hotel website engineered following modern frontend design standards, biophilic luxury aesthetics, and interactive booking flows.

## Tech Stack & Architecture
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom luxury tokens (warm sand, champagne gold, deep obsidian/slate)
- **Icons**: Lucide Icons
- **Typography**: Playfair Display (Serif) & Plus Jakarta Sans (Sans-serif)

## Key Features & Sections
1. **Glassmorphic Navigation (`Navbar`)**: Translucent header with logo, section anchors, concierge phone, and mobile navigation drawer.
2. **Editorial Hero (`Hero`)**: Full-bleed cinematic photography, Michelin Guide accolade, coordinates badge, and dual CTAs.
3. **Floating Booking Engine (`BookingBar`)**: Check-in & Check-out date pickers, guest count counter, room tier selector, and rate search.
4. **The Sanctuary Concept (`StoryPhilosophy`)**: Architecture narrative, geothermal sustainability badge, and key statistics.
5. **Suites & Residences Showcase (`RoomsCatalog`)**:
   - Filterable by tier: All, Penthouse, Cliffside Villas, Horizon Suites, Deluxe Rooms.
   - Sorter by price (low/high) and square footage.
   - Per-night pricing, guest capacity, bed configurations, view tags, and key amenities.
6. **Residency Modal (`RoomModal`)**: Multi-photo gallery carousel, comprehensive dimensions, and detailed perk list.
7. **Amenities Bento Grid (`AmenitiesBento`)**: Asymmetrical modern layout for the Edge Infinity Pool, Sōma Spa, Aura Dining, Helipad Concierge, and Technogym Studio.
8. **Michelin-Inspired Gastronomy (`DiningSection`)**: Interactive tabs for Aura Fine Dining and Luna Rooftop Lounge with seasonal tasting menus and table reservations.
9. **Curated Destination (`NeighborhoodGuide`)**: Distance indicators to marine sanctuaries, airport, and old port with interactive navigation card.
10. **Guest Accolades (`GuestReviews`)**: Verified guest reviews and press mentions.
11. **Direct Reservation Drawer (`ReservationDrawer`)**: Live dynamic calculation (nights × room rate, add-ons, 14% occupancy tax) and instant confirmation state with reference code.
12. **Footer & FAQs (`Footer`)**: Accordion FAQs, contact details, and private invitation newsletter.

## Development & Build Commands
```bash
# Start development server
npm run dev

# Compile TypeScript and build production bundle
npm run build

# Preview production build
npm run preview
```
