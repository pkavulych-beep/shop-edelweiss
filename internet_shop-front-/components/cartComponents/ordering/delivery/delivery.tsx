import { NextPage } from "next";
import { Autocomplete, Box, TextField } from "@mui/material";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { DeliveryCityOption, DeliverySearch } from "../../../../utils/delivery";
import { CustomAutocomplete } from "./CustomAutocomplete";

interface IDeliveryProps {
  // Пошук міст і відділень залежить від перевізника: компонент сам не знає,
  // з яким API має справу
  search: DeliverySearch;
  cityName: string;
  department: string;
  setCity: React.Dispatch<React.SetStateAction<string>>;
  setDepartment: React.Dispatch<React.SetStateAction<string>>;
}

const SEARCH_DELAY = 600;

const toMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const DeliveryComponent: NextPage<IDeliveryProps> = ({
  search,
  cityName,
  department,
  setCity,
  setDepartment,
}) => {
  // Результати прив'язані до запиту й міста: завантаження і помилку виводимо з них
  const [citiesResult, setCitiesResult] = useState<{
    query: string;
    cities: DeliveryCityOption[];
    error: string | null;
  } | null>(null);
  const [cityQuery, setCityQuery] = useState("");

  const [departmentsResult, setDepartmentsResult] = useState<{
    city: string;
    departments: string[];
    error: string | null;
  } | null>(null);
  const [departmentQuery, setDepartmentQuery] = useState("");

  // Вибране місто тримаємо як варіант з id: воно потрібне, щоб завантажити
  // відділення (у Meest — за city_id, а не за назвою)
  const [selectedCity, setSelectedCity] = useState<DeliveryCityOption | null>(
    null
  );
  // У батька лишається лише назва міста, тож варіант вважаємо вибраним лише
  // поки його назва збігається з містом у замовленні: зміна перевізника
  // чистить місто в батька, і відділення скидаються без ефекту-синхронізації
  const activeCity =
    cityName && selectedCity?.label === cityName ? selectedCity : null;

  const cityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityRequestIdRef = useRef(0);
  const departmentRequestIdRef = useRef(0);
  // MUI Autocomplete скидає поле (reason "reset") на порожній рядок, коли
  // вибране місто стає null. Під час набору тексту це стирало б те, що ввів
  // користувач, тому такий reset після нашої ж правки ігноруємо.
  const keepInputOnResetRef = useRef(false);

  const resetDepartment = () => {
    setDepartment("");
    setDepartmentQuery("");
  };

  useEffect(() => {
    return () => {
      cityRequestIdRef.current += 1;
      departmentRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (cityTimerRef.current) {
      clearTimeout(cityTimerRef.current);
    }

    const query = cityQuery.trim();
    const requestId = ++cityRequestIdRef.current;

    if (!query || query === cityName) {
      return;
    }

    cityTimerRef.current = setTimeout(async () => {
      try {
        const foundCities = await search.getCities(query);
        if (requestId !== cityRequestIdRef.current) {
          return;
        }
        setCitiesResult({ query, cities: foundCities, error: null });
      } catch (error) {
        if (requestId !== cityRequestIdRef.current) {
          return;
        }
        setCitiesResult({
          query,
          cities: [],
          error: toMessage(error, "Не вдалося завантажити міста."),
        });
      }
    }, SEARCH_DELAY);

    return () => {
      if (cityTimerRef.current) {
        clearTimeout(cityTimerRef.current);
      }
    };
  }, [cityQuery, cityName, search]);

  useEffect(() => {
    const city = activeCity;
    const requestId = ++departmentRequestIdRef.current;

    if (!city) {
      return;
    }

    (async () => {
      try {
        const cityDepartments = await search.getDepartments(city);
        if (requestId !== departmentRequestIdRef.current) {
          return;
        }
        setDepartmentsResult({
          city: city.id,
          departments: cityDepartments,
          error: null,
        });
      } catch (error) {
        if (requestId !== departmentRequestIdRef.current) {
          return;
        }
        setDepartmentsResult({
          city: city.id,
          departments: [],
          error: toMessage(error, "Не вдалося завантажити відділення."),
        });
      }
    })();
  }, [activeCity, search]);

  const trimmedCityQuery = cityQuery.trim();
  const searchingCities = Boolean(trimmedCityQuery) && trimmedCityQuery !== cityName;
  const citiesLoading =
    searchingCities && citiesResult?.query !== trimmedCityQuery;
  const citiesError =
    searchingCities && !citiesLoading ? citiesResult?.error ?? null : null;
  const cities =
    trimmedCityQuery && citiesResult?.query === trimmedCityQuery
      ? citiesResult.cities
      : [];

  const currentDepartments =
    activeCity && departmentsResult?.city === activeCity.id
      ? departmentsResult
      : null;
  const departments = currentDepartments?.departments ?? [];
  const departmentsLoading = Boolean(activeCity) && !currentDepartments;
  const departmentsError = currentDepartments?.error ?? null;

  const handleCityChange = (_: unknown, value: DeliveryCityOption | null) => {
    setSelectedCity(value);
    setCity(value?.label || "");
    resetDepartment();
  };

  const handleCityInputChange = (
    _: unknown,
    value: string,
    reason: string
  ) => {
    // Скидання, яке MUI робить після того, як ми очистили вибране місто під
    // час набору, не повинно стирати введений текст.
    if (reason === "reset" && value === "" && keepInputOnResetRef.current) {
      keepInputOnResetRef.current = false;
      return;
    }

    setCityQuery(value);
    // Під час набору тексту вибір міста скидається, якщо воно більше не
    // збігається з поточним містом. Інакше у замовлення пішло б старе місто.
    const cleared =
      (reason === "reset" || reason === "clear") && value === "";
    const edited = reason === "input" && value !== cityName;
    if (cleared || edited) {
      // Наступний reset від MUI (value стане null) не має стерти текст.
      if (edited && cityName) {
        keepInputOnResetRef.current = true;
      }
      setSelectedCity(null);
      setCity("");
      resetDepartment();
    }
  };

  const handleDepartmentChange = (_: unknown, value: string | null) => {
    setDepartment(value || "");
  };

  const handleDepartmentInputChange = (
    _: unknown,
    value: string,
    reason: string
  ) => {
    setDepartmentQuery(value);
    if (reason === "input" && value !== department) {
      setDepartment("");
    }
  };

  const cityHelperText = citiesError
    ? citiesError
    : citiesLoading
    ? "Завантаження міст…"
    : cityQuery && !cityName
    ? "Оберіть місто зі списку"
    : "";

  const departmentHelperText = departmentsError
    ? departmentsError
    : departmentsLoading
    ? "Завантаження відділень…"
    : departmentQuery && !department
    ? "Оберіть відділення зі списку"
    : "";

  return (
    <Box minWidth={"40%"}>
      <Autocomplete
        id="delivery-city"
        options={cities}
        value={activeCity}
        inputValue={cityQuery}
        onChange={handleCityChange}
        onInputChange={handleCityInputChange}
        loading={citiesLoading}
        filterOptions={(options) => options}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        fullWidth
        sx={{ marginTop: 4 }}
        noOptionsText={
          cityQuery ? "Міст не знайдено" : "Почніть вводити назву міста"
        }
        loadingText="Завантаження…"
        renderInput={(params) => (
          <TextField
            {...params}
            label="Місто"
            variant="standard"
            error={Boolean(citiesError)}
            helperText={cityHelperText}
          />
        )}
      />
      <CustomAutocomplete
        id="delivery-department"
        options={departments}
        value={department || null}
        inputValue={departmentQuery}
        onChange={handleDepartmentChange}
        onInputChange={handleDepartmentInputChange}
        loading={departmentsLoading}
        fullWidth
        noOptionsText={
          activeCity ? "Відділень не знайдено" : "Спочатку оберіть місто"
        }
        loadingText="Завантаження…"
        renderInput={(params) => (
          <TextField
            {...params}
            label="Відділення"
            variant="standard"
            error={Boolean(departmentsError)}
            helperText={departmentHelperText}
          />
        )}
      />
    </Box>
  );
};

export const Delivery = React.memo(DeliveryComponent);
