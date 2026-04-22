'use client';

import React, { useState, useRef } from 'react';
import {
  Search, MapPin, Star, Heart, ArrowLeft, Share2, Bookmark,
  Home, Compass, Briefcase, User, Bell, Filter, Plus,
  ChevronRight, ChevronDown, Calendar, Users,
  Wifi, Car, Coffee, Waves, Sparkles, Clock,
} from 'lucide-react';

/* ─── Data ───────────────────────────────────────────── */

const DESTINATIONS = [
  {
    id: 1, name: 'Santorini', country: 'Greece', tagline: 'Where sunsets become memories',
    rating: 4.9, reviews: 2847, price: 1299, duration: '7 days',
    gradient: ['#667eea', '#764ba2'], lightGradient: ['#8b9ff4', '#9b6bc7'],
    emoji: '⛪', bg: '#f0efff',
    tags: ['Romantic', 'Scenic', 'Island'],
    description: 'Experience the magic of volcanic cliffs, azure caldera views, and legendary sunsets that have inspired artists and dreamers for centuries. Whitewashed buildings cascade down the cliffside into the sapphire Aegean.',
    amenities: [{ icon: Wifi, label: 'WiFi' }, { icon: Waves, label: 'Pool' }, { icon: Sparkles, label: 'Spa' }, { icon: Coffee, label: 'Bar' }, { icon: Car, label: 'Transfer' }],
    highlights: ['Oia Village', 'Caldera Cruise', 'Wine Tasting', 'Black Sand Beach'],
    photos: [['#667eea', '#764ba2'], ['#a8c0ff', '#3f2b96'], ['#c471f5', '#fa71cd'], ['#4facfe', '#00f2fe']],
  },
  {
    id: 2, name: 'Bali', country: 'Indonesia', tagline: 'Island of the Gods',
    rating: 4.8, reviews: 5231, price: 849, duration: '10 days',
    gradient: ['#f093fb', '#f5576c'], lightGradient: ['#f5aafe', '#f87a8e'],
    emoji: '🌺', bg: '#fff0f5',
    tags: ['Culture', 'Nature', 'Spiritual'],
    description: 'Discover lush emerald rice terraces, ancient temples wrapped in incense smoke, and vibrant street ceremonies. Bali is a sensory feast of colour, fragrance, and profound spirituality.',
    amenities: [{ icon: Wifi, label: 'WiFi' }, { icon: Waves, label: 'Pool' }, { icon: Sparkles, label: 'Yoga' }, { icon: Coffee, label: 'Café' }, { icon: Car, label: 'Scooter' }],
    highlights: ['Ubud Rice Fields', 'Tanah Lot Temple', 'Seminyak Beach', 'Mount Batur'],
    photos: [['#f093fb', '#f5576c'], ['#f7971e', '#ffd200'], ['#0ba360', '#3cba92'], ['#a18cd1', '#fbc2eb']],
  },
  {
    id: 3, name: 'Maldives', country: 'Maldives', tagline: 'Crystal waters, endless blue',
    rating: 4.9, reviews: 1892, price: 2499, duration: '5 days',
    gradient: ['#4facfe', '#00f2fe'], lightGradient: ['#7fcaff', '#45f7ff'],
    emoji: '🏝️', bg: '#e8f8ff',
    tags: ['Luxury', 'Beach', 'Diving'],
    description: "Overwater bungalows perched above house reefs, bioluminescent plankton lighting the night sea, and the clearest water on Earth. The Maldives is the ultimate escape from reality.",
    amenities: [{ icon: Wifi, label: 'WiFi' }, { icon: Waves, label: 'Beach' }, { icon: Sparkles, label: 'Spa' }, { icon: Coffee, label: 'Dining' }, { icon: Car, label: 'Seaplane' }],
    highlights: ['Overwater Villa', 'Reef Snorkeling', 'Dolphin Safari', 'Sunset Cruise'],
    photos: [['#4facfe', '#00f2fe'], ['#0ba360', '#3cba92'], ['#667eea', '#764ba2'], ['#f7971e', '#ffd200']],
  },
  {
    id: 4, name: 'Tokyo', country: 'Japan', tagline: 'Future meets tradition',
    rating: 4.9, reviews: 7123, price: 1099, duration: '8 days',
    gradient: ['#a18cd1', '#fbc2eb'], lightGradient: ['#c0aaee', '#fdd3f3'],
    emoji: '🗼', bg: '#f8f0ff',
    tags: ['City', 'Culture', 'Food'],
    description: 'A mesmerizing blend of ultra-modern neon-lit streets and serene centuries-old temples. Tokyo never stops surprising — from robot restaurants to zen gardens hidden between skyscrapers.',
    amenities: [{ icon: Wifi, label: 'WiFi' }, { icon: Sparkles, label: 'Concierge' }, { icon: Coffee, label: 'Omakase' }, { icon: Car, label: 'JR Pass' }, { icon: Waves, label: 'Onsen' }],
    highlights: ['Shibuya Crossing', 'Mt. Fuji Trip', 'Tsukiji Market', 'Akihabara'],
    photos: [['#a18cd1', '#fbc2eb'], ['#f093fb', '#f5576c'], ['#667eea', '#764ba2'], ['#f7971e', '#ffd200']],
  },
  {
    id: 5, name: 'Amalfi Coast', country: 'Italy', tagline: 'Mediterranean perfection',
    rating: 4.8, reviews: 3456, price: 1599, duration: '6 days',
    gradient: ['#f7971e', '#ffd200'], lightGradient: ['#fabb5e', '#ffe84a'],
    emoji: '🍋', bg: '#fffbec',
    tags: ['Scenic', 'Food', 'Culture'],
    description: 'Cliffside villages tumbling into the turquoise Tyrrhenian Sea, fresh-caught seafood on linen-draped terraces, and ice-cold limoncello as the sun dips behind the hills. La dolce vita.',
    amenities: [{ icon: Wifi, label: 'WiFi' }, { icon: Waves, label: 'Pool' }, { icon: Coffee, label: 'Vineyard' }, { icon: Car, label: 'Boat Tour' }, { icon: Sparkles, label: 'Spa' }],
    highlights: ['Positano Village', 'Ravello Gardens', 'Boat Tour', 'Blue Grotto'],
    photos: [['#f7971e', '#ffd200'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'], ['#0ba360', '#3cba92']],
  },
  {
    id: 6, name: 'Costa Rica', country: 'Costa Rica', tagline: 'Pura Vida — pure life',
    rating: 4.7, reviews: 2198, price: 999, duration: '9 days',
    gradient: ['#0ba360', '#3cba92'], lightGradient: ['#3cc87a', '#66d9ab'],
    emoji: '🌿', bg: '#edfaf5',
    tags: ['Adventure', 'Nature', 'Wildlife'],
    description: "Zip-line through misty cloud forests, spot technicolour toucans from your jungle lodge, and unwind on wild untouched beaches. Pura Vida — it's more than a phrase, it's a whole way of being.",
    amenities: [{ icon: Wifi, label: 'WiFi' }, { icon: Sparkles, label: 'Eco-Lodge' }, { icon: Car, label: 'Jeep Tour' }, { icon: Waves, label: 'Beach' }, { icon: Coffee, label: 'Farm Café' }],
    highlights: ['Arenal Volcano', 'Cloud Forest', 'Manuel Antonio', 'Zip-lining'],
    photos: [['#0ba360', '#3cba92'], ['#f7971e', '#ffd200'], ['#4facfe', '#00f2fe'], ['#667eea', '#764ba2']],
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '✈️' },
  { id: 'beach', label: 'Beach', emoji: '🏖️' },
  { id: 'mountain', label: 'Mountain', emoji: '🏔️' },
  { id: 'city', label: 'City', emoji: '🏙️' },
  { id: 'adventure', label: 'Adventure', emoji: '🧗' },
  { id: 'culture', label: 'Culture', emoji: '🎭' },
  { id: 'luxury', label: 'Luxury', emoji: '💎' },
];

const ITINERARY = [
  {
    day: 1, date: 'Mon, Apr 14', title: 'Arrival Day',
    activities: [
      { time: '14:00', title: 'Arrive at Heraklion Airport', sub: 'Flight OA 359 from Athens', emoji: '✈️', color: '#667eea' },
      { time: '15:30', title: 'Private transfer to Oia', sub: '~1.5 hrs scenic drive', emoji: '🚗', color: '#f7971e' },
      { time: '17:00', title: 'Check-in — Mystique Hotel', sub: 'Oia, Caldera View Suite', emoji: '🏨', color: '#0ABFA3' },
      { time: '19:30', title: 'Sunset dinner at Pelekanos', sub: 'Reserve window table', emoji: '🌅', color: '#f093fb' },
    ],
  },
  {
    day: 2, date: 'Tue, Apr 15', title: 'Caldera Exploration',
    activities: [
      { time: '09:00', title: 'Breakfast with caldera view', sub: 'Hotel rooftop terrace', emoji: '☕', color: '#f7971e' },
      { time: '10:30', title: 'Caldera hiking trail', sub: 'Fira to Oia, 10km, 3hrs', emoji: '🥾', color: '#0ba360' },
      { time: '14:00', title: 'Volcanic wine tasting', sub: 'Santo Wines winery', emoji: '🍷', color: '#764ba2' },
      { time: '18:00', title: 'Catamaran sunset cruise', sub: 'Hot springs & swimming', emoji: '⛵', color: '#4facfe' },
    ],
  },
  {
    day: 3, date: 'Wed, Apr 16', title: 'Island Discovery',
    activities: [
      { time: '08:00', title: 'ATV ride to Red Beach', sub: 'Ancient Akrotiri nearby', emoji: '🏍️', color: '#f5576c' },
      { time: '11:00', title: 'Perissa Black Sand Beach', sub: 'Swim & beachside lunch', emoji: '🏖️', color: '#4facfe' },
      { time: '20:00', title: 'Farewell dinner, Imerovigli', sub: 'Panoramic cliff restaurant', emoji: '🍽️', color: '#0ABFA3' },
    ],
  },
];

/* ─── Types ─────────────────────────────────────────── */

type Screen = 'home' | 'detail' | 'itinerary';
type NavTab = 'home' | 'explore' | 'trips' | 'profile';
type Dest = typeof DESTINATIONS[0];

/* ─── Shared style tokens ────────────────────────────── */

const TEAL = '#0ABFA3';
const TEAL_DARK = '#0899c5';
const shadow_card = '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)';
const shadow_float = '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)';
const shadow_teal  = '0 6px 20px rgba(10,191,163,0.38)';
const glass = {
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.85)',
};
const glass_dark = {
  background: 'rgba(26,26,46,0.55)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.15)',
};

/* ─── Gradient Hero "Image" ──────────────────────────── */

function DestHero({ dest, height = 260, children }: { dest: Dest; height?: number; children?: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', height, background: `linear-gradient(145deg, ${dest.gradient[0]}, ${dest.gradient[1]})`, overflow: 'hidden', flexShrink: 0 }}>
      {/* Radial light */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 35% 35%, rgba(255,255,255,0.22) 0%, transparent 65%)' }} />
      {/* Bottom vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }} />
      {/* Emoji watermark */}
      <div style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-55%)', fontSize: 130, opacity: 0.18, userSelect: 'none', lineHeight: 1 }}>{dest.emoji}</div>
      {children}
    </div>
  );
}

