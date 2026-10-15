import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Car,
  Grid2X2,
  Heart,
  List,
  Plane,
  Star,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { suggestedScreenIcon } from "@/lib/userScreensSummaries";
import { USER_SCREEN_ICONS, type UserScreenIcon } from "@/types/userScreens";

export const USER_SCREEN_ICON_OPTIONS: { id: UserScreenIcon; label: string; icon: LucideIcon }[] = [
  { id: "grid", label: "Grid", icon: Grid2X2 },
  { id: "plane", label: "Travel", icon: Plane },
  { id: "wallet", label: "Money", icon: Wallet },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "car", label: "Car", icon: Car },
  { id: "utensils", label: "Food", icon: Utensils },
  { id: "book", label: "Notes", icon: BookOpen },
  { id: "users", label: "People", icon: Users },
  { id: "briefcase", label: "Work", icon: Briefcase },
  { id: "heart", label: "Health", icon: Heart },
  { id: "star", label: "Star", icon: Star },
  { id: "list", label: "List", icon: List },
];

const ICONS = Object.fromEntries(USER_SCREEN_ICON_OPTIONS.map((item) => [item.id, item.icon])) as Record<
  UserScreenIcon,
  LucideIcon
>;

export function screenIcon(icon: string, name = ""): LucideIcon {
  const id = (USER_SCREEN_ICONS as readonly string[]).includes(icon) ? icon : suggestedScreenIcon(name);
  return ICONS[id as UserScreenIcon];
}
