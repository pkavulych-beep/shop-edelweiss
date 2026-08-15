export const categoryLabels: Record<string, string> = {
  outerwear: 'Верхній одяг',
  pants: 'Штани',
  tshirts: 'Футболки',
  shirts: 'Сорочки',
  hoodies: 'Худі та светри',
  dresses: 'Сукні',
  skirts: 'Спідниці',
  shoes: 'Взуття',
  accessories: 'Аксесуари',
  sportswear: 'Спортивний одяг',
  underwear: 'Білизна',
};

// Categories that should be hidden for men
export const womenOnlyCategories = ['dresses', 'skirts'];

export const seasonLabels: Record<string, string> = {
  'all-season': 'Всесезонний',
  'spring-summer': 'Весна-Літо',
  'autumn-winter': 'Осінь-Зима',
};

export const sortOptions = [
  { value: 'newest', label: 'Новинки' },
  { value: 'price_asc', label: 'Ціна: від низької' },
  { value: 'price_desc', label: 'Ціна: від високої' },
];

export const commonSizes = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL',
  '22', '23', '24', '26', '28', '30', '32', '34',
  '36', '37', '38', '39', '40', '41', '42', '43', '44',
];

export const commonColors = [
  'Чорний', 'Білий', 'Сірий', 'Синій', 'Червоний',
  'Зелений', 'Бежевий', 'Коричневий', 'Рожевий', 'Жовтий',
];
