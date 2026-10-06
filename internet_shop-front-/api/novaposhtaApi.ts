import axios from "axios";

const NOVA_POSHTA_API_URL = "https://api.novaposhta.ua/v2.0/json/";
const NOVA_POSHTA_API_KEY = "ad68239527c403ae3359b6d9ba22931b";

interface INewPostRequest {
  modelName: string;
  calledMethod: string;
  methodProperties: Record<string, string>;
}

interface INewPostResponse {
  success?: boolean;
  data?: Record<string, string>[] | null;
  errors?: unknown;
}

const readErrorMessages = (errors: unknown): string[] => {
  if (typeof errors === "string") {
    return errors ? [errors] : [];
  }
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.reduce<string[]>((messages, item) => {
    if (typeof item === "string") {
      if (item) messages.push(item);
      return messages;
    }
    if (item && typeof item === "object") {
      const nested = (item as { errors?: unknown }).errors;
      if (typeof nested === "string" && nested) {
        messages.push(nested);
      } else if (Array.isArray(nested)) {
        nested.forEach((message) => {
          if (typeof message === "string" && message) messages.push(message);
        });
      }
    }
    return messages;
  }, []);
};

const callNewPost = async (
  request: INewPostRequest
): Promise<Record<string, string>[]> => {
  let data: INewPostResponse | undefined;
  try {
    const response = await axios.post<INewPostResponse>(NOVA_POSHTA_API_URL, {
      ...request,
      apiKey: NOVA_POSHTA_API_KEY,
    });
    data = response.data;
  } catch {
    throw new Error(
      "Не вдалося зв'язатися з Новою Поштою. Перевірте інтернет і спробуйте ще раз."
    );
  }

  if (!data || data.success === false) {
    const messages = readErrorMessages(data?.errors);
    throw new Error(
      messages.join(" ") || "Сервіс Нової Пошти недоступний. Спробуйте пізніше."
    );
  }

  return Array.isArray(data.data) ? data.data : [];
};

export const mailApi = {
  async getDepartment(CityName: string): Promise<string[]> {
    const warehouses = await callNewPost({
      modelName: "Address",
      calledMethod: "getWarehouses",
      methodProperties: { CityName },
    });
    return warehouses
      .map((warehouse) => warehouse.Description)
      .filter((description) => Boolean(description));
  },

  async getCities(query: string): Promise<string[]> {
    const cities = await callNewPost({
      modelName: "Address",
      calledMethod: "getCities",
      methodProperties: { FindByString: query },
    });
    const names = cities
      .map((city) => city.Description)
      .filter((description) => Boolean(description));
    return Array.from(new Set(names));
  },
};
