interface ThemeParams {
  bg_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
  button_color?: string;
  destructive_text_color?: string;
  section_bg_color?: string;
}

interface TelegramWebApp {
  initData: string;
  colorScheme?: "light" | "dark";
  themeParams?: ThemeParams;
  ready: () => void;
  expand: () => void;
  onEvent?: (eventType: string, callback: () => void) => void;
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp };
}
