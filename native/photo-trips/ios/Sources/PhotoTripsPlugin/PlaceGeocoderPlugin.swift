import Foundation
import Capacitor
import CoreLocation

/// Finds where a city is with Apple's geocoder ("New York City, United
/// States" → its coordinates), so map pins sit on the city itself rather
/// than in the middle of its country. Only the place name and country are
/// sent; the app keeps each answer on the phone and asks once per city.
@objc(PlaceGeocoderPlugin)
public class PlaceGeocoderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PlaceGeocoderPlugin"
    public let jsName = "PlaceGeocoder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "geocode", returnType: CAPPluginReturnPromise)
    ]

    // CLGeocoder handles one request at a time; the app queues its calls.
    private let geocoder = CLGeocoder()

    @objc func geocode(_ call: CAPPluginCall) {
        guard let query = call.getString("query"), !query.isEmpty else {
            call.reject("Missing query")
            return
        }
        // When given, the answer must be in this country (ISO alpha-2), so a
        // same-name city elsewhere is never used.
        let expectedCountry = call.getString("countryCode")?.uppercased()

        DispatchQueue.main.async {
            self.geocoder.geocodeAddressString(query) { placemarks, error in
                if error != nil {
                    // Network trouble or rate limit: let the app retry later.
                    call.resolve(["found": false, "retry": true])
                    return
                }
                let match = (placemarks ?? []).first { placemark in
                    guard placemark.location != nil else { return false }
                    guard let expected = expectedCountry else { return true }
                    return placemark.isoCountryCode?.uppercased() == expected
                }
                guard let coordinate = match?.location?.coordinate else {
                    call.resolve(["found": false, "retry": false])
                    return
                }
                call.resolve(["found": true, "lat": coordinate.latitude, "lng": coordinate.longitude])
            }
        }
    }
}
