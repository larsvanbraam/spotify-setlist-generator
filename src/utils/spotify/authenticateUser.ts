import express from 'express';
import { spotifyApi } from '../spotifyApi';
import fs from 'fs';
import open from 'open';

/**
 * Helper method that authenticates the user on spotify and allows us to use their API and create
 * playlists on the users behalf.
 *
 * @param onAuthenticated
 */
export function authenticateUser(onAuthenticated: () => void) {
  const app = express();

  app.get('/callback', (req, res) => {
    const error = req.query.error;
    const code = req.query.code as string | undefined;

    if (error || !code) {
      console.error('Callback Error:', error);
      res.send('Callback Error: ' + error);
      return;
    }

    spotifyApi
      .authorizationCodeGrant(code)
      .then((data) => {
        const access_token = data.body['access_token'];
        const refresh_token = data.body['refresh_token'];
        const expires_in = data.body['expires_in'];

        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);

        // Cache the tokens
        fs.writeFileSync(
          'token.json',
          JSON.stringify({
            access_token,
            refresh_token,
            expires_in,
            timestamp: new Date().getTime(),
          }),
        );

        console.log(`Successfully retrieved access token. Expires in ${expires_in} s.`);
        res.send('Success! You can now close the window.');

        onAuthenticated();
      })
      .catch((error) => {
        console.error('Error getting Tokens:', error);
        res.send(`Error getting Tokens: ${error}`);
      });
  });

  // Load cached tokens
  if (fs.existsSync('token.json')) {
    const tokenData = JSON.parse(fs.readFileSync('token.json').toString());

    // Check if token has expired
    if (new Date().getTime() - tokenData.timestamp > tokenData.expires_in * 1000) {
      console.log('Token expired, please reauthenticate');
    } else {
      spotifyApi.setAccessToken(tokenData.access_token);
      spotifyApi.setRefreshToken(tokenData.refresh_token);

      return onAuthenticated();
    }
  }

  app.listen(8888, () =>
    open(
      `${spotifyApi.createAuthorizeURL(['playlist-modify-private', 'playlist-modify-public', 'ugc-image-upload'], 'setlist')}`,
    ),
  );
}
