import { RootlistPlaylist } from '../utils';

export const LS_KEY = 'combined-playlists';
export const LS_KEY_SETTINGS = 'combined-playlists-settings';

export const CREATE_NEW_PLAYLIST_IDENTIFIER = 'CREATE_NEW_PLAYLIST_IDENTIFIER';

export const LIKED_SONGS_PLAYLIST_FACADE: RootlistPlaylist = {
   name: Spicetify.Platform?.Translations['shared.library.entity-row.liked-songs.title'],
   collaborative: false,
   description: '',
   external_urls: { spotify: '' },
   href: '',
   id: 'liked-songs-facade',
   images: [],
   owner: {
      display_name: '',
      external_urls: { spotify: '' },
      href: '',
      id: '',
      type: 'user',
      uri: ''
   },
   public: false,
   snapshot_id: '',
   tracks: {
      href: '',
      total: 0
   },
   type: 'playlist',
   uri: 'spotify:playlist:liked-songs-facade'
};

export const RELEASES_URL = 'https://api.github.com/repos/jeroentvb/spicetify-combined-playlists/releases';

export const DIST_URL = 'https://github.com/jeroentvb/spicetify-combined-playlists/tree/dist';
