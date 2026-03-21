import React from 'react';
import {
   combinePlaylists,
   getCombinedPlaylistsSettings,
   getPlaylistInfo,
   getPlaylists,
   processPlaylists,
   RootListItems,
   RootlistPlaylist,
   setCombinedPlaylistsSettings,
   TrackState
} from './utils';
import {CREATE_NEW_PLAYLIST_IDENTIFIER, LIKED_SONGS_PLAYLIST_FACADE, LS_KEY} from './constants';
import type {CombinedPlaylist, CombinedPlaylistsSettings, InitialPlaylistForm} from './types';

import './assets/css/styles.scss';
import {SpicetifySvgIcon} from './components/SpicetifySvgIcon';
import {PlaylistForm} from './components/AddPlaylistForm';
import {AddPlaylistCard} from './components/AddPlaylistCard';
import {Card} from './components/Card';
import {ImportExportModal} from './components/ImportExportModal';
import {synchronizeCombinedPlaylists} from './extensions/auto-sync';
import {UpdateBanner} from './components/UpdateBanner';
import {ConfirmDialog} from './components/ConfirmDialog';
import {addIdFromUri} from './utils/add-id-from-uri';

export interface State {
   playlistItems: RootListItems[];
   combinedPlaylists: CombinedPlaylist[];
   isLoading: boolean;
   isInitializing: boolean;
   autoSync: boolean;
}

// Needs to be deinfed to avoid eslint error
const SpotifyComponents = Spicetify.ReactComponent;

class App extends React.Component<Record<string, unknown>, State> {

   get combinedPlaylistsLs(): CombinedPlaylist[] {
      return JSON.parse(Spicetify.LocalStorage.get(LS_KEY) as string) ?? [];
   }

   set combinedPlaylistsLs(playlists: CombinedPlaylist[]) {
      Spicetify.LocalStorage.set(LS_KEY, JSON.stringify(playlists));
   }

   get flattenedPlaylists(): RootlistPlaylist[] {
      return processPlaylists(this.state.playlistItems);
   }

   constructor(props: Record<string, unknown>) {
      super(props);

      const settings = getCombinedPlaylistsSettings();

      this.state = {
         playlistItems: [],
         combinedPlaylists: [],
         isLoading: false,
         isInitializing: false,
         autoSync: settings.autoSync,
      };
   }

   @TrackState('isInitializing')
   async componentDidMount() {
      const [rawPlaylists, rawPlaylistItems] = await Promise.all([getPlaylists(true), getPlaylists()]);
      const playlists = [...rawPlaylists, LIKED_SONGS_PLAYLIST_FACADE];
      const playlistItems = [...rawPlaylistItems, LIKED_SONGS_PLAYLIST_FACADE];
      const combinedPlaylists = this.combinedPlaylistsLs.map((combinedPlaylist) => this.getMostRecentPlaylistFromData(combinedPlaylist, playlists));
      const checkedCombinedPlaylists = this.checkIfPlaylistsAreStillValid(combinedPlaylists);

      this.setState({
         playlistItems,
         combinedPlaylists: checkedCombinedPlaylists
      });

      // Remove new top bar if it exists, because it interferes with the layout
      const topBarContent = document.querySelector<HTMLHeadingElement>('.main-topBar-container');
      if (topBarContent) topBarContent.style.display = 'none';
   }

   checkIfPlaylistsAreStillValid(combinedPlaylists: CombinedPlaylist[]) {
      const validPlaylists = combinedPlaylists
         .filter(({ target }) => target?.id) // Check if target playlist still exists
         .map((pl) => ({ ...pl, sources: pl.sources.filter(Boolean)})); // Check if source playlists still exist

      this.combinedPlaylistsLs = validPlaylists;

      return validPlaylists;
   }

   @TrackState('isLoading')
   async createNewCombinedPlaylist(formData: InitialPlaylistForm) {
      const sourcePlaylists = formData.sources.map((source) => this.findPlaylist(source));
      const targetPlaylist = formData.target === CREATE_NEW_PLAYLIST_IDENTIFIER
         ? await this.createPlaylist(formData.sources)
         : this.findPlaylist(formData.target);

      await combinePlaylists(sourcePlaylists, targetPlaylist)
         .catch((err) => {
            console.error('An error ocurred while combining playlists', err);
            Spicetify.showNotification('An error ocurred while combining playlists', true);
         });
      this.saveCombinedPlaylist(sourcePlaylists, targetPlaylist);

      Spicetify.PopupModal.hide();
   }

