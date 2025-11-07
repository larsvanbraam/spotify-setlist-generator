import axios from 'axios';
import { Concert } from '../../types/Concert';

/**
 * Helper method to get the concerts for a given artist.
 *
 * @param artistName
 */
export async function getConcerts(artistName: string): Promise<Array<Concert>> {
  try {
    const allConcerts: Array<Concert> = [];
    let page = 1;
    const maxPages = 2; // Limit to first 40 concerts (2 pages * 20 per page)

    // Fetch multiple pages of results
    while (page <= maxPages) {
      const response = await axios.get(
        `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${artistName}&p=${page}`,
        {
          headers: {
            'x-api-key': process.env.SETLIST_API_KEY,
            Accept: 'application/json',
          },
        },
      );

      const { setlist, total } = response.data;
      
      console.log(`Page ${page}: Found ${setlist?.length || 0} concerts (Total available: ${total})`);
      
      // Add concerts from this page
      if (setlist && setlist.length > 0) {
        allConcerts.push(...setlist);
      }
      
      // Stop if we've fetched all available concerts
      if (setlist.length === 0 || allConcerts.length >= total) {
        break;
      }
      
      page++;
      
      // Add a small delay between requests to avoid rate limiting
      if (page <= maxPages) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Total concerts fetched: ${allConcerts.length}`);

    const current_date = new Date().toISOString().split('T')[0];

    const filteredConcerts = allConcerts.filter((concert: Concert) => {
      // Exclude concerts with no songs
      if (!concert.sets.set || concert.sets.set.length === 0) return false;

      // Exclude future concerts
      return concert.eventDate <= current_date;
    });
    
    console.log(`Concerts after filtering: ${filteredConcerts.length}`);
    
    return filteredConcerts;
  } catch (error) {
    console.error('Error fetching concerts:', error);
    return [];
  }
}
