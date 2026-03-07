import type { PlaylistInfo } from '../types/combined-playlist';

export function getPlaylistInfo({ id, name, uri }: PlaylistInfo): PlaylistInfo {
   return { id, name, uri };
}
