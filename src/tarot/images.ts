import { existsSync } from "fs";
import { join } from "path";
import { InputFile, InputMediaBuilder } from "grammy";
import type { Api } from "grammy";
import { Card, getCardName } from "./cards";
import type { DrawnCard } from "./deck";
import { getCachedFileId, upsertCardCache } from "../db";
import { t, Lang } from "../i18n";

const PROJECT_ROOT = join(__dirname, "..", "..");

export function getImagePath(card: Card): string {
  return join(PROJECT_ROOT, card.image_path);
}

export function hasLocalImage(card: Card): boolean {
  return existsSync(getImagePath(card));
}

function getPhotoSource(card: Card): string | InputFile | null {
  const cached = getCachedFileId(card.id);
  if (cached) return cached.tg_file_id;
  const p = getImagePath(card);
  if (!existsSync(p)) return null;
  return new InputFile(p, `${card.name_ru}.jpg`);
}

function isAlreadyCached(cardId: number): boolean {
  return getCachedFileId(cardId) !== null;
}

export async function sendCardsMediaGroup(
  api: Api,
  chatId: number,
  drawn: DrawnCard[],
  lang: Lang = "ru"
): Promise<void> {
  const validDrawn: DrawnCard[] = [];
  for (const d of drawn) {
    if (getPhotoSource(d.card)) validDrawn.push(d);
  }
  if (validDrawn.length === 0) return;

  if (validDrawn.length === 1) {
    const d = validDrawn[0];
    const src = getPhotoSource(d.card)!;
    const orient = t(d.reversed ? "common.reversed" : "common.upright", lang);
    const result = await api.sendPhoto(chatId, src, {
      caption: `🃏 ${getCardName(d.card, lang)} (${orient})`,
    });
    if (!isAlreadyCached(d.card.id) && result.photo?.length) {
      const biggest = result.photo[result.photo.length - 1];
      upsertCardCache(d.card.id, biggest.file_id, biggest.file_unique_id);
    }
    return;
  }

  const media = validDrawn.map((d) => {
    const src = getPhotoSource(d.card)!;
    const orient = t(d.reversed ? "common.reversed" : "common.upright", lang);
    return InputMediaBuilder.photo(src, {
      caption: `🃏 ${getCardName(d.card, lang)} (${orient})`,
    });
  });

  const results = await api.sendMediaGroup(chatId, media);

  for (let i = 0; i < results.length; i++) {
    const card = validDrawn[i]?.card;
    if (!card || isAlreadyCached(card.id)) continue;
    const msg = results[i] as any;
    const photo = msg.photo;
    if (photo?.length) {
      const biggest = photo[photo.length - 1];
      upsertCardCache(card.id, biggest.file_id, biggest.file_unique_id);
    }
  }
}