/* ─── Destination card (for scroll strips) ──────────── */

function DestCard({ dest, onClick, saved, onSave, width = 180, height = 220 }: { dest: Dest; onClick: () => void; saved: boolean; onSave: (e: React.MouseEvent) => void; width?: number; height?: number }) {
  return (
    <div onClick={onClick} style={{ position: 'relative', width, height, flexShrink: 0, borderRadius: 24, overflow: 'hidden', cursor: 'pointer', boxShadow: shadow_float }}>
      <DestHero dest={dest} height={height} />
      {/* Save */}
      <button onClick={onSave} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...glass_dark, zIndex: 2 }}>
        <Heart size={14} color={saved ? '#ff6b6b' : 'white'} fill={saved ? '#ff6b6b' : 'none'} />
      </button>
      {/* Info overlay */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px', zIndex: 2 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {dest.tags.slice(0, 2).map(t => (
            <span key={t} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}>{t}</span>
          ))}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>{dest.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={10} color="rgba(255,255,255,0.8)" />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{dest.country}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Star size={10} color="#ffd700" fill="#ffd700" />
            <span style={{ fontSize: 11, color: 'white', fontWeight: 700 }}>{dest.rating}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── HOME SCREEN ────────────────────────────────────── */

function HomeScreen({ setScreen, setSelectedDest, activeCategory, setActiveCategory, savedItems, toggleSave }: {
  setScreen: (s: Screen) => void;
  setSelectedDest: (d: Dest) => void;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  savedItems: Set<number>;
  toggleSave: (id: number) => void;
}) {
  const featured = DESTINATIONS[2]; // Maldives as featured
  const popular  = DESTINATIONS.filter(d => d.id !== featured.id).slice(0, 4);

  const openDest = (dest: Dest) => { setSelectedDest(dest); setScreen('detail'); };

  return (
    <div style={{ paddingTop: 60, paddingBottom: 110, background: 'linear-gradient(180deg, #f0f4ff 0%, #faf9f7 160px)' }}>

      {/* Greeting row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.4px' }}>Good morning, Alex 👋</div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>Where to next?</div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: shadow_teal }}>
            🧳
          </div>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 12, height: 12, background: '#ff6b6b', borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 7, color: 'white', fontWeight: 900 }}>3</span>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '16px 24px 0', display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderRadius: 18, boxShadow: shadow_card, ...glass }}>
          <Search size={16} color="#94a3b8" />
          <span style={{ fontSize: 14, color: '#bbc8d8', fontWeight: 500 }}>Search destinations…</span>
        </div>
        <button style={{ width: 50, height: 50, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, boxShadow: shadow_teal, flexShrink: 0 }}>
          <Filter size={18} color="white" />
        </button>
      </div>

      {/* Category chips */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 24px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 16px', borderRadius: 50, fontSize: 13, fontWeight: 600,
                background: active ? `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` : 'white',
                color: active ? 'white' : '#64748b',
                boxShadow: active ? shadow_teal : shadow_card,
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Featured card */}
      <div style={{ padding: '4px 24px 0' }}>
        <div
          onClick={() => openDest(featured)}
          style={{ position: 'relative', borderRadius: 28, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.1)' }}
        >
          <DestHero dest={featured} height={230}>
            {/* Featured badge */}
            <div style={{ position: 'absolute', top: 16, left: 16, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', ...glass_dark, color: 'rgba(255,255,255,0.95)' }}>
              ✦ Featured
            </div>
            {/* Save */}
            <button
              onClick={e => { e.stopPropagation(); toggleSave(featured.id); }}
              style={{ position: 'absolute', top: 12, right: 14, width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...glass_dark }}
            >
              <Heart size={15} color={savedItems.has(featured.id) ? '#ff6b6b' : 'white'} fill={savedItems.has(featured.id) ? '#ff6b6b' : 'none'} />
            </button>
          </DestHero>

          {/* Info strip */}
          <div style={{ background: 'white', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.3px' }}>{featured.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <MapPin size={11} color={TEAL} />
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{featured.country}</span>
                <span style={{ color: '#e2e8f0', fontSize: 12 }}>·</span>
                <Star size={11} color="#fbbf24" fill="#fbbf24" />
                <span style={{ fontSize: 12, color: '#1a1a2e', fontWeight: 700 }}>{featured.rating}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>({(featured.reviews / 1000).toFixed(1)}k)</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>from</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a2e', letterSpacing: '-0.5px' }}>${featured.price.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Popular destinations */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 14px' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.3px' }}>Popular Destinations</div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, color: TEAL, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
            See all <ChevronRight size={13} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 14, padding: '0 24px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {popular.map(dest => (
            <DestCard
              key={dest.id}
              dest={dest}
              width={165}
              height={210}
              onClick={() => openDest(dest)}
              saved={savedItems.has(dest.id)}
              onSave={e => { e.stopPropagation(); toggleSave(dest.id); }}
            />
          ))}
        </div>
      </div>

      {/* Quick picks — horizontal featured list */}
      <div style={{ marginTop: 28, padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.3px' }}>Top Picks for You</div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, color: TEAL, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
            See all <ChevronRight size={13} />
          </button>
        </div>
        {[DESTINATIONS[0], DESTINATIONS[3]].map(dest => (
          <div
            key={dest.id}
            onClick={() => openDest(dest)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 20, background: 'white', marginBottom: 10, cursor: 'pointer', boxShadow: shadow_card }}
          >
            {/* Mini gradient swatch */}
            <div style={{ width: 60, height: 60, borderRadius: 16, background: `linear-gradient(135deg, ${dest.gradient[0]}, ${dest.gradient[1]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
              {dest.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{dest.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{dest.tagline}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {dest.tags.slice(0, 2).map(t => (
                  <span key={t} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: dest.bg, color: dest.gradient[0] }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#1a1a2e' }}>${dest.price.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{dest.duration}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', marginTop: 2 }}>
                <Star size={10} fill="#fbbf24" color="#fbbf24" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>{dest.rating}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── DETAIL SCREEN ──────────────────────────────────── */

function DetailScreen({ dest, setScreen, savedItems, toggleSave }: {
  dest: Dest;
  setScreen: (s: Screen) => void;
  savedItems: Set<number>;
  toggleSave: (id: number) => void;
}) {
  const saved = savedItems.has(dest.id);

  return (
    <div style={{ background: '#faf9f7', minHeight: '100%', paddingBottom: 110 }}>

      {/* Hero */}
      <div style={{ position: 'relative' }}>
        <DestHero dest={dest} height={320} />

        {/* Floating back */}
        <button
          onClick={() => setScreen('home')}
          style={{ position: 'absolute', top: 60, left: 20, width: 38, height: 38, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', ...glass_dark, zIndex: 10 }}
        >
          <ArrowLeft size={16} color="white" />
        </button>

        {/* Floating actions */}
        <div style={{ position: 'absolute', top: 60, right: 20, display: 'flex', gap: 8, zIndex: 10 }}>
          <button style={{ width: 38, height: 38, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', ...glass_dark }}>
            <Share2 size={14} color="white" />
          </button>
          <button
            onClick={() => toggleSave(dest.id)}
            style={{ width: 38, height: 38, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', ...glass_dark }}
          >
            <Bookmark size={14} color={saved ? '#fbbf24' : 'white'} fill={saved ? '#fbbf24' : 'none'} />
          </button>
        </div>

        {/* Pill drag handle peek */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, background: '#faf9f7', borderRadius: '24px 24px 0 0', display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
        </div>
      </div>

      {/* Content card */}
      <div style={{ padding: '8px 22px 0' }}>

        {/* Title + rating */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#1a1a2e', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{dest.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
              <MapPin size={13} color={TEAL} />
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{dest.country}</span>
              <span style={{ color: '#e2e8f0' }}>·</span>
              <Clock size={12} color="#94a3b8" />
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{dest.duration}</span>
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 16, padding: '8px 14px', boxShadow: shadow_card, textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Star size={13} fill="#fbbf24" color="#fbbf24" />
              <span style={{ fontSize: 17, fontWeight: 900, color: '#1a1a2e' }}>{dest.rating}</span>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{(dest.reviews / 1000).toFixed(1)}k reviews</div>
          </div>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
          {dest.tags.map(tag => (
            <span key={tag} style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 50, background: dest.bg, color: dest.gradient[0] }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Description */}
        <div style={{ fontSize: 14, lineHeight: 1.7, color: '#475569', marginBottom: 22 }}>
          {dest.description}
        </div>

        {/* Amenities */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Amenities</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {dest.amenities.map(({ icon: Icon, label }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 0', flex: 1 }}>
                <div style={{ width: 40, height: 40, borderRadius: 14, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: shadow_card }}>
                  <Icon size={16} color={TEAL} />
                </div>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Highlights */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Highlights</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dest.highlights.map((h, i) => (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: 'white', boxShadow: shadow_card }}>
                <div style={{ width: 28, height: 28, borderRadius: 10, background: `linear-gradient(135deg, ${dest.gradient[0]}, ${dest.gradient[1]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13 }}>{['🌅', '⛵', '🍷', '🏖️'][i]}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', flex: 1 }}>{h}</span>
                <ChevronRight size={14} color="#cbd5e1" />
              </div>
            ))}
          </div>
        </div>

        {/* Photo strip */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Photos</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {dest.photos.map((colors, i) => (
              <div key={i} style={{ width: 80, height: 80, borderRadius: 18, background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`, flexShrink: 0, boxShadow: shadow_card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, opacity: 0.9 }}>
                {i === 3 && <div style={{ background: 'rgba(0,0,0,0.45)', width: '100%', height: '100%', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 800 }}>+12</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Price + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 22, background: 'white', boxShadow: shadow_card }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>from per person</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#1a1a2e', letterSpacing: '-0.5px' }}>${dest.price.toLocaleString()}</div>
          </div>
          <button
            onClick={() => setScreen('itinerary')}
            style={{ padding: '14px 28px', borderRadius: 18, background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, color: 'white', fontSize: 14, fontWeight: 800, boxShadow: shadow_teal, border: 'none', cursor: 'pointer', letterSpacing: '0.02em' }}
          >
            Book Now →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── ITINERARY SCREEN ───────────────────────────────── */

function ItineraryScreen({ setScreen, dest }: { setScreen: (s: Screen) => void; dest: Dest }) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1, 2]));
  const toggleDay = (d: number) => setExpandedDays(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });

  return (
    <div style={{ background: '#faf9f7', minHeight: '100%', paddingBottom: 120 }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${dest.gradient[0]}, ${dest.gradient[1]})`, padding: '60px 22px 24px', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
        <button
          onClick={() => setScreen('detail')}
          style={{ width: 36, height: 36, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', ...glass_dark, marginBottom: 16, position: 'relative' }}
        >
          <ArrowLeft size={15} color="white" />
        </button>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', position: 'relative' }}>Your Itinerary</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: 'white', letterSpacing: '-0.5px', lineHeight: 1.1, marginTop: 3, position: 'relative' }}>{dest.name}, {dest.country}</div>
      </div>

      <div style={{ padding: '18px 22px 0' }}>

        {/* Trip summary card */}
        <div style={{ background: 'white', borderRadius: 22, padding: '16px 18px', boxShadow: shadow_card, marginBottom: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { icon: Calendar, label: 'Dates', value: 'Apr 14 – 18', color: TEAL },
            { icon: Users, label: 'Travelers', value: '2 Adults', color: '#f093fb' },
            { icon: Clock, label: 'Duration', value: '4 nights', color: '#f7971e' },
            { icon: Briefcase, label: 'Est. Total', value: `$${(dest.price * 2).toLocaleString()}`, color: '#667eea' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={15} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline days */}
        {ITINERARY.map((day, dayIdx) => {
          const expanded = expandedDays.has(day.day);
          return (
            <div key={day.day} style={{ marginBottom: 14 }}>
              {/* Day header */}
              <button
                onClick={() => toggleDay(day.day)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 18, background: 'white', boxShadow: shadow_card, border: 'none', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg, ${dest.gradient[0]}, ${dest.gradient[1]})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', fontWeight: 700, lineHeight: 1 }}>DAY</span>
                    <span style={{ fontSize: 14, color: 'white', fontWeight: 900, lineHeight: 1 }}>{day.day}</span>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e' }}>{day.title}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{day.date} · {day.activities.length} activities</div>
                  </div>
                </div>
                <ChevronDown size={16} color="#94a3b8" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {/* Activities */}
              {expanded && (
                <div style={{ marginTop: 8, marginLeft: 18, position: 'relative' }}>
                  {/* Timeline spine */}
                  <div style={{ position: 'absolute', left: 17, top: 8, bottom: 8, width: 2, background: 'linear-gradient(to bottom, ' + dest.gradient[0] + '60, ' + dest.gradient[1] + '20)', borderRadius: 1 }} />

                  {day.activities.map((act, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < day.activities.length - 1 ? 10 : 0, position: 'relative' }}>
                      {/* Timeline dot */}
                      <div style={{ width: 36, height: 36, borderRadius: 14, background: act.color + '18', border: '2px solid ' + act.color + '35', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, zIndex: 1 }}>
                        {act.emoji}
                      </div>
                      <div style={{ flex: 1, background: 'white', borderRadius: 16, padding: '10px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{act.title}</div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: act.color, background: act.color + '15', padding: '2px 8px', borderRadius: 8 }}>{act.time}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{act.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Add day button */}
        <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 18, border: `2px dashed ${TEAL}50`, background: TEAL + '08', color: TEAL, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={16} /> Add Day
        </button>
      </div>
    </div>
  );
}

/* ─── EXPLORE SCREEN (simple stub) ──────────────────── */

function ExploreScreen({ setScreen, setSelectedDest, savedItems, toggleSave }: { setScreen: (s: Screen) => void; setSelectedDest: (d: Dest) => void; savedItems: Set<number>; toggleSave: (id: number) => void }) {
  return (
    <div style={{ paddingTop: 60, paddingBottom: 110, background: '#faf9f7', minHeight: '100%' }}>
      <div style={{ padding: '20px 24px 16px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.4px' }}>Explore World</div>
        <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 2 }}>Discover hidden gems</div>
      </div>
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {DESTINATIONS.slice(0, 4).map(dest => (
          <div key={dest.id} onClick={() => { setSelectedDest(dest); setScreen('detail'); }} style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', cursor: 'pointer', height: 140, boxShadow: shadow_float }}>
            <DestHero dest={dest} height={140} />
            <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'white' }}>{dest.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{dest.country} · from ${dest.price.toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.35)', padding: '4px 10px', borderRadius: 12, backdropFilter: 'blur(8px)' }}>
                <Star size={11} fill="#ffd700" color="#ffd700" />
                <span style={{ fontSize: 12, color: 'white', fontWeight: 700 }}>{dest.rating}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── BOTTOM NAV ─────────────────────────────────────── */

function BottomNav({ navTab, setNavTab, setScreen }: { navTab: NavTab; setNavTab: (t: NavTab) => void; setScreen: (s: Screen) => void }) {
  const tabs: { id: NavTab; icon: React.ElementType; label: string; screenTarget?: Screen }[] = [
    { id: 'home',    icon: Home,     label: 'Home',    screenTarget: 'home' },
    { id: 'explore', icon: Compass,  label: 'Explore', screenTarget: 'home' },
    { id: 'trips',   icon: Briefcase,label: 'Trips',   screenTarget: 'itinerary' },
    { id: 'profile', icon: User,     label: 'Profile' },
  ];

  return (
    <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16, zIndex: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px 10px', borderRadius: 30, ...glass, boxShadow: '0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)' }}>
        {tabs.slice(0, 2).map(tab => {
          const Icon = tab.icon;
          const active = navTab === tab.id;
          return (
            <button key={tab.id} onClick={() => { setNavTab(tab.id); if (tab.screenTarget) setScreen(tab.screenTarget); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 14px', borderRadius: 20, background: 'none', border: 'none', cursor: 'pointer' }}>
              <Icon size={20} color={active ? TEAL : '#94a3b8'} strokeWidth={active ? 2.5 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: 600, color: active ? TEAL : '#94a3b8' }}>{tab.label}</span>
              {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: TEAL, marginTop: -2 }} />}
            </button>
          );
        })}

        {/* Center action button */}
        <button
          onClick={() => { setNavTab('explore'); setScreen('home'); }}
          style={{ width: 52, height: 52, borderRadius: '50%', background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: shadow_teal, border: 'none', cursor: 'pointer', marginTop: -20 }}
        >
          <span style={{ fontSize: 22 }}>✈️</span>
        </button>

        {tabs.slice(2).map(tab => {
          const Icon = tab.icon;
          const active = navTab === tab.id;
          return (
            <button key={tab.id} onClick={() => { setNavTab(tab.id); if (tab.screenTarget) setScreen(tab.screenTarget); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 14px', borderRadius: 20, background: 'none', border: 'none', cursor: 'pointer' }}>
              <Icon size={20} color={active ? TEAL : '#94a3b8'} strokeWidth={active ? 2.5 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: 600, color: active ? TEAL : '#94a3b8' }}>{tab.label}</span>
              {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: TEAL, marginTop: -2 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── ROOT ───────────────────────────────────────────── */

export default function TravelApp() {
  const [screen, setScreen]               = useState<Screen>('home');
  const [navTab, setNavTab]               = useState<NavTab>('home');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedDest, setSelectedDest]   = useState(DESTINATIONS[2]);
  const [savedItems, setSavedItems]       = useState<Set<number>>(new Set([2, 4]));

  const toggleSave = (id: number) =>
    setSavedItems(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 20%, #dbeafe 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, #fce7f3 0%, transparent 50%), linear-gradient(135deg, #f0f4ff 0%, #fdf4ff 50%, #fff7ed 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    }}>

      {/* Phone frame */}
      <div style={{
        position: 'relative',
        width: 390,
        height: 844,
        borderRadius: 52,
        overflow: 'hidden',
        background: '#faf9f7',
        border: '10px solid #18182a',
        boxShadow: [
          '0 50px 120px rgba(0,0,0,0.28)',
          '0 20px 40px rgba(0,0,0,0.15)',
          'inset 0 0 0 1px rgba(255,255,255,0.08)',
        ].join(', '),
      }}>

        {/* Screen reflection overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)', zIndex: 60, pointerEvents: 'none', borderRadius: 42 }} />

        {/* Dynamic Island notch */}
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 120, height: 34, background: '#18182a', borderRadius: 22, zIndex: 55, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
          {/* Front camera dot */}
          <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#1e1e30', border: '1.5px solid #2a2a45', boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }} />
        </div>

        {/* Status bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', zIndex: 50 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: screen === 'detail' ? 'rgba(255,255,255,0.9)' : '#1a1a2e' }}>9:41</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {/* Signal bars */}
            <div style={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
              {[5, 8, 10, 13].map((h, i) => (
                <div key={i} style={{ width: 3, height: h, background: screen === 'detail' ? 'rgba(255,255,255,0.85)' : '#1a1a2e', borderRadius: 1.5, opacity: i < 3 ? 1 : 0.5 }} />
              ))}
            </div>
            {/* Wifi */}
            <Wifi size={12} color={screen === 'detail' ? 'rgba(255,255,255,0.85)' : '#1a1a2e'} />
            {/* Battery */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 22, height: 11, border: `1.5px solid ${screen === 'detail' ? 'rgba(255,255,255,0.7)' : '#1a1a2e'}`, borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '75%', height: '100%', background: '#34c759', borderRadius: 1.5 }} />
              </div>
              <div style={{ width: 2, height: 5, background: screen === 'detail' ? 'rgba(255,255,255,0.6)' : '#1a1a2e', borderRadius: '0 1px 1px 0', marginLeft: 1 }} />
            </div>
          </div>
        </div>

        {/* Scrollable content area */}
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {screen === 'home' && navTab !== 'explore' && (
            <HomeScreen
              setScreen={setScreen}
              setSelectedDest={setSelectedDest}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              savedItems={savedItems}
              toggleSave={toggleSave}
            />
          )}
          {screen === 'home' && navTab === 'explore' && (
            <ExploreScreen
              setScreen={setScreen}
              setSelectedDest={setSelectedDest}
              savedItems={savedItems}
              toggleSave={toggleSave}
            />
          )}
          {screen === 'detail' && (
            <DetailScreen
              dest={selectedDest}
              setScreen={setScreen}
              savedItems={savedItems}
              toggleSave={toggleSave}
            />
          )}
          {screen === 'itinerary' && (
            <ItineraryScreen
              dest={selectedDest}
              setScreen={setScreen}
            />
          )}
        </div>

        {/* Bottom nav — always on top */}
        <BottomNav navTab={navTab} setNavTab={setNavTab} setScreen={setScreen} />
      </div>
    </div>
  );
}