   async createPlaylist(sources: string[]): Promise<RootlistPlaylist> {
      const sourcePlaylistNames = sources.map((source) => this.findPlaylist(source).name);

      const newPlaylistUri: string = await Spicetify.Platform.RootlistAPI.createPlaylist('Combined Playlist', {
         before: 'start',
      });

      // Set description and make playlist private
      await Spicetify.Platform.PlaylistAPI.setAttributes(newPlaylistUri, { description: `Combined playlist from ${sourcePlaylistNames.join(', ')}.` });
      await Spicetify.Platform.PlaylistPermissionsAPI.setBasePermission(newPlaylistUri, 'BLOCKED');

      /**
       * Using the rootlistApi instead of Spicetify.Platform.PlaylistAPI.getContents(newPlaylistUri) because the playlistApi doesn't return enough data.
       * Note that playlists can be nested in folders when using the rootlistApi. But we don't need to care, because new playlists are always created in the root.
       */
      const playlist: RootlistPlaylist = await Spicetify.Platform.RootlistAPI.getContents()
         .then((contents: { items: RootListItems[] }) => contents.items.find((item) => item.uri === newPlaylistUri))
         .then((playlist: RootlistPlaylist) => addIdFromUri(playlist));
      this.setState((state) => ({ playlistItems: [...state.playlistItems, playlist ] }));

      console.log('new playlist', playlist);


      return playlist;
   }

   /**
    * Save combined playlist to localstorage and state. Making sure not to create a duplicate
    */
   saveCombinedPlaylist(sourcePlaylists: RootlistPlaylist[], targetPlaylist: RootlistPlaylist) {
      const combinedPlaylist: CombinedPlaylist = {
         sources: sourcePlaylists.map(getPlaylistInfo),
         target: getPlaylistInfo(targetPlaylist),
      };

      const index = this.state.combinedPlaylists.findIndex(({ target }) => target.id === combinedPlaylist.target.id);
      let newCombinedPlaylists: CombinedPlaylist[];

      // TODO THIS DOES NOT WORK CORRECTLY. Playlists aren't saved to LS correctly

      if (index >= 0) {
         newCombinedPlaylists = this.state.combinedPlaylists;
         newCombinedPlaylists[index] = combinedPlaylist;
      } else {
         newCombinedPlaylists = this.state.combinedPlaylists.concat(combinedPlaylist);
      }

      console.log('new', newCombinedPlaylists);

      this.setState({
         combinedPlaylists: newCombinedPlaylists,
      });

      this.combinedPlaylistsLs = newCombinedPlaylists;
   }

   deleteCombinedPlaylist(playlist: CombinedPlaylist) {
      const confirmDeleteCombinedPlaylist = () => {
         const newCombinedPlaylists = this.state.combinedPlaylists.filter((pl) => pl.target.id !== playlist.target.id);

         this.setState({
            combinedPlaylists: newCombinedPlaylists,
         });

         this.combinedPlaylistsLs = newCombinedPlaylists;
      };

      Spicetify.PopupModal.display({
         title: 'Delete combined playlist',
         content: <ConfirmDialog
            confirmMsg="Are you sure you want to delete this combined playlist? This will not delete the actual Spotify playlist."
            onConfirm={() => {
               confirmDeleteCombinedPlaylist();
               Spicetify.PopupModal.hide();
            }}
            onCancel={() => Spicetify.PopupModal.hide()}
         />,
         isLarge: true,
      });
   }

   @TrackState('isLoading')
   async syncPlaylist(id: string) {
      const playlistToSync = this.findPlaylist(id);
      const { sources } = this.state.combinedPlaylists.find((combinedPlaylist) => combinedPlaylist.target.id === playlistToSync.id) as CombinedPlaylist;
      const sourcePlaylists = sources.map((sourcePlaylist) => this.findPlaylist(sourcePlaylist.id));

      await combinePlaylists(sourcePlaylists, playlistToSync)
         .catch((err) => {
            console.error('An error ocurred while syncing playlists', err);
            Spicetify.showNotification('An error ocurred while syncing playlists', true);
         });
   }

   @TrackState('isLoading')
   async syncAllPlaylists() {
      Spicetify.showNotification('Synchronizing all combined playlists');
      await synchronizeCombinedPlaylists();
   }

   findPlaylist(id: string) {
      return this.flattenedPlaylists.find((playlist) => playlist.id === id) as RootlistPlaylist;
   }

   getMostRecentPlaylistFromData(combinedPlaylist: CombinedPlaylist, playlists: RootlistPlaylist[]): CombinedPlaylist {
      const sources = combinedPlaylist.sources.map(({ id }) => playlists.find((pl) => pl.id === id) as RootlistPlaylist);
      const target = playlists.find((pl) => pl.id === combinedPlaylist.target.id) as RootlistPlaylist;

      return { sources, target };
   }

