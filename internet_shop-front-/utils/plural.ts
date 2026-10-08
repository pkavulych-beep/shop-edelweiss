export const pluralize = (count: number, forms: [string, string, string]): string => {
  const absCount = Math.abs(count);
  const lastDigit = absCount % 10;
  const lastTwoDigits = absCount % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return forms[2];
  }
  if (lastDigit === 1) {
    return forms[0];
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return forms[1];
  }
  return forms[2];
};

export const pluralizeProduct = (count: number): string => {
  return pluralize(count, ['товар', 'товари', 'товарів']);
};