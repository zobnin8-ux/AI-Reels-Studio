import type { ProjectId, StudioState } from "@/lib/state";

/**
 * Текст для ZIP: подсказки по шрифтам под монтаж в Canva (и аналоги).
 */

const CANVA_NOTE =
  "Ориентир под поиск в Canva → Текст. Если семейства нет — возьми близкий sans/serif из той же группы и проверь кириллицу в превью.";

type StylePack = {
  headline: string;
  body: string;
  alt: string[];
  notes: string;
};

function packForProject(project: ProjectId): StylePack {
  switch (project) {
    case "poslenego":
      return {
        headline: "Cormorant Garamond, Lora Medium — короткие ударные строки.",
        body: "Inter, Source Sans Pro — второй уровень при необходимости.",
        alt: ["Merriweather", "Libre Baskerville", "Spectral"],
        notes: "Мало текста на кадр; сериф только для акцента."
      };
    case "zobnin":
      return {
        headline: "Inter SemiBold, IBM Plex Sans Medium — системные заголовки.",
        body: "IBM Plex Sans, DM Sans — пояснения и цифры.",
        alt: ["Space Grotesk", "Source Sans Pro", "Roboto Mono (точечно для цифр)"],
        notes: "Современный sans; без декоративных дисплеев."
      };
    case "olgatrip":
      return {
        headline: "Cormorant Garamond, Lora Medium, Playfair Display — тёплый акцент.",
        body: "Montserrat Light/Regular, Nunito Sans, Open Sans.",
        alt: ["Libre Baskerville", "Merriweather"],
        notes: "Без «громких» дисплеев; кириллицу проверь в превью (Я, Ё, й)."
      };
  }
}

export function formatTypographyNotesForZip(state: StudioState): string {
  const pack = packForProject(state.project);
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
  lines.push("");
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
