import axios from "axios";

export const initial = (CityName: string) => {
  return {
    modelName: "Address",
    calledMethod: "getWarehouses",
    methodProperties: {
      CityName: CityName,
    },
    apiKey: "ad68239527c403ae3359b6d9ba22931b",
  };
};

export const mailApi = {
  async getDepartment(CityName) {
    const { data } = await axios.post(
      "https://api.novaposhta.ua/v2.0/json/",
      initial(CityName)
    );
    return data.data.map((el) => el.Description);
  },
};
