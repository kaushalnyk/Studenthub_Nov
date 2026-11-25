// External weather service definition.
// Mirrors srv/external/API_BUSINESS_PARTNER.csn. Consumed directly from
// https://api.openweathermap.org/data/2.5/weather.
service Weather @(cds.external) {
  entity WeatherEntry {
    key City: String(100);
    Country: String(10);
    Temperature: Double;
    FeelsLike: Double;
    Humidity: Integer;
    Pressure: Integer;
    Wind: Double;
    Description: String(100);
    Icon: String(10);
  }
}
