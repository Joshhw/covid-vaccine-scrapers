const dotenv = require("dotenv");
//note: this only works locally; in Lambda we use environment variables set manually
dotenv.config();

// const { Client } = require("@googlemaps/google-maps-services-js");
const { getLatLngPelias, getPeliasStreetAddress } = require("./lib/distance-utils");
const { generateKey } = require("./data/dataDefaulter");
const axios = require("axios");
const axiosRetry = require("axios-retry");

axiosRetry(axios, { retries: 5, retryDelay: axiosRetry.exponentialDelay });

const formatAddress = (name, street, city, zip) => {
    var result = ""
    if (name != "") {
        result += `${name},`
    }
    if (street != "") {
        result += `${street},`
    }
    if (city != "") {
        result += `${city},`
    }
    result += "Ma,"
    if (zip != "") {
        result += `${zip}`
    }
    return result

}

const getGeocode = async (name, street, city, zip) => {
    const address = formatAddress(name, street, city, zip);
    try {
        return await getLatLngPelias(address)
    } catch (e) {
        console.error(e);
    }
};

const getAllCoordinates = async (locations, cachedResults) => {
    const existingLocations = await cachedResults.reduce(async (acc, location) => {
        try {
            const accum = await acc
            const { latitude, longitude, street } = location;
            const address = street === undefined ? await getPeliasStreetAddress(latitude, longitude) : street
            if (latitude && longitude) {
                accum[generateKey(location)] = {
                    latitude,
                    longitude,
                    address
                };
                return accum;
            } else {
                return accum;
            }    
        } catch (e) {
            console.log(`get all coords error:${e}`)
        }
    }, Promise.resolve({}));

    const coordinateData = await Promise.all(
        locations.map(async (location) => {
            const { name = "", street = "", city= "", zip = "" } = location;
            const locationInd = generateKey(location);

            if (existingLocations[locationInd]) {
                return { ...location, ...existingLocations[locationInd] };
            } else {
                const locationData = await getGeocode(name, street,city, zip);

                if (locationData) {
                    return {
                        ...location,
                        latitude:
                            locationData?.lat,
                        longitude:
                            locationData?.lng,
                    };
                } else return location;
            }
        })
    );
    return coordinateData;
};

exports.getAllCoordinates = getAllCoordinates;
