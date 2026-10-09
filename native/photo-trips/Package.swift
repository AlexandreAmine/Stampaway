// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "StampawayPhotoTrips",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "StampawayPhotoTrips",
            targets: ["PhotoTripsPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "PhotoTripsPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/PhotoTripsPlugin")
    ]
)
