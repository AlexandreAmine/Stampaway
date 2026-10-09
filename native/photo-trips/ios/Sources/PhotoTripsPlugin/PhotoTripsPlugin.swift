import Foundation
import Capacitor
import Photos
import UIKit

/// Reads where and when the user's photos were taken, never the photos
/// themselves: only each asset's location and creation date from the Photos
/// library index, which needs no image loading or download. Results are
/// grouped into ~1 km cells per day before they reach the app's web code,
/// and nothing here is sent anywhere: the app only saves the countries the
/// person confirms.
@objc(PhotoTripsPlugin)
public class PhotoTripsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoTripsPlugin"
    public let jsName = "PhotoTrips"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

    private func accessString(_ status: PHAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "granted"
        case .limited: return "limited"
        case .notDetermined: return "prompt"
        case .denied, .restricted: return "denied"
        @unknown default: return "denied"
        }
    }

    @objc func checkAccess(_ call: CAPPluginCall) {
        call.resolve(["access": accessString(PHPhotoLibrary.authorizationStatus(for: .readWrite))])
    }

    @objc func requestAccess(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            call.resolve(["access": self.accessString(status)])
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve()
        }
    }

    @objc func scan(_ call: CAPPluginCall) {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard status == .authorized || status == .limited else {
            call.reject("Photo library access was not granted", "ACCESS_DENIED")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let options = PHFetchOptions()
            // The user's own library only: shared albums hold other people's photos.
            options.includeAssetSourceTypes = [.typeUserLibrary]
            options.includeHiddenAssets = false
            let assets = PHAsset.fetchAssets(with: options)

            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone.current
            var counts: [String: Int] = [:]
            var located = 0

            assets.enumerateObjects { asset, _, _ in
                if asset.mediaSubtypes.contains(.photoScreenshot) { return }
                guard let location = asset.location, let date = asset.creationDate else { return }
                let coordinate = location.coordinate
                guard CLLocationCoordinate2DIsValid(coordinate),
                      !(coordinate.latitude == 0 && coordinate.longitude == 0) else { return }
                located += 1
                // 0.01° cells (~1 km): fine enough for the smallest countries
                // (Monaco is ~3 km across), coarse enough to group a day's
                // photos taken around the same place.
                let lat = (coordinate.latitude * 100).rounded() / 100
                let lng = (coordinate.longitude * 100).rounded() / 100
                let parts = calendar.dateComponents([.year, .month, .day], from: date)
                guard let y = parts.year, let m = parts.month, let d = parts.day else { return }
                let key = String(format: "%.2f|%.2f|%04d-%02d-%02d", lat, lng, y, m, d)
                counts[key, default: 0] += 1
            }

            var cells: [[String: Any]] = []
            cells.reserveCapacity(counts.count)
            for (key, count) in counts {
                let fields = key.split(separator: "|")
                guard fields.count == 3, let lat = Double(fields[0]), let lng = Double(fields[1]) else { continue }
                cells.append(["lat": lat, "lng": lng, "day": String(fields[2]), "count": count])
            }

            call.resolve([
                "access": self.accessString(status),
                "total": assets.count,
                "located": located,
                "cells": cells
            ])
        }
    }
}
