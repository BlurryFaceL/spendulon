import React from 'react';
import {
  Wallet,
  Gift,
  DollarSign,
  Building2,
  ShoppingBag,
  Car,
  Utensils,
  Home,
  CreditCard,
  Briefcase,
  Heart,
  Plane,
  Smartphone,
  Droplet,
  Zap,
  ShoppingCart,
  Baby,
  Pill,
  Dumbbell,
  Music,
  Film,
  Bus,
  Coffee,
  Bitcoin,
  Shirt,
  Building,
  Wrench,
  Banknote,
  Landmark,
  GraduationCap,
  User2,
  Wifi,
  TrendingUp
} from 'lucide-react';

// Icon mapping object - maps icon names to React components
export const ICON_MAP = {
  Wallet,
  Gift,
  DollarSign,
  Building2,
  ShoppingBag,
  Car,
  Utensils,
  Home,
  CreditCard,
  Briefcase,
  Heart,
  Plane,
  Smartphone,
  Droplet,
  Zap,
  ShoppingCart,
  Baby,
  Pill,
  Dumbbell,
  Music,
  Film,
  Bus,
  Coffee,
  Bitcoin,
  Shirt,
  Building,
  Wrench,
  Banknote,
  Landmark,
  GraduationCap,
  User2,
  Wifi,
  TrendingUp
};

// Helper function to render an icon by name
export const renderIcon = (iconName, props = {}) => {
  const IconComponent = ICON_MAP[iconName];
  if (!IconComponent) {
    // Fallback to Wallet icon if icon not found
    return <Wallet {...props} />;
  }
  return <IconComponent {...props} />;
};

// User-friendly icon name mapping
export const ICON_DISPLAY_NAMES = {
  Wallet: 'Wallet',
  Gift: 'Gifts',
  DollarSign: 'Money',
  Building2: 'Office',
  ShoppingBag: 'Shopping',
  Car: 'Car',
  Utensils: 'Dining',
  Home: 'Home',
  CreditCard: 'Credit Card',
  Briefcase: 'Business',
  Heart: 'Health',
  Plane: 'Travel',
  Smartphone: 'Phone',
  Droplet: 'Water',
  Zap: 'Electricity',
  ShoppingCart: 'Groceries',
  Baby: 'Children',
  Pill: 'Medicine',
  Dumbbell: 'Fitness',
  Music: 'Music',
  Film: 'Movies',
  Bus: 'Public Transport',
  Coffee: 'Coffee',
  Bitcoin: 'Crypto',
  Shirt: 'Clothing',
  Building: 'Property',
  Wrench: 'Repairs',
  Banknote: 'Income',
  Landmark: 'Government',
  GraduationCap: 'Education',
  User2: 'Personal',
  Wifi: 'Internet',
  TrendingUp: 'Investments'
};

// Get user-friendly display name for an icon
export const getIconDisplayName = (iconName) => {
  return ICON_DISPLAY_NAMES[iconName] || iconName;
};

// Get all available icon names
export const getAvailableIconNames = () => {
  return Object.keys(ICON_MAP);
};