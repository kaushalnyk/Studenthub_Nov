import cds from '@sap/cds';

// Original OpenWeatherMap REST endpoint — consumed directly, no proxy server.
const WEATHER_API = 'https://api.openweathermap.org/data/2.5/weather';

// Key lives in .cdsrc-private.json (git-ignored), loaded by CAP into cds.env
export default class WeatherService extends cds.ApplicationService {
    async init() {
        const apiKey = cds.env.requires.Weather?.credentials?.APIKey;

        this.on('READ', 'WeatherEntry', async (req) => {
            const city = req.query.to?.[0]?.City ?? req.data?.City;
            if (!city) return [];
            const data = await getWeather(city, apiKey).catch((e) => req.reject(502, e.message));
            return [toEntry(data)];
        });

        // Unbound action, mirrors the unbound actions in srv/s4-service.js
        this.on('getWeather', async (req) => {
            const { City } = req.data;
            if (!City) return req.reject(400, 'City required');
            const data = await getWeather(City, apiKey).catch((e) => req.reject(502, e.message));
            return toEntry(data);
        });

        return super.init();
    }
}

async function getWeather(city, apiKey) {
    if (!apiKey) {
        throw new Error('Weather API key missing: add it to .cdsrc-private.json');
    }
    const url = `${WEATHER_API}?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || !data.main) {
        throw new Error(data.message || 'weather api error');
    }
    return data;
}

function toEntry(data) {
    return {
        City: data.name,
        Country: data.sys?.country,
        Temperature: data.main.temp,
        FeelsLike: data.main.feels_like,
        Humidity: data.main.humidity,
        Pressure: data.main.pressure,
        Wind: data.wind?.speed,
        Description: data.weather?.[0]?.description,
        Icon: data.weather?.[0]?.icon,
    };
}
