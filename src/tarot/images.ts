import { existsSync } from "fs";
import { join } from "path";
import { InputFile, InputMediaBuilder } from "grammy";
import type { Api } from "grammy";
import { Card, updateCardFileId } from "./cards";
import type { DrawnCard } from "./deck";

const PROJECT_ROOT = join(__dirname, "..", "..");

export function getImagePath(card: Card): string {
  return join(PROJECT_ROOT, card.image_path);
}

export function hasLocalImage(card: Card): boolean {
  return existsSync(getImagePath(card));
}

function getPhotoSource(card: Card): string | InputFile | null {
  if (card.tg_file_id) return card.tg_file_id;
  const p = getImagePath(card);
  if (!existsSync(p)) return null;
  return new InputFile(p, `${card.name_ru}.jpg`);
}

export async function sendCardsMediaGroup(
  api: Api,
  chatId: number,
  drawn: DrawnCard[]
): Promise<void> {
  const validDrawn: DrawnCard[] = [];
  for (const d of drawn) {
    if (getPhotoSource(d.card)) validDrawn.push(d);
  }
  if (validDrawn.length === 0) return;

  if (validDrawn.length === 1) {
    const d = validDrawn[0];
    const src = getPhotoSource(d.card)!;
    const orient = d.reversed ? "перевёрнутая" : "прямая";
    const result = await api.sendPhoto(chatId, src, {
      caption: `🃏 ${d.card.name_ru} (${orient})`,
    });
    if (!d.card.tg_file_id && result.photo?.length) {
      const biggest = result.photo[result.photo.length - 1];
      updateCardFileId(d.card.id, biggest.file_id, biggest.file_unique_id);
    }
    return;
  }

  const media = validDrawn.map((d) => {
    const src = getPhotoSource(d.card)!;
    const orient = d.reversed ? "перевёрнутая" : "прямая";
    return InputMediaBuilder.photo(src, {
      caption: `🃏 ${d.card.name_ru} (${orient})`,
    });
  });

  const results = await api.sendMediaGroup(chatId, media);

  for (let i = 0; i < results.length; i++) {
    const card = validDrawn[i]?.card;
    if (!card || card.tg_file_id) continue;
    const msg = results[i] as any;
    const photo = msg.photo;
    if (photo?.length) {
      const biggest = photo[photo.length - 1];
      updateCardFileId(card.id, biggest.file_id, biggest.file_unique_id);
    }
  }
}
