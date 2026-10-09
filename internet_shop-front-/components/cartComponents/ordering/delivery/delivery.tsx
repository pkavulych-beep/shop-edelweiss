import { NextPage } from "next";
import { Autocomplete, Box, TextField } from "@mui/material";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Typography from "@mui/material/Typography";
import { mailApi } from "../../../../api/novaposhtaApi";
import { CustomAutocomplete } from "./CustomAutocomplete";

interface IDeliveryProps {
  cityName: string;
  department: string;
  setCity: React.Dispatch<React.SetStateAction<string>>;
  setDepartment: React.Dispatch<React.SetStateAction<string>>;
}

const SEARCH_DELAY = 600;

const toMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const DeliveryComponent: NextPage<IDeliveryProps> = ({
  cityName,
  department,
  setCity,
  setDepartment,
}) => {
  // Результати прив'язані до запиту й міста: завантаження і помилку виводимо з них
  const [citiesResult, setCitiesResult] = useState<{
    query: string;
    cities: string[];
    error: string | null;
  } | null>(null);
  const [cityQuery, setCityQuery] = useState("");

  const [departmentsResult, setDepartmentsResult] = useState<{
    city: string;
    departments: string[];
    error: string | null;
  } | null>(null);
  const [departmentQuery, setDepartmentQuery] = useState("");

  const cityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityRequestIdRef = useRef(0);
  const departmentRequestIdRef = useRef(0);

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
        const foundCities = await mailApi.getCities(query);
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
  }, [cityQuery, cityName]);

  useEffect(() => {
    const requestId = ++departmentRequestIdRef.current;

    if (!cityName) {
      return;
    }

    (async () => {
      try {
        const cityDepartments = await mailApi.getDepartment(cityName);
        if (requestId !== departmentRequestIdRef.current) {
          return;
        }
        setDepartmentsResult({
          city: cityName,
          departments: cityDepartments,
          error: null,
        });
      } catch (error) {
        if (requestId !== departmentRequestIdRef.current) {
          return;
        }
        setDepartmentsResult({
          city: cityName,
          departments: [],
          error: toMessage(error, "Не вдалося завантажити відділення."),
        });
      }
    })();
  }, [cityName]);

  const trimmedCityQuery = cityQuery.trim();
  const searchingCities = Boolean(trimmedCityQuery) && trimmedCityQuery !== cityName;
  const citiesLoading =
    searchingCities && citiesResult?.query !== trimmedCityQuery;
  const citiesError =
    searchingCities && !citiesLoading ? citiesResult?.error ?? null : null;
  const cities = trimmedCityQuery ? citiesResult?.cities ?? [] : [];

  const currentDepartments =
    cityName && departmentsResult?.city === cityName ? departmentsResult : null;
  const departments = currentDepartments?.departments ?? [];
  const departmentsLoading = Boolean(cityName) && !currentDepartments;
  const departmentsError = currentDepartments?.error ?? null;

  const handleCityChange = (_: unknown, value: string | null) => {
    setCity(value || "");
    resetDepartment();
  };

  const handleCityInputChange = (
    _: unknown,
    value: string,
    reason: string
  ) => {
    setCityQuery(value);
    // Під час набору тексту вибір міста скидається, якщо він більше не
    // збігається з поточним містом. Інакше у замовлення пішло б старе місто.
    const cleared =
      (reason === "reset" || reason === "clear") && value === "";
    const edited = reason === "input" && value !== cityName;
    if (cleared || edited) {
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
      <Typography variant="h6" sx={{ marginTop: 3 }}>
        ДОСТАВКА НОВОЮ ПОШТОЮ
      </Typography>
      <Autocomplete
        id="delivery-city"
        options={cities}
        value={cityName || null}
        inputValue={cityQuery}
        onChange={handleCityChange}
        onInputChange={handleCityInputChange}
        loading={citiesLoading}
        filterOptions={(options) => options}
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
          cityName ? "Відділень не знайдено" : "Спочатку оберіть місто"
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
