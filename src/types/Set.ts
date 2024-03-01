import { Song } from './Song';

export type Set = {
  name?: string;
  song: Array<Song>;
  encore?: number;
};
