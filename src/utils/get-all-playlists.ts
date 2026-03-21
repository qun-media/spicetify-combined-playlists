import {addIdFromUri} from './add-id-from-uri';

export type RootListItems = RootlistPlaylist | Folder;

export interface RootlistPlaylist {
   id: string;
   type: 'playlist';
   uri: string;
   name: string;
   images: { url: string }[];
   description: string;
   [key: string]: unknown; // Allow other properties
}

export interface Folder {
   type: 'folder';
   uri: string;
   items: RootListItems[];
   name: string;
   [key: string]: unknown; // Allow other properties
}

export function processPlaylists(items: RootListItems[]): RootlistPlaylist[] {
   return items.flatMap((item) => {
      if (item.type === 'playlist') {
         const uri = Spicetify.URI.from(item.uri);
         return uri?.id ? [addIdFromUri(item)] : [];
      }
      if (item.type === 'folder' && item.items) {
         return processPlaylists(item.items);
      }
      return [];
   });
}

function processItems(items: RootListItems[]): RootListItems[] {
   return items.reduce<RootListItems[]>((acc, item) => {
      if (item.type === 'playlist') {
         const uri = Spicetify.URI.from(item.uri);
         if (uri?.id) acc.push(addIdFromUri(item));
      } else if (item.type === 'folder' && item.items) {
         acc.push({ ...item, items: processItems(item.items) } as Folder);
      }
      return acc;
   }, []);
}

export async function getPlaylists(): Promise<RootListItems[]>;
export async function getPlaylists(flat: true): Promise<RootlistPlaylist[]>;
export async function getPlaylists(flat: false): Promise<RootListItems[]>;
export async function getPlaylists(flat: boolean = false): Promise<RootListItems[] | RootlistPlaylist[]> {
   const rootlist = await Spicetify.Platform.RootlistAPI.getContents();
   return flat ? processPlaylists(rootlist.items) : processItems(rootlist.items);
}