export function randomInRange(min: number, max: number)
{
    return Math.random() * (max - min) + min;
}

export function randomChoice(cases: number) {
    return Math.floor(Math.random() * cases);
}

export function randomElement<T>(array: T[]) {
    return array[randomChoice(array.length)];
}

export function shuffle<T>(array: T[]) {
    // Shuffle the deck array with Fisher-Yates
    var i = array.length,  j;

    // While there remain elements to shuffle...
    while (i != 0) {
  
      // Pick a remaining element...
      j = Math.floor(Math.random() * i);
      i--;
  
      // And swap it with the current element.
      [array[i], array[j]] = [array[j], array[i]];
    }
  
    return array;
}
