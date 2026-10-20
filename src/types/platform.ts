import type { IconComponent } from "@/components/icons/BrandIcons";
import type { Platform } from "@/types/database";

export type { Platform };

export interface PlatformConfig {
  id: Platform;
  label: string;
  color: string;
  icon: IconComponent;
  characterLimit: number;
}
