import { Set } from './Set';

export type Concert = {
  id: string;
  versionId: string;
  eventDate: string;
  lastUpdated: string;
  artist: {
    mbid: string;
    name: string;
    sortName: string;
    disambiguation: string;
    url: string;
  };
  venue: {
    id: string;
    name: string;
    city: {
      id: string;
      name: string;
      state: string;
      stateCode: string;
      coords: any; // You may want to define a type for coordinates
      country: any; // You may want to define a type for country
    };
    url: string;
  };
  tour: {
    name: string;
  };
  sets: {
    set: Array<Set>;
  };
  url: string;
};
