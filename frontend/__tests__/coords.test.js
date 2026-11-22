import { parseCoords } from "../src/js/coords";

describe("parseCoords", () => {
  test("координаты с пробелом", () => {
    expect(parseCoords("51.50851, −0.12572")).toEqual({
      latitude: 51.50851,
      longitude: -0.12572,
    });
  });

  test("координаты без пробела", () => {
    expect(parseCoords("51.50851,−0.12572")).toEqual({
      latitude: 51.50851,
      longitude: -0.12572,
    });
  });

  test("координаты в квадратных скобках", () => {
    expect(parseCoords("[51.50851, −0.12572]")).toEqual({
      latitude: 51.50851,
      longitude: -0.12572,
    });
  });

  test.each([
    "51.50851",
    "abc, def",
    "[51.50851, −0.12572",
    "51.50851, −0.12572]",
    "51.50851 −0.12572",
    "",
  ])("неверный формат %s вызывает исключение", (value) => {
    expect(() => parseCoords(value)).toThrow();
  });
});
