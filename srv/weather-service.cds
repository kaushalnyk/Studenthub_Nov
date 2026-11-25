using {Weather} from './external/Weather';

service WeatherService {

  entity WeatherEntry as projection on Weather.WeatherEntry;

  // Unbound action: lookup weather for one city
  action getWeather(City: String) returns WeatherEntry;
}
