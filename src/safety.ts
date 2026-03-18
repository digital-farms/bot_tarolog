import { t, Lang } from "./i18n";

const CRISIS_PATTERNS = [
  // RU
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
  // UK
  /суїцид/i,
  /самогубств/i,
  /хочу померти/i,
  /не хочу жити/i,
  /вбити себе/i,
  /повіситися/i,
  /порізати вени/i,
  // EN
  /self.?harm/i,
  /kill myself/i,
  /want to die/i,
  /end my life/i,
  /suicide/i,
  /don'?t want to live/i,
  /cut myself/i,
  /hang myself/i,
];

const SENSITIVE_PATTERNS = [
  // RU
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
  // UK
  /діагноз/i,
  /лікування/i,
  /адвокат/i,
  /інвестиц/i,
  // EN
  /diagnosis/i,
  /treatment/i,
  /medication/i,
  /lawyer/i,
  /invest/i,
  /mortgage/i,
  /credit/i,
];

export type SafetyResult =
  | { safe: true; sensitive: boolean }
  | { safe: false; message: string };

export function checkSafety(question: string, lang: Lang = "ru"): SafetyResult {
  for (const pat of CRISIS_PATTERNS) {
    if (pat.test(question)) {
      return {
        safe: false,
        message: t("safety.crisis", lang),
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
