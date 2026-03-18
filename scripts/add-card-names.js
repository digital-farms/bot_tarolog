// Script to add name_uk and name_en fields to cards.json
const fs = require("fs");
const path = require("path");

const CARDS_PATH = path.join(__dirname, "..", "data", "cards.json");
const cards = JSON.parse(fs.readFileSync(CARDS_PATH, "utf-8"));

// Major Arcana names
const majorEN = {
  0: "The Fool",
  1: "The Magician",
  2: "The High Priestess",
  3: "The Empress",
  4: "The Emperor",
  5: "The Hierophant",
  6: "The Lovers",
  7: "The Chariot",
  8: "Strength",
  9: "The Hermit",
  10: "Wheel of Fortune",
  11: "Justice",
  12: "The Hanged Man",
  13: "Death",
  14: "Temperance",
  15: "The Devil",
  16: "The Tower",
  17: "The Star",
  18: "The Moon",
  19: "The Sun",
  20: "Judgement",
  21: "The World",
};

const majorUK = {
  0: "Блазень",
  1: "Маг",
  2: "Верховна Жриця",
  3: "Імператриця",
  4: "Імператор",
  5: "Ієрофант",
  6: "Закохані",
  7: "Колісниця",
  8: "Сила",
  9: "Відлюдник",
  10: "Колесо Фортуни",
  11: "Справедливість",
  12: "Повішений",
  13: "Смерть",
  14: "Поміркованість",
  15: "Диявол",
  16: "Вежа",
  17: "Зірка",
  18: "Місяць",
  19: "Сонце",
  20: "Суд",
  21: "Світ",
};

// Minor Arcana suit names
const suitEN = { wands: "Wands", cups: "Cups", swords: "Swords", pentacles: "Pentacles" };
const suitUK = { wands: "Жезлів", cups: "Кубків", swords: "Мечів", pentacles: "Пентаклів" };

// Rank names
const rankEN = {
  1: "Ace of",
  2: "Two of",
  3: "Three of",
  4: "Four of",
  5: "Five of",
  6: "Six of",
  7: "Seven of",
  8: "Eight of",
  9: "Nine of",
  10: "Ten of",
  11: "Page of",
  12: "Knight of",
  13: "Queen of",
  14: "King of",
};

const rankUK = {
  1: "Туз",
  2: "Двійка",
  3: "Трійка",
  4: "Четвірка",
  5: "П'ятірка",
  6: "Шістка",
  7: "Сімка",
  8: "Вісімка",
  9: "Дев'ятка",
  10: "Десятка",
  11: "Паж",
  12: "Лицар",
  13: "Королева",
  14: "Король",
};

for (const card of cards) {
  if (card.arcana === "major") {
    card.name_en = majorEN[card.rank] || card.name_ru;
    card.name_uk = majorUK[card.rank] || card.name_ru;
  } else {
    // Minor arcana: rank 1=Ace, 2-10=number, 11=Page, 12=Knight, 13=Queen, 14=King
    const suit = card.suit;
    const rank = card.rank;
    
    if (rankEN[rank] && suitEN[suit]) {
      card.name_en = `${rankEN[rank]} ${suitEN[suit]}`;
    } else {
      card.name_en = card.name_ru;
    }
    
    if (rankUK[rank] && suitUK[suit]) {
      card.name_uk = `${rankUK[rank]} ${suitUK[suit]}`;
    } else {
      card.name_uk = card.name_ru;
    }
  }
}

fs.writeFileSync(CARDS_PATH, JSON.stringify(cards, null, 2) + "\n", "utf-8");
console.log(`✅ Updated ${cards.length} cards with name_uk and name_en`);
