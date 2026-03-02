const CRISIS_PATTERNS = [
  /суицид/i,
  /самоубийств/i,
  /покончить с собой/i,
  /покончу с собой/i,
  /хочу умереть/i,
  /хочу сдохнуть/i,
  /не хочу жить/i,
  /убить себя/i,
  /убью себя/i,
  /повеситься/i,
  /повешусь/i,
  /порежу себя/i,
  /порезать вены/i,
  /спрыгну/i,
  /наглотаться таблеток/i,
  /самоповрежд/i,
  /селфхарм/i,
  /self.?harm/i,
];

const SENSITIVE_PATTERNS = [
  /диагноз/i,
  /лечение/i,
  /лекарств/i,
  /таблетк/i,
  /врач/i,
  /суд\b/i,
  /адвокат/i,
  /юрист/i,
  /инвестиц/i,
  /вложить деньги/i,
  /кредит/i,
  /ипотек/i,
];

export type SafetyResult =
  | { safe: true; sensitive: boolean }
  | { safe: false; message: string };

export function checkSafety(question: string): SafetyResult {
  for (const pat of CRISIS_PATTERNS) {
    if (pat.test(question)) {
      return {
        safe: false,
        message:
          "<b>Я чувствую, что тебе сейчас может быть очень тяжело.</b>\n" +
          "Карты здесь бессильны — но живые люди могут помочь. " +
          "Пожалуйста, обратись к близким или на линию помощи.\n\n" +
          "🇷🇺 <b>Россия</b>\n" +
          "  Телефон доверия: <code>8-800-2000-122</code> (бесплатно, 24/7)\n" +
          "  Центр экстренной психологической помощи МЧС: <code>+7 (495) 989-50-50</code>\n\n" +
          "🇺🇦 <b>Україна</b>\n" +
          "  Лайфлайн Україна: <code>7333</code> (з мобільного, безкоштовно)\n" +
          "  Гаряча лінія: <code>0-800-500-335</code>\n\n" +
          "🇧🇾 <b>Беларусь</b>\n" +
          "  Телефон доверия: <code>8-017-352-44-44</code>\n" +
          "  Для детей и подростков: <code>8-801-100-16-11</code>\n\n" +
          "🇰🇿 <b>Қазақстан</b>\n" +
          "  Телефон доверия: <code>150</code> (бесплатно, 24/7)\n" +
          "  Линия помощи: <code>+7 (717) 270-41-00</code>\n\n" +
          "<i>Ты не один(а). Помощь доступна прямо сейчас</i> 💙",
      };
    }
  }

  let sensitive = false;
  for (const pat of SENSITIVE_PATTERNS) {
    if (pat.test(question)) {
      sensitive = true;
      break;
    }
  }

  return { safe: true, sensitive };
}
