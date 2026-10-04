export interface IUserData {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  createdAt: string;
  updateAt: string;
  roles: IRole[];
}

export interface IProduct {
  id: number;
  name: string;
  cover: string;
  sizes: string[];
  colors: string[];
  count: number;
  description: string;
  weight: string;
  material: string;
  price: number;
  salePrice: number;
  category?: string;
  subcategory?: string;
  brand?: string;
  season?: string;
  status?: string;
  gender?: string;
}

export type productToBasket = {
  idProduct: number;
  size: string;
};

export type CartItem = {
  id?: number;
  idProduct: number;
  size: string;
  quantity: number;
};

export type CartProductDetails = {
  id: number;
  name: string;
  cover: string;
  sizes: string[];
  price: number;
  salePrice: number;
};

export type photo = {
  id: number;
  url: string;
};

export interface currentProduct extends IProduct {
  photos: photo[];
}

export enum Gender {
  Man = 'man',
  Woman = 'woman',
  Unisex = 'unisex',
}

export enum Category {
  Outerwear = 'outerwear',
  Pants = 'pants',
  Tshirts = 'tshirts',
  Shirts = 'shirts',
  Hoodies = 'hoodies',
  Dresses = 'dresses',
  Skirts = 'skirts',
  Shoes = 'shoes',
  Accessories = 'accessories',
  Sportswear = 'sportswear',
  Underwear = 'underwear',
}

export enum Season {
  AllSeason = 'all-season',
  SpringSummer = 'spring-summer',
  AutumnWinter = 'autumn-winter',
}

export interface ICategory {
  gender: Gender;
}

export interface IProductFilters {
  gender?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  color?: string;
  size?: string;
  material?: string;
  season?: string;
  priceMin?: number;
  priceMax?: number;
  onSale?: boolean;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface IProductsResponse {
  data: IProduct[];
  total: number;
}

export enum Role {
  admin = 'ADMIN',
  user = 'USER',
}

export interface IRole {
  id: number;
  value: Role;
  description: string;
}
