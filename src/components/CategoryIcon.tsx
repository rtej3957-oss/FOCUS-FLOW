import React from 'react';
import {
  BookOpen,
  Briefcase,
  Code2,
  Compass,
  Droplets,
  Dumbbell,
  GraduationCap,
  Heart,
  Laptop,
  Layers,
  Sparkles,
  Sunrise,
  User,
  Wallet,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  User,
  GraduationCap,
  Briefcase,
  Dumbbell,
  Wallet,
  Laptop,
  BookOpen,
  Code2,
  Heart,
  Compass,
  Sparkles,
  Layers,
  Droplets,
  Sunrise,
};

export const CategoryIcon: React.FC<{
  name: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ name, className = 'w-4 h-4', style }) => {
  const IconComp = ICON_MAP[name] ?? Layers;
  return <IconComp className={className} style={style} />;
};
