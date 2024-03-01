import axios from 'axios';
import { Concert } from '../../types/Concert';

/**
 * Helper method to get the concerts for a given artist.
 *
 * @param artistName
 */
export async function getConcerts(artistName: string): Promise<Array<Concert>> {
  try {
    const response = await axios.get(
      `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${artistName}`,
      {
        headers: {
          'x-api-key': process.env.SETLIST_API_KEY,
          Accept: 'application/json',
        },
      },
    );

    const current_date = new Date().toISOString().split('T')[0];

    return response.data.setlist.filter((concert: Concert) => {
      // Exclude concerts with no songs
      if (!concert.sets.set || concert.sets.set.length === 0) return false;

      // Exclude future concerts
      return concert.eventDate <= current_date;
    });
  } catch (error) {
    return [];
  }
}
