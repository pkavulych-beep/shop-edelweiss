import axios from "axios";
import { DeliveryCityOption, DeliverySearch } from "../utils/delivery";

const MEEST_API_URL = "https://publicapi.meest.com";
const CITY_SEARCH_LIMIT = 20;
const NO_RESULT_CODES = new Set([10421, 10111]);

interface IMeestError {
  code?: number;
  ua?: string;
}

interface IMeestResponse<T> {
  status?: number;
  msg?: IMeestError | string | null;
  result?: T[] | null;
}

interface IMeestLocality {
  data?: {
    city_id?: string;
    n_ua?: string;
    t_ua?: string;
    dis?: string;
  };
}

interface IMeestBranch {
  num?: number | string;
  type_public?: { ua?: string };
  street?: { ua?: string };
  street_number?: string;
  limits?: { sending_only?: number };
}

// Назви з апострофом містить бектик («Кам`янець-Подільський»): запит зі
// звичайним апострофом API не знаходить (код 10421), а відповідає бектиком,
// який у списку показуємо як типографський апостроф
const toApiQuery = (query: string): string => query.replace(/['’ʼ]/g, "`");
const toDisplayName = (name: string): string => name.replace(/`/g, "’");

const readErrorMessage = (msg: IMeestError | string | null | undefined): string =>
  typeof msg === "object" && msg?.ua ? msg.ua : "";

const readErrorCode = (msg: IMeestError | string | null | undefined): number | undefined =>
  typeof msg === "object" && typeof msg?.code === "number" ? msg.code : undefined;

const callMeest = async <T>(
  path: string,
  params: Record<string, string>
): Promise<T[]> => {
  let data: IMeestResponse<T> | undefined;
  try {
    const response = await axios.get<IMeestResponse<T>>(`${MEEST_API_URL}/${path}`, {
      params,
    });
    data = response.data;
  } catch {
    throw new Error(
      "Не вдалося зв'язатися з Meest Поштою. Перевірте інтернет і спробуйте ще раз."
    );
  }

  if (!data || data.status !== 1) {
    // «Не вдалося знайти населений пункт/відділення» — це порожній результат,
    // а не помилка: покажемо «Міст не знайдено» без червоної помилки
    if (NO_RESULT_CODES.has(readErrorCode(data?.msg) ?? -1)) {
      return [];
    }
    throw new Error(
      readErrorMessage(data?.msg) ||
        "Сервіс Meest Пошти недоступний. Спробуйте пізніше."
    );
  }

  return Array.isArray(data.result) ? data.result : [];
};

const toCityOption = (locality: IMeestLocality): DeliveryCityOption | null => {
  const { city_id: cityId, n_ua: name, t_ua: type, dis: district } =
    locality.data ?? {};
  if (!cityId || !name) {
    return null;
  }
  const displayName = toDisplayName(name);
  // «Львів» — місто і кілька сел з такою ж назвою, тож для не-міст додаємо
  // тип і район, щоб вибір був однозначним
  if (!type || type === "місто") {
    return { id: cityId, label: displayName };
  }
  const parts = [type, district ? `${district} р-н` : ""].filter(Boolean);
  // У районі теж трапляється бектик («Кам`янець-Подільський р-н»)
  return {
    id: cityId,
    label: toDisplayName(`${displayName} (${parts.join(", ")})`),
  };
};

const toDepartmentLabel = (branch: IMeestBranch): string | null => {
  const { num, type_public: type, street, street_number: streetNumber } = branch;
  if (num === undefined || num === null || num === "") {
    return null;
  }
  const typeName = type?.ua?.trim() || "Відділення";
  const address = [street?.ua?.trim(), String(streetNumber ?? "").trim()]
    .filter(Boolean)
    .join(", ");
  return address ? `${typeName} №${num}: ${address}` : `${typeName} №${num}`;
};

const byDepartmentNumber = (left: string, right: string): number => {
  const readNumber = (label: string): number => {
    const match = label.match(/№(\d+)/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  };
  return readNumber(left) - readNumber(right);
};

export const meestApi = {
  async getCities(query: string): Promise<DeliveryCityOption[]> {
    const localities = await callMeest<IMeestLocality>("geo_localities", {
      search_beginning: toApiQuery(query),
    });
    return localities
      .map(toCityOption)
      .filter((option): option is DeliveryCityOption => option !== null)
      .slice(0, CITY_SEARCH_LIMIT);
  },

  async getDepartments(cityId: string): Promise<string[]> {
    const branches = await callMeest<IMeestBranch>("branches", {
      city: cityId,
      viewdata: "full",
    });
    return branches
      // Відділення, куди можна лише відправляти, покупцю не потрібні
      .filter((branch) => Number(branch.limits?.sending_only) !== 1)
      .map(toDepartmentLabel)
      .filter((label): label is string => Boolean(label))
      .sort(byDepartmentNumber);
  },
};

export const meestDeliverySearch: DeliverySearch = {
  getCities: (query) => meestApi.getCities(query),
  getDepartments: (city) => meestApi.getDepartments(city.id),
};
