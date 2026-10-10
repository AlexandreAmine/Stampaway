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
        CAPPluginMethod(name: "geocode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reverseGeocode", returnType: CAPPluginReturnPromise)
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

    /// Which city a point is in ("Finding cities in your photos"): only the
    /// coordinates of a group of photos are sent, never the photos. Names
    /// come back in English, the language of the app's place catalogue.
    @objc func reverseGeocode(_ call: CAPPluginCall) {
        guard let lat = call.getDouble("lat"), let lng = call.getDouble("lng") else {
            call.reject("Missing coordinates")
            return
        }
        let location = CLLocation(latitude: lat, longitude: lng)

        DispatchQueue.main.async {
            // One geocoder per lookup: a CLGeocoder handles one request at a
            // time, and the app runs a few at once. Kept alive by the closure.
            let reverseGeocoder = CLGeocoder()
            reverseGeocoder.reverseGeocodeLocation(location, preferredLocale: Locale(identifier: "en_US")) { placemarks, error in
                _ = reverseGeocoder
                if let error = error as? CLError, error.code == .network {
                    // Offline, or too many lookups in a short time: try again later.
                    call.resolve(["found": false, "retry": true])
                    return
                }
                guard error == nil, let placemark = placemarks?.first, let code = placemark.isoCountryCode else {
                    call.resolve(["found": false, "retry": false])
                    return
                }
                // From the most to the least specific; the app keeps the first
                // that matches one of its cities.
                let names = [placemark.locality, placemark.subAdministrativeArea, placemark.administrativeArea]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                call.resolve(["found": true, "names": names, "countryCode": code.uppercased()])
            }
        }
    }
}
