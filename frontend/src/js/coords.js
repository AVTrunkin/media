export function parseCoords(input) {
  let str = String(input).trim();

  const mathMinus = String.fromCharCode(0x2212);
  str = str.split(mathMinus).join('-');

  const hasOpen = str.startsWith('[');
  const hasClose = str.endsWith(']');
  if (hasOpen !== hasClose) {
    throw new Error('Неверный формат координат');
  }
  if (hasOpen) {
    str = str.slice(1, -1).trim();
  }

  const num = '-?[0-9]+(?:[.][0-9]+)?';
  const re = new RegExp(`^(${num})[ ]*,[ ]*(${num})$`);
  const match = str.match(re);

  if (!match) {
    throw new Error('Неверный формат координат');
  }

  return {
    latitude: parseFloat(match[1]),
    longitude: parseFloat(match[2]),
  };
}

export default parseCoords;
