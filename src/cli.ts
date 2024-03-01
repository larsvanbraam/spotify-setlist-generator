import dotenv from 'dotenv';
import inquirer from 'inquirer';

import { getPosterImage } from './utils/getPosterImage';
import { spotifyApi } from './utils/spotifyApi';
import { getConcerts } from './utils/setlist/getConcerts';
import { authenticateUser } from './utils/spotify/authenticateUser';
import { createPlaylist } from './utils/spotify/createPlaylist';
import { Concert } from './types/Concert';
import { getTrackUrisForConcert } from './utils/spotify/getTrackUrisForConcert';

dotenv.config();

//Main Function
const main = async () => {
  let { artistName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'artistName',
      message: 'Enter the artist name:',
    },
  ]);

  const concerts = await getConcerts(artistName);

  if (concerts.length === 0) {
    console.log('\n No concerts for this artist');
    process.exit();
  }

  const { selectedConcert }: { selectedConcert: Concert } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedConcert',
      message: 'Select a concert:',
      choices: concerts.map((concert) => ({
        name: `${concert.venue.name}, ${concert.venue.city.name}, ${concert.venue.city.country.code} (${concert.eventDate})`,
        value: concert,
      })),
    },
  ]);

  // Overwrite the artist name, so we get the correct casing.
  artistName = selectedConcert.artist.name;

  const trackURIs = await getTrackUrisForConcert(selectedConcert);

  if (trackURIs.length === 0) {
    console.log('\n No tracks found for this concert on Spotify');
    process.exit();
  }

  const playlistId = await createPlaylist(
    `${artistName} - ${selectedConcert.venue.name} - ${selectedConcert.eventDate}`,
  );

  const posterImage = await getPosterImage(
    `${artistName} \n ${selectedConcert.venue.name} \n ${selectedConcert.eventDate}`,
  );

  await spotifyApi.uploadCustomPlaylistCoverImage(playlistId, posterImage);

  try {
    await spotifyApi.addTracksToPlaylist(playlistId, trackURIs);
  } catch (error) {
    console.log(error);
  }

  console.log(`\n Playlist created: https://open.spotify.com/playlist/${playlistId}`);
  process.exit();
};

authenticateUser(main);
