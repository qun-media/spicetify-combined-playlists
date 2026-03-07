import { RootlistPlaylist } from '../utils';

export interface CombinedPlaylist {
   sources: PlaylistInfo[];
   target: PlaylistInfo
}

export type PlaylistInfo = Pick<RootlistPlaylist, 'name' | 'id' | 'uri'>;
