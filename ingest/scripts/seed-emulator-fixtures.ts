// Mock data fixtures for emulator seeding
import { SOFIA_BOUNDS } from "@/lib/bounds";

// Re-export for convenience
export { SOFIA_BOUNDS };

export const CATEGORIES = [
  "water",
  "electricity",
  "heating",
  "road-block",
  "traffic",
  "construction-and-repairs",
  "public-transport",
] as const;

export const SOFIA_STREETS = [
  "бул. Витоша",
  "бул. Мария Луиза",
  "бул. Цар Освободител",
  "ул. Граф Игнатиев",
  "бул. Сливница",
  "ул. Раковски",
  "бул. Драган Цанков",
];

export const INTEREST_ZONES = [
  {
    name: "Центъра",
    center: { lat: 42.6977, lng: 23.3219 }, // Sofia center
  },
  {
    name: "Младост",
    center: { lat: 42.6476, lng: 23.3768 },
  },
  {
    name: "Студентски град",
    center: { lat: 42.6558, lng: 23.3518 },
  },
];

export interface MessageConfig {
  readonly category: readonly string[];
  readonly type: "point" | "line";
  readonly street: string;
  readonly text: string;
}

export const MESSAGE_CONFIGS: readonly MessageConfig[] = [
  // Water outages (Points)
  {
    category: ["water"],
    type: "point",
    street: "бул. Витоша",
    text: "Планирано прекъсване на водоподаването",
  },
  {
    category: ["water"],
    type: "point",
    street: "бул. Мария Луиза",
    text: "Авария на водопровод",
  },
  // Heating (Points)
  {
    category: ["heating"],
    type: "point",
    street: "бул. Цар Освободител",
    text: "Ремонт на топлопровод",
  },
  {
    category: ["heating"],
    type: "point",
    street: "ул. Граф Игнатиев",
    text: "Подмяна на участък от топлопреносната мрежа",
  },
  // Electricity (Points)
  {
    category: ["electricity"],
    type: "point",
    street: "бул. Сливница",
    text: "Планирано изключване на електроподаването",
  },
  // Road blocks (LineStrings)
  {
    category: ["road-block", "construction-and-repairs"],
    type: "line",
    street: "ул. Раковски",
    text: "Ремонт на пътно платно, затруднено движение",
  },
  {
    category: ["road-block"],
    type: "line",
    street: "бул. Драган Цанков",
    text: "Временно затваряне на участък",
  },
  // Traffic
  {
    category: ["traffic"],
    type: "line",
    street: "бул. Витоша",
    text: "Интензивен трафик",
  },
  // Construction
  {
    category: ["construction-and-repairs"],
    type: "point",
    street: "бул. Мария Луиза",
    text: "Строително-ремонтни дейности",
  },
  {
    category: ["construction-and-repairs"],
    type: "point",
    street: "бул. Цар Освободител",
    text: "Подмяна на водопроводна инсталация",
  },
  // Public transport
  {
    category: ["public-transport"],
    type: "line",
    street: "ул. Граф Игнатиев",
    text: "Променен маршрут на автобусна линия",
  },
  {
    category: ["public-transport"],
    type: "point",
    street: "бул. Сливница",
    text: "Временна автобусна спирка",
  },
  // Mixed categories
  {
    category: ["water", "construction-and-repairs"],
    type: "point",
    street: "ул. Раковски",
    text: "Ремонт на водопроводна мрежа",
  },
  {
    category: ["road-block", "traffic"],
    type: "line",
    street: "бул. Драган Цанков",
    text: "Пътни ремонти с ограничение на движението",
  },
  {
    category: ["heating", "construction-and-repairs"],
    type: "point",
    street: "бул. Витоша",
    text: "Реконструкция на топлопровод",
  },
  // Future events
  {
    category: ["water"],
    type: "point",
    street: "бул. Мария Луиза",
    text: "Планирани профилактични дейности",
  },
  {
    category: ["electricity"],
    type: "point",
    street: "бул. Цар Освободител",
    text: "Профилактика на електроразпределителната мрежа",
  },
  // Past events
  {
    category: ["road-block"],
    type: "line",
    street: "ул. Граф Игнатиев",
    text: "Приключили ремонтни дейности",
  },
];
