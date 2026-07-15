export type PendingItem = {
  id: string;
  primary: string;
  secondary: string;
  href: string;
};

export type PendingItemGroups = {
  pgrsExpired: PendingItem[];
  controlsOverdue: PendingItem[];
  episLowStock: PendingItem[];
};
