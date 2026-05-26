export const INTERPRET_PAGE_SYSTEM_PROMPT = `Classifique o que é a página atual em JSON:
{
  "summary": "frase curta descrevendo a tela",
  "hints": {
    "looksLikeList": bool,
    "looksLikeDetail": bool,
    "looksLikeChat": bool,
    "looksLikeLogin": bool,
    "looksLikeChallenge": bool
  }
}`;
