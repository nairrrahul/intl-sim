export function getMatchSkew(matchKind: string) : number {
  switch(matchKind) {
    case "friendly":
      return 0.9;
    case "u20WorldCupGroup":
      return 1;
    case "nationsLeague":
      return 1.2;
    case "afconQualifier":
    case "afcCupQualifier":
    case "euroQualifier":
    case "goldCupPlayoff":
    case "ofcCupQualifier":
      return 1.25;
    case "worldCupQualifier":
      return 1.3;
    case "afconGroup":
    case "afcCupGroup":
    case "goldCupGroup":
    case "ofcCupGroup":
    case "euroGroup":
    case "copaAmericaGroup":
      return 1.4;
    case "u20WorldCupKnockout":
      return 1.45;
    case "worldCupGroup":
      return 1.5;  
    case "afconKnockout":
    case "afcCupKnockout":
    case "goldCupKnockout":
    case "ofcCupKnockout":
    case "euroKnockout":
    case "copaAmericaKnockout":
      return 1.65;
    case "worldCupKnockout":
      return 1.7;
    default:
      return 1;
  }
}