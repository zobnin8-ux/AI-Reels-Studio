import type { StudioState } from "@/lib/state";

/**
 * Текст для ZIP: подсказки по шрифтам под монтаж в Canva (и аналоги).
 * Не дублируем в UI — только экспорт.
 */

const CANVA_NOTE =
  "Ориентир под поиск в Canva → Текст. Если семейства нет — возьми близкий sans/serif из той же группы и проверь кириллицу в превью.";

type StylePack = {
  headline: string;
  body: string;
  alt: string[];
  notes: string;
};

function packForVisualStyle(style: StudioState["visualStyle"]): StylePack {
  switch (style) {
    case "darkBrutal":
      return {
        headline: "League Spartan, Oswald, Bebas Neue — ударные заголовки.",
        body: "Montserrat SemiBold/Bold, IBM Plex Sans — короткие строки.",
        alt: ["Anton", "Teko", "Barlow Condensed"],
        notes: "Мало текста, крупно."
      };
    case "lightMinimal":
      return {
        headline: "Montserrat Light/Regular, Nunito Sans.",
        body: "Open Sans, Lato — второй уровень.",
        alt: ["Raleway", "Work Sans", "Source Sans Pro"],
        notes: "Много воздуха; не больше двух начертаний на кадр."
      };
    case "brightPositive":
      return {
        headline: "Poppins SemiBold, Montserrat Bold.",
        body: "Nunito, Open Sans.",
        alt: ["Quicksand", "DM Sans", "Rubik"],
        notes: "Высокий контраст; без мелкого гарнитура."
      };
    case "portraLifestyle":
      return {
        headline: "Lora Medium, Merriweather Bold.",
        body: "Montserrat, Open Sans.",
        alt: ["Crimson Pro", "Libre Baskerville", "Playfair Display"],
        notes: "Один акцентный стиль на кадр."
      };
    case "editorial":
      return {
        headline: "Playfair Display, Cormorant Garamond.",
        body: "Libre Baskerville, Lora, Source Serif Pro.",
        alt: ["Merriweather", "Noto Serif", "Spectral"],
        notes: "Сериф только для коротких строк."
      };
    case "tech":
      return {
        headline: "Inter SemiBold, IBM Plex Sans Medium.",
        body: "IBM Plex Sans, Source Sans Pro.",
        alt: ["Space Grotesk", "DM Sans", "Roboto Mono (точечно для цифр)"],
        notes: "Ровная сетка; не смешивать три семейства."
      };
  }
}

function olgaTripBlock(): string {
  return `--- OlgaTrip / Cashmere Coast ---
Заголовки / акцент: Cormorant Garamond, Lora Medium, Playfair Display (тёплый акцент).
Основной текст: Montserrat Light/Regular, Nunito Sans, Open Sans.
Ещё в Canva: Libre Baskerville, Merriweather (коротко).
Заметки: без «громких» дисплеев и неона; кириллицу проверь в превью (Я, Ё, й).`;
}

export function formatTypographyNotesForZip(state: StudioState): string {
  const pack = packForVisualStyle(state.visualStyle);
  const lines: string[] = [];

  lines.push("Типографика для монтажа (Canva и аналоги)");
  lines.push("=".repeat(42));
  lines.push("");
  lines.push(CANVA_NOTE);
  lines.push("");
  lines.push(`Проект: ${state.project}`);
  lines.push(
    `Формат: ${state.contentType === "reels" ? "Reels 9:16 — 1080×1920 px" : "Пост Instagram 4:5 — 1080×1350 px"}`
  );
  lines.push(`Визуальный стиль (селектор): ${state.visualStyle}`);
  lines.push(`Настроение: ${state.mood}`);
  lines.push(`Режим текста: ${state.outputMode}`);
  lines.push("");

  if (state.project === "olgatrip") {
    lines.push(olgaTripBlock());
    lines.push("");
    lines.push("--- По селектору Visual Style (дополнительно) ---");
  }

  lines.push(`Заголовки / крупный текст: ${pack.headline}`);
  lines.push(`Подписи / второй уровень: ${pack.body}`);
  lines.push(`Другие варианты в библиотеке Canva: ${pack.alt.join(", ")}`);
  lines.push(`Заметки: ${pack.notes}`);
  lines.push("");
  lines.push("--- Кириллица ---");
  lines.push(
    "Для русского текста проверьте глифы в превью. Часто безопасны: Montserrat, Open Sans, Roboto, Noto Sans, PT Sans (если есть в вашей версии Canva)."
  );

  return lines.join("\n");
}
