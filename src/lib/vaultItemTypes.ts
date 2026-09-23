import {
  Car,
  CreditCard,
  Database,
  FileText,
  Fingerprint,
  Globe,
  HeartPulse,
  Landmark,
  Laptop,
  LockKeyhole,
  Mail,
  MessageSquare,
  Server,
  Terminal,
  Ticket,
  Umbrella,
  UserRound,
  Wifi,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { VaultKind } from "@/lib/vaultRepository";

export interface VaultKindMeta {
  value: VaultKind;
  title: string;
  icon: LucideIcon;
  color: string;
  detailLabel: string;
  detailPlaceholder: string;
  secretLabel?: string;
}

export interface VaultKindGroup {
  title: string;
  kinds: VaultKindMeta[];
}

export const kindGroups: VaultKindGroup[] = [
  {
    title: "Logins & notes",
    kinds: [
      {
        value: "login",
        title: "Password",
        icon: LockKeyhole,
        color: "#426f5b",
        detailLabel: "Username or email",
        detailPlaceholder: "you@example.com",
        secretLabel: "Password",
      },
      {
        value: "note",
        title: "Secure note",
        icon: FileText,
        color: "#d68b35",
        detailLabel: "Summary",
        detailPlaceholder: "What is this note about?",
      },
      {
        value: "contact",
        title: "Contact info",
        icon: UserRound,
        color: "#5b7fa8",
        detailLabel: "Full name",
        detailPlaceholder: "Full name",
      },
    ],
  },
  {
    title: "Payments",
    kinds: [
      {
        value: "card",
        title: "Payment card",
        icon: CreditCard,
        color: "#8e67cf",
        detailLabel: "Card number",
        detailPlaceholder: "•••• •••• •••• 1234",
        secretLabel: "Security code",
      },
      {
        value: "bank",
        title: "Bank account",
        icon: Landmark,
        color: "#3f6f8f",
        detailLabel: "Account number",
        detailPlaceholder: "Account number",
        secretLabel: "PIN code",
      },
    ],
  },
  {
    title: "Identity documents",
    kinds: [
      {
        value: "license",
        title: "Drivers license",
        icon: Car,
        color: "#a3743b",
        detailLabel: "License number",
        detailPlaceholder: "License number",
      },
      {
        value: "passport",
        title: "Passport",
        icon: Globe,
        color: "#2f6f63",
        detailLabel: "Passport number",
        detailPlaceholder: "Passport number",
      },
      {
        value: "ssn",
        title: "Social security number",
        icon: Fingerprint,
        color: "#8a5b6f",
        detailLabel: "Name on record",
        detailPlaceholder: "Legal name",
        secretLabel: "Number",
      },
    ],
  },
  {
    title: "Personal",
    kinds: [
      {
        value: "health",
        title: "Health insurance",
        icon: HeartPulse,
        color: "#b4574c",
        detailLabel: "Member ID",
        detailPlaceholder: "Member ID",
      },
      {
        value: "insurance",
        title: "Insurance policy",
        icon: Umbrella,
        color: "#6d7fa6",
        detailLabel: "Policy number",
        detailPlaceholder: "Policy number",
      },
      {
        value: "membership",
        title: "Membership card",
        icon: Ticket,
        color: "#c08a2e",
        detailLabel: "Member number",
        detailPlaceholder: "Member number",
      },
      {
        value: "wifi",
        title: "Wi-Fi password",
        icon: Wifi,
        color: "#4d8177",
        detailLabel: "Network name",
        detailPlaceholder: "Network name",
        secretLabel: "Network password",
      },
    ],
  },
  {
    title: "Accounts",
    kinds: [
      {
        value: "email",
        title: "Email account",
        icon: Mail,
        color: "#4a6fb5",
        detailLabel: "Email address",
        detailPlaceholder: "you@example.com",
        secretLabel: "Password",
      },
      {
        value: "messenger",
        title: "Instant messenger",
        icon: MessageSquare,
        color: "#5f8f6b",
        detailLabel: "Username",
        detailPlaceholder: "Handle or username",
        secretLabel: "Password",
      },
    ],
  },
  {
    title: "Developer",
    kinds: [
      {
        value: "database",
        title: "Database",
        icon: Database,
        color: "#6b6f9c",
        detailLabel: "Connection string",
        detailPlaceholder: "host:port/database",
        secretLabel: "Password",
      },
      {
        value: "server",
        title: "Server",
        icon: Server,
        color: "#5d6e78",
        detailLabel: "Hostname",
        detailPlaceholder: "server.example.com",
        secretLabel: "Password",
      },
      {
        value: "ssh",
        title: "SSH key",
        icon: Terminal,
        color: "#3f5f52",
        detailLabel: "Key name",
        detailPlaceholder: "id_ed25519",
        secretLabel: "Private key",
      },
      {
        value: "software",
        title: "Software license",
        icon: Laptop,
        color: "#9c6a4d",
        detailLabel: "Licensed to",
        detailPlaceholder: "Licensed name",
        secretLabel: "License key",
      },
    ],
  },
];

export const tagPalette = [
  "#4a6fb5",
  "#426f5b",
  "#c08a2e",
  "#8e67cf",
  "#b4574c",
  "#3f8f8a",
  "#9c6a4d",
  "#6b6f9c",
];

const byValue = new Map(
  kindGroups.flatMap((group) => group.kinds).map((kind) => [kind.value, kind])
);

export function kindMeta(kind: VaultKind): VaultKindMeta {
  return byValue.get(kind) ?? byValue.get("note")!;
}