   showAddPlaylistModal() {
      const Form = <PlaylistForm playlists={this.flattenedPlaylists} playlistItems={this.state.playlistItems} onSubmit={this.createNewCombinedPlaylist.bind(this)} />;

      Spicetify.PopupModal.display({
         title: 'Create combined playlist',
         content: Form,
         isLarge: true,
      });
   }

   openEditPlaylistModal(combinedPlaylist: CombinedPlaylist) {
      const formValues: InitialPlaylistForm = {
         target: combinedPlaylist.target.id,
         sources: combinedPlaylist.sources.map((source) => source.id)
      };
      const Form = <PlaylistForm
         playlists={this.flattenedPlaylists}
         playlistItems={this.state.playlistItems}
         onSubmit={this.createNewCombinedPlaylist.bind(this)}
         onDelete={() => {
            Spicetify.PopupModal.hide();
            setTimeout(() => this.deleteCombinedPlaylist(combinedPlaylist), 50);
         }}
         initialForm={formValues}
         isNew={false}
      />;

      Spicetify.PopupModal.display({
         title: 'Edit combined playlist',
         content: Form,
         isLarge: true,
      });
   }

   openImportExportModal() {
      const importCombinedPlaylists = (combinedPlaylistsData: string) => {
         const combinedPlaylists = JSON.parse(combinedPlaylistsData);
         const safeCombinedPlaylists = this.checkIfPlaylistsAreStillValid(combinedPlaylists.map((combinedPlaylist: CombinedPlaylist) => this.getMostRecentPlaylistFromData(combinedPlaylist, this.flattenedPlaylists)));

         this.setState({ combinedPlaylists: safeCombinedPlaylists });

         this.combinedPlaylistsLs = safeCombinedPlaylists;

         Spicetify.showNotification('Imported combined playlists successfully!');
         Spicetify.PopupModal.hide();
      };

      Spicetify.PopupModal.display({
         title: 'Import / export combined playlists',
         content: <ImportExportModal combinedPlaylists={this.state.combinedPlaylists} importCombinedPlaylists={importCombinedPlaylists} />,
         isLarge: true,
      });
   }

   toggleAutoSuync() {
      const newSettings: CombinedPlaylistsSettings = {
         ...getCombinedPlaylistsSettings(),
         autoSync: !this.state.autoSync,
      };

      this.setState({ autoSync: newSettings.autoSync });
      setCombinedPlaylistsSettings(newSettings);
   }

   render() {
      const menuWrapper = (<SpotifyComponents.Menu>
         <SpotifyComponents.MenuItem
            label="Import / export combined playlists"
            leadingIcon={<SpicetifySvgIcon iconName="external-link" />}
            onClick={() => this.openImportExportModal()}
         >
            Import / export
         </SpotifyComponents.MenuItem>
         <SpotifyComponents.MenuItem
            label="Toggle auto sync"
            leadingIcon={<SpicetifySvgIcon iconName="repeat" />}
            onClick={() => this.toggleAutoSuync()}
         >
            {this.state.autoSync ? 'Disable auto sync' : 'Enable auto sync'}
         </SpotifyComponents.MenuItem>
         <SpotifyComponents.MenuItem
            label="Synchronize all combined playlists"
            leadingIcon={<SpicetifySvgIcon iconName="repeat-once" />}
            onClick={() => !this.state.isLoading && this.syncAllPlaylists()}
         >
            Synchronize all
         </SpotifyComponents.MenuItem>
      </SpotifyComponents.Menu>);

      return (
         <div id="combined-playlists--wrapper" className="contentSpacing">
            <div id="combined-playlists--header-content">
               <UpdateBanner />
               <header>
                  <h1>Playlist combiner</h1>
                  <button onClick={() => this.showAddPlaylistModal()}><SpicetifySvgIcon iconName="plus2px" /></button>
                  <SpotifyComponents.ContextMenu
                     trigger="click"
                     menu={menuWrapper}
                  >
                     <button><SpicetifySvgIcon iconName="more" /></button>
                  </SpotifyComponents.ContextMenu>
               </header>
            </div>

            {!this.state.isInitializing && <div id="combined-playlists--grid" className="main-gridContainer-gridContainer">
               {this.state.combinedPlaylists.map((combinedPlaylist) => {
                  const playlist = this.findPlaylist(combinedPlaylist.target.id);

                  return <Card
                     key={playlist.id}
                     playlist={playlist}
                     onClick={() => !this.state.isLoading && this.openEditPlaylistModal(combinedPlaylist)}
                     onClickAction={() => !this.state.isLoading && this.syncPlaylist(playlist.id)}
                  />;
               })}
               <AddPlaylistCard onClick={() => !this.state.isLoading && this.showAddPlaylistModal()} />
            </div>}
         </div>
      );
   }
}

export default App;
