import { SpotifyPlaylist } from '../types';

function processPlaylists(items: any[]): SpotifyPlaylist[] {
    const playlists: SpotifyPlaylist[] = [];

    for (const item of items) {
        if (item.type === 'playlist') {
            const { URI } = Spicetify;
            const uri = URI.from(item.uri);
            if (uri?.id) {
                playlists.push({
                    ...item,
                    id: uri.id,
                } as SpotifyPlaylist);
            }
        } else if (item.type === 'folder' && item.items) {
            playlists.push(...processPlaylists(item.items));
        }
    }

    return playlists;
}


export async function getAllPlaylists(): Promise<SpotifyPlaylist[]> {
   const rootlist = await Spicetify.Platform.RootlistAPI.getContents();
   return processPlaylists(rootlist.items);
}
