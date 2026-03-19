import parisImg from "@/assets/paris.jpg";
import milanImg from "@/assets/milan.jpg";
import tokyoImg from "@/assets/tokyo.jpg";
import hongkongImg from "@/assets/hongkong.jpg";
import londonImg from "@/assets/london.jpg";
import newyorkImg from "@/assets/newyork.jpg";

export interface Place {
  id: string;
  name: string;
  country: string;
  type: "city" | "country";
  image: string;
  rating: number;
  reviewCount: number;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  placeId: string;
  placeName: string;
  placeImage: string;
  rating: number;
  reviewText: string;
  createdAt: string;
}

export interface TravelList {
  id: string;
  userId: string;
  name: string;
  description: string;
  placeCount: number;
  coverImage: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  profilePicture: string;
  countriesCount: number;
  citiesCount: number;
  reviewsCount: number;
  followersCount: number;
  followingCount: number;
}

export const places: Place[] = [
  { id: "1", name: "Paris", country: "France", type: "city", image: parisImg, rating: 4.5, reviewCount: 100000 },
  { id: "2", name: "Milan", country: "Italy", type: "city", image: milanImg, rating: 4.5, reviewCount: 100000 },
  { id: "3", name: "Tokyo", country: "Japan", type: "city", image: tokyoImg, rating: 4.8, reviewCount: 85000 },
  { id: "4", name: "Hong Kong", country: "China", type: "city", image: hongkongImg, rating: 4.5, reviewCount: 72000 },
  { id: "5", name: "London", country: "UK", type: "city", image: londonImg, rating: 4.3, reviewCount: 95000 },
  { id: "6", name: "New York", country: "USA", type: "city", image: newyorkImg, rating: 4.6, reviewCount: 120000 },
];

export const reviews: Review[] = [
  {
    id: "1",
    userId: "u1",
    userName: "Joseph Hakim",
    userAvatar: "https://i.pravatar.cc/100?img=11",
    placeId: "5",
    placeName: "London",
    placeImage: londonImg,
    rating: 4.5,
    reviewText: "An incredible city with so much history and culture. The food scene has really improved over the years!",
    createdAt: "2h ago",
  },
  {
    id: "2",
    userId: "u2",
    userName: "John Baker",
    userAvatar: "https://i.pravatar.cc/100?img=12",
    placeId: "4",
    placeName: "Hong Kong",
    placeImage: hongkongImg,
    rating: 4.5,
    reviewText: "The city felt safe and easy to explore the mix of modern and cultural traditions made it unforgettable.",
    createdAt: "5h ago",
  },
  {
    id: "3",
    userId: "u3",
    userName: "Sarah Chen",
    userAvatar: "https://i.pravatar.cc/100?img=5",
    placeId: "3",
    placeName: "Tokyo",
    placeImage: tokyoImg,
    rating: 5,
    reviewText: "Absolutely magical. The blend of ultra-modern and traditional is unlike anywhere else on earth.",
    createdAt: "1d ago",
  },
];

export const travelLists: TravelList[] = [
  { id: "1", userId: "me", name: "Best Cities 2025", description: "My favorite cities visited this year", placeCount: 8, coverImage: parisImg },
  { id: "2", userId: "me", name: "Wishlist", description: "Places I want to visit", placeCount: 12, coverImage: tokyoImg },
  { id: "3", userId: "me", name: "Hidden Gems", description: "Underrated destinations", placeCount: 5, coverImage: milanImg },
];

export const currentUser: User = {
  id: "me",
  username: "Skyler Bender",
  email: "skyler@example.com",
  profilePicture: "https://i.pravatar.cc/200?img=47",
  countriesCount: 40,
  citiesCount: 76,
  reviewsCount: 23,
  followersCount: 7,
  followingCount: 9,
};

export const recentSearches = ["Paris", "United States", "London", "New York", "Japan", "Italy", "Tokyo", "Argentina", "Sydney"];

export const ratingDistribution = [
  { stars: 5, count: 45 },
  { stars: 4, count: 28 },
  { stars: 3, count: 12 },
  { stars: 2, count: 5 },
  { stars: 1, count: 3 },
];
