export type Song = {
  name: string;
  cover?: {
    mbid: string;
    name: string;
    sortName: string;
    disambiguation: string;
    url: string;
  };
  info?: string;
};
