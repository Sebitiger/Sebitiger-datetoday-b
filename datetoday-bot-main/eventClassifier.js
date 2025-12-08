// Assigns a priority score (1 to 3) to an event based on its description.
// 3 = major global impact
// 2 = moderately important
// 1 = minor but still educational

export function classifyEvent(description) {
  const d = description.toLowerCase();

  // Major events
  const majorKeywords = [
    "empire", "king", "emperor", "dynasty", "revolution",
    "battle", "war", "independence", "treaty", "constitution",
    "rights", "abolition", "uprising", "civil war",
    "invention", "discovery", "scientist", "physics", "chemistry",
    "medicine", "biology", "vaccine", "astronomy",
    "philosophy", "religion", "reform",
    "exploration", "expedition",
    "foundation", "founding", "established"
  ];

  // Medium importance
  const mediumKeywords = [
    "published", "composer", "artist", "architect", "music",
    "opera", "painting", "theory", "observatory",
    "kingdom", "monarch", "navy", "army",
    "colonial", "republic", "trade", "navigation"
  ];

  const isMajor = majorKeywords.some(k => d.includes(k));
  if (isMajor) return 3;

  const isMedium = mediumKeywords.some(k => d.includes(k));
  if (isMedium) return 2;

  // Everything else educational but small
  return 1;
}
