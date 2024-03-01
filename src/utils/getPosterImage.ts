import axios from 'axios';

/**
 * Helper method to create a poster image for the playlist that represents the setlist.
 *
 * @param label
 */
export async function getPosterImage(label: string): Promise<string> {
  const response = await axios.get(
    `https://placehold.co/800x800/000000/FFF/JPEG?text=${encodeURIComponent(label)}`,
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(response.data, 'binary').toString('base64');
}
